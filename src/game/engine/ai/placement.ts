import { lineupScore, unitPower } from './evaluation';
import type { PublicBoard } from './strategy';
/** Board placement search (spec §26.5). Bounded to 40 candidate layouts. */
import { BOARD_COLS, BOARD_ROWS_PER_SIDE } from '../constants';
import { getUnitDef } from '../roster';
import type { Role } from '../types';
import type { HexPos, PlayerState, UnitInstance } from '../state';
import { teamSizeLimit } from '../shop';

const MAX_CANDIDATES = 180;

/** Preferred row (0 = front line) per role. */
const ROLE_ROW: Record<Role, number> = {
  TANK: 0, BRUISER: 0, AD_CARRY: 3, AP_CARRY: 3, SUPPORT: 2,
};

/** How strongly a unit wants its preferred row. */
const ROLE_ROW_WEIGHT: Record<Role, number> = {
  TANK: 3.0, BRUISER: 2.0, AD_CARRY: 3.2, AP_CARRY: 3.4, SUPPORT: 1.6,
};

export type Layout = { instanceId: string; position: HexPos }[];

function scoreLayout(layout: Layout, units: Map<string, UnitInstance>, spreadCarries: boolean, opponents: PublicBoard[] = []): number {
  let score = 0;
  const byCell = new Map<string, Role>();

  for (const slot of layout) {
    const unit = units.get(slot.instanceId)!;
    const def = getUnitDef(unit.unitDefId);
    const want = preferredRow(unit);
    score -= Math.abs(slot.position.r - want) * ROLE_ROW_WEIGHT[def.role];
    byCell.set(`${slot.position.q},${slot.position.r}`, def.role);
  }

  // Carries in a corner are easy prey for divers; nudge them inward when asked.
  if (spreadCarries) {
    for (const slot of layout) {
      const def = getUnitDef(units.get(slot.instanceId)!.unitDefId);
      if (def.role === 'AD_CARRY' || def.role === 'AP_CARRY') {
        const edge = slot.position.q === 0 || slot.position.q === BOARD_COLS - 1;
        if (edge) score -= 2.5;
      }
    }
  }

  // Front-line units clustered together hold the line better.
  let frontAdjacency = 0;
  for (const [key, role] of byCell) {
    if (role !== 'TANK' && role !== 'BRUISER') continue;
    const [q, r] = key.split(',').map(Number);
    for (const [dq, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nb = byCell.get(`${q + dq},${r + dr}`);
      if (nb === 'TANK' || nb === 'BRUISER') frontAdjacency += 1;
    }
  }
  score += frontAdjacency * 0.4;

  // Supports want to sit next to a carry.
  for (const slot of layout) {
    const def = getUnitDef(units.get(slot.instanceId)!.unitDefId);
    if (def.role !== 'SUPPORT') continue;
    const [q, r] = [slot.position.q, slot.position.r];
    for (const [dq, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nb = byCell.get(`${q + dq},${r + dr}`);
      if (nb === 'AD_CARRY' || nb === 'AP_CARRY') { score += 0.8; break; }
    }
  }

  for (const slot of layout) {
    const unit = units.get(slot.instanceId)!, def = getUnitDef(unit.unitDefId);
    const carry = def.role === 'AD_CARRY' || def.role === 'AP_CARRY';
    for (const opponent of opponents) for (const enemy of opponent.board) {
      if (!enemy.position) continue;
      const ed = getUnitDef(enemy.unitDefId), column = 6 - enemy.position.q;
      const alignment = Math.max(0, 3 - Math.abs(slot.position.q - column));
      const threat = unitPower(enemy) / Math.max(1, opponents.length);
      if (carry && ed.attackRange >= 3) score -= alignment * threat * .12;
      if (def.role === 'TANK' && ed.attackRange >= 3) score += alignment * threat * .1;
    }
    if (carry && def.attackRange >= 3) {
      const front = layout.filter(other => getUnitDef(units.get(other.instanceId)!.unitDefId).role === 'TANK');
      if (front.some(other => Math.abs(other.position.q - slot.position.q) <= 1)) score += 1.3;
      for (const other of layout) if (other !== slot && Math.abs(other.position.q - slot.position.q) <= 1 && other.position.r === slot.position.r) score -= .65;
    }
  }
  return score;
}

const selectionCache = new WeakMap<PlayerState, { key: string; units: UnitInstance[] }>();

/** Greedy team selection followed by swap search scores complete trait breakpoints. */
export function chooseFieldedUnits(player: PlayerState): UnitInstance[] {
  const key = `${player.seasonId}:${teamSizeLimit(player)}:${JSON.stringify(player.bonusTraits)}:` + [...player.board, ...player.bench].map(u => `${u.instanceId}/${u.unitDefId}/${u.star}/${u.items.join(',')}`).sort().join(';');
  const cached = selectionCache.get(player);
  if (cached?.key === key) return cached.units.slice();
  const all = [...player.board, ...player.bench].sort((a, b) => unitPower(b) - unitPower(a) || a.instanceId.localeCompare(b.instanceId));
  const limit = Math.min(teamSizeLimit(player), all.length);
  let selected: UnitInstance[] = [];
  while (selected.length < limit) {
    const next = all.filter(u => !selected.includes(u)).sort((a, b) => lineupScore(player, [...selected, b]) - lineupScore(player, [...selected, a]) || a.instanceId.localeCompare(b.instanceId))[0];
    selected.push(next);
  }
  let score = lineupScore(player, selected);
  for (let pass = 0; pass < 2; pass++) for (const candidate of all.filter(u => !selected.includes(u))) {
    for (let i = 0; i < selected.length; i++) {
      if (selected.includes(candidate)) break;
      const next = selected.slice(); next[i] = candidate;
      const value = lineupScore(player, next);
      if (value > score + .01) { selected = next; score = value; }
    }
  }
  selectionCache.set(player, { key, units: selected });
  return selected.slice();
}
function preferredRow(unit: UnitInstance): number {
  const def = getUnitDef(unit.unitDefId);
  return def.attackRange <= 1 && (def.role === 'AD_CARRY' || def.role === 'AP_CARRY') ? 1 : ROLE_ROW[def.role];
}

/**
 * Deterministic hill-climb over a bounded candidate set: start from the
 * role-ideal layout, then try swaps and keep improvements.
 */
export function planPlacement(player: PlayerState, spreadCarries: boolean, opponents: PublicBoard[] = []): Layout {
  const fielded = chooseFieldedUnits(player);
  const units = new Map(fielded.map((u) => [u.instanceId, u]));
  if (!fielded.length) return [];

  const cells: HexPos[] = [];
  for (let r = 0; r < BOARD_ROWS_PER_SIDE; r += 1) {
    for (let q = 0; q < BOARD_COLS; q += 1) cells.push({ q, r });
  }
  // Middle columns first so formations grow outward from the centre.
  cells.sort((a, b) => a.r - b.r || Math.abs(a.q - 3) - Math.abs(b.q - 3) || a.q - b.q);

  const sorted = fielded.slice().sort((a, b) => {
    const ra = preferredRow(a);
    const rb = preferredRow(b);
    return ra - rb || a.instanceId.localeCompare(b.instanceId);
  });

  let best: Layout = sorted.map((u) => {
    const want = preferredRow(u);
    const idx = cells.findIndex((c) => c.r === want);
    const cell = cells.splice(idx >= 0 ? idx : 0, 1)[0];
    return { instanceId: u.instanceId, position: cell };
  });
  let bestScore = scoreLayout(best, units, spreadCarries, opponents);

  let evaluated = 1;
  for (let i = 0; i < best.length && evaluated < MAX_CANDIDATES; i += 1) {
    for (let j = i + 1; j < best.length && evaluated < MAX_CANDIDATES; j += 1) {
      const candidate = best.map((s) => ({ ...s }));
      const tmp = candidate[i].position;
      candidate[i].position = candidate[j].position;
      candidate[j].position = tmp;
      evaluated += 1;
      const score = scoreLayout(candidate, units, spreadCarries, opponents);
      if (score > bestScore) { best = candidate; bestScore = score; }
    }
  }
  for (let i = 0; i < best.length && evaluated < MAX_CANDIDATES; i++) {
    for (let q = 0; q < BOARD_COLS && evaluated < MAX_CANDIDATES; q++) {
      const r = preferredRow(units.get(best[i].instanceId)!);
      if (best.some(slot => slot.position.q === q && slot.position.r === r)) continue;
      const candidate = best.map(slot => ({ ...slot, position: { ...slot.position } }));
      candidate[i].position = { q, r }; evaluated++;
      const score = scoreLayout(candidate, units, spreadCarries, opponents);
      if (score > bestScore + .01) { best = candidate; bestScore = score; }
    }
  }
  return best;
}

/** Writes the planned layout back onto the player: fielded on board, rest benched. */
export function applyPlacement(player: PlayerState, layout: Layout): void {
  const placed = new Map(layout.map((s) => [s.instanceId, s.position]));
  const all = [...player.board, ...player.bench];
  player.board = [];
  player.bench = [];
  for (const unit of all) {
    const pos = placed.get(unit.instanceId);
    if (pos) {
      unit.position = pos;
      player.board.push(unit);
    } else {
      unit.position = null;
      player.bench.push(unit);
    }
  }
}
