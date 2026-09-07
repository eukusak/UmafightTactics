/**
 * odd-r offset hex grid (spec §13). Logical coordinates only: nothing here
 * knows about pixels, and the renderer converts separately.
 */
import { BOARD_COLS, BOARD_ROWS_TOTAL, HEX_ODD_ROW_OFFSET_X, HEX_STEP_X, HEX_STEP_Y } from '../constants';

export type Hex = { q: number; r: number };

export const hexKey = (h: Hex): string => `${h.q},${h.r}`;

export const hexEquals = (a: Hex, b: Hex): boolean => a.q === b.q && a.r === b.r;

/** odd-r offset -> cube coordinates. */
export function toCube(h: Hex): { x: number; y: number; z: number } {
  const x = h.q - (h.r - (h.r & 1)) / 2;
  const z = h.r;
  return { x, y: -x - z, z };
}

export function hexDistance(a: Hex, b: Hex): number {
  const ca = toCube(a);
  const cb = toCube(b);
  return Math.max(Math.abs(ca.x - cb.x), Math.abs(ca.y - cb.y), Math.abs(ca.z - cb.z));
}

/** Neighbour offsets for odd-r: index 0 is even rows, index 1 odd rows. */
const NEIGHBOUR_OFFSETS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [[+1, 0], [0, -1], [-1, -1], [-1, 0], [-1, +1], [0, +1]], // even row
  [[+1, 0], [+1, -1], [0, -1], [-1, 0], [0, +1], [+1, +1]], // odd row
];

export function neighbours(h: Hex): Hex[] {
  const parity = h.r & 1;
  return NEIGHBOUR_OFFSETS[parity].map(([dq, dr]) => ({ q: h.q + dq, r: h.r + dr }));
}

export function inBounds(h: Hex): boolean {
  return h.q >= 0 && h.q < BOARD_COLS && h.r >= 0 && h.r < BOARD_ROWS_TOTAL;
}

/** All hexes within `radius` of the centre, including the centre itself. */
export function hexesInRange(centre: Hex, radius: number): Hex[] {
  const out: Hex[] = [];
  for (let r = 0; r < BOARD_ROWS_TOTAL; r += 1) {
    for (let q = 0; q < BOARD_COLS; q += 1) {
      const h = { q, r };
      if (hexDistance(centre, h) <= radius) out.push(h);
    }
  }
  return out;
}

/**
 * Point reflection of a battle cell through the board centre — the same
 * isometry `toBattleCell` uses to place team B.
 */
export function reflectCell(cell: Hex): Hex {
  const x = cell.q - (cell.r - (cell.r & 1)) / 2;
  const r = 7 - cell.r;
  const xr = 3 - x;
  return { q: xr + (r - (r & 1)) / 2, r };
}

/**
 * A tie-break key expressed in the team's own frame.
 *
 * Every positional tie-break (pathfinding, attack-position choice, dash landing)
 * must be mirror-equivariant, otherwise both teams would prefer the same
 * absolute direction and one side gains a systematic edge in symmetric fights.
 */
export function teamKey(cell: Hex, team: 'A' | 'B'): string {
  const c = team === 'A' ? cell : reflectCell(cell);
  return `${c.q},${c.r}`;
}

export type KeyFn = (h: Hex) => string;

/** Deterministic A* over free cells. `blocked` excludes the goal itself. */
export function findPath(
  start: Hex, goal: Hex, blocked: ReadonlySet<string>, keyOf: KeyFn = hexKey,
): Hex[] {
  if (hexEquals(start, goal)) return [];
  const startKey = hexKey(start);
  const goalKey = hexKey(goal);

  const open: Array<{ hex: Hex; f: number; g: number }> = [
    { hex: start, f: hexDistance(start, goal), g: 0 },
  ];
  const cameFrom = new Map<string, Hex>();
  const gScore = new Map<string, number>([[startKey, 0]]);
  const closed = new Set<string>();

  while (open.length > 0) {
    // Sorting keeps the search deterministic without a priority queue's tie ambiguity.
    open.sort((a, b) => a.f - b.f || keyOf(a.hex).localeCompare(keyOf(b.hex)));
    const current = open.shift()!;
    const currentKey = hexKey(current.hex);
    if (currentKey === goalKey) {
      const path: Hex[] = [current.hex];
      let k = currentKey;
      while (cameFrom.has(k)) {
        const prev = cameFrom.get(k)!;
        k = hexKey(prev);
        if (k === startKey) break;
        path.unshift(prev);
      }
      return path;
    }
    if (closed.has(currentKey)) continue;
    closed.add(currentKey);

    for (const nb of neighbours(current.hex)) {
      if (!inBounds(nb)) continue;
      const nbKey = hexKey(nb);
      if (closed.has(nbKey)) continue;
      if (blocked.has(nbKey) && nbKey !== goalKey) continue;
      const tentative = current.g + 1;
      if (tentative < (gScore.get(nbKey) ?? Infinity)) {
        cameFrom.set(nbKey, current.hex);
        gScore.set(nbKey, tentative);
        open.push({ hex: nb, f: tentative + hexDistance(nb, goal), g: tentative });
      }
    }
  }
  return [];
}

/**
 * Closest free cell from which `from` can reach `target` at `range`.
 * Returns null when nothing is reachable.
 */
export function findAttackPosition(
  from: Hex, target: Hex, range: number, blocked: ReadonlySet<string>, keyOf: KeyFn = hexKey,
): Hex | null {
  let best: Hex | null = null;
  let bestScore = Infinity;
  let bestKey = '';
  for (let r = 0; r < BOARD_ROWS_TOTAL; r += 1) {
    for (let q = 0; q < BOARD_COLS; q += 1) {
      const cand = { q, r };
      if (hexDistance(cand, target) > range) continue;
      const key = hexKey(cand);
      if (blocked.has(key) && !hexEquals(cand, from)) continue;
      const score = hexDistance(from, cand) * 100 + hexDistance(cand, target);
      const candKey = keyOf(cand);
      if (score < bestScore || (score === bestScore && best !== null && candKey < bestKey)) {
        bestScore = score;
        best = cand;
        bestKey = candKey;
      }
    }
  }
  return best;
}

/**
 * Team B holds rows 0-3 (top), team A rows 4-7 (bottom); they meet at the
 * 3/4 boundary. "Front" means the two rows nearest that boundary.
 */
export function isFrontRow(cell: Hex, team: 'A' | 'B'): boolean {
  return team === 'B' ? cell.r >= 2 && cell.r <= 3 : cell.r >= 4 && cell.r <= 5;
}

export function isBackRow(cell: Hex, team: 'A' | 'B'): boolean {
  return team === 'B' ? cell.r <= 1 : cell.r >= 6;
}

/**
 * Maps a player-board cell (q, r) with r in 0..3 onto the shared 7x8 battle
 * board for the given team.
 *
 * Team A translates straight down. Team B is the *point reflection* of team A
 * through cube-space vector (3, _, 7). A reflection across the horizontal
 * midline is not an isometry on an odd-r grid — odd rows are offset half a
 * hex, so a mirrored formation would sit at different distances than the
 * original and one side would win symmetric fights. A point reflection in cube
 * coordinates preserves every distance exactly, so a mirror match is fair.
 */
export function toBattleCell(boardCell: Hex, team: 'A' | 'B'): Hex {
  if (team === 'A') return { q: boardCell.q, r: boardCell.r + 4 };
  const aCell = { q: boardCell.q, r: boardCell.r + 4 };
  const x = aCell.q - (aCell.r - (aCell.r & 1)) / 2;
  const rB = 7 - aCell.r;
  const xB = 3 - x;
  return { q: xB + (rB - (rB & 1)) / 2, r: rB };
}

/** Logical hex -> pixel centre at the 1920×1080 reference layout. */
export function hexToPixel(h: Hex, originX: number, originY: number): { x: number; y: number } {
  const offset = (h.r & 1) === 1 ? HEX_ODD_ROW_OFFSET_X : 0;
  return { x: originX + h.q * HEX_STEP_X + offset, y: originY + h.r * HEX_STEP_Y };
}

/** Nearest hex to a pixel position; used for drag-and-drop. */
export function pixelToHex(x: number, y: number, originX: number, originY: number): Hex | null {
  let best: Hex | null = null;
  let bestDist = Infinity;
  for (let r = 0; r < BOARD_ROWS_TOTAL; r += 1) {
    for (let q = 0; q < BOARD_COLS; q += 1) {
      const p = hexToPixel({ q, r }, originX, originY);
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bestDist) { bestDist = d; best = { q, r }; }
    }
  }
  // Reject clicks well outside the grid.
  return bestDist <= (HEX_STEP_X * 0.75) ** 2 ? best : null;
}
