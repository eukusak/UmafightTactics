/**
 * Full-condition matchup matrix.
 *
 * `audit:cost-curve` measures deck shapes under one set of conditions — no
 * items, no augments, no race plan, one fixed formation. That is enough to
 * compare two cost curves against each other and nowhere near enough to say
 * what beats what: a value board that melts a front line with items and a
 * finishing move is a different board from the same units bare, and the answer
 * is supposed to move when the conditions do.
 *
 * This sweeps every archetype against every other across items, augments, the
 * race plan, formation, and the round's going/pace/weather/clause, then reports
 * the spread rather than a single number — including which condition swings each
 * deck the furthest, which is the part a single measurement can never show.
 *
 *   npm run audit:matrix -- --fights 12
 */
import { simulateBattle, type BattleSideInput } from '../src/game/engine/battle/engine';
import { Rng } from '../src/game/engine/rng';
import { getSeasonUnits, getUnitTraits } from '../src/game/engine/roster';
import { ALL_ITEM_DEFS } from '../src/game/engine/items/item-defs';
import { activeTierIndex, getTrait } from '../src/game/engine/traits/trait-defs';
import type { RaceConditions } from '../src/game/engine/race-plan/conditions';
import {
  RACE_PLAN_DEFS, RACE_EVOLUTION_DEFS, FINISHING_MOVE_DEFS,
} from '../src/game/engine/race-plan/defs';
import type { TraitId } from '../src/game/engine/types';

const SEP = '~';
const arg = (name: string, fallback: number): number => {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 ? Number(process.argv[i + 1]) || fallback : fallback;
};
const FIGHTS = arg('fights', 12);

const s1 = getSeasonUnits('s1');
const pool = (cost: number, kind: 'front' | 'carry', n: number, skip = 0) =>
  s1.filter((u) => u.cost === cost && (kind === 'front'
    ? (u.role === 'TANK' || u.role === 'BRUISER')
    : (u.role === 'AD_CARRY' || u.role === 'AP_CARRY')))
    .slice(skip, skip + n);

type Spec = { id: string; star: 1 | 2 | 3; front: boolean };
const F = (cost: number, star: 1 | 2 | 3, n: number, skip = 0): Spec[] =>
  pool(cost, 'front', n, skip).map((u) => ({ id: u.id, star, front: true }));
const C = (cost: number, star: 1 | 2 | 3, n: number, skip = 0): Spec[] =>
  pool(cost, 'carry', n, skip).map((u) => ({ id: u.id, star, front: false }));

// ------------------------------------------------------------- archetypes

const ARCHETYPES: Record<string, Spec[]> = {
  '1코 리롤': [...F(1, 3, 3), ...F(2, 2, 1), ...C(1, 3, 2), ...C(3, 2, 2)],
  '2코 리롤': [...F(2, 3, 3), ...F(1, 2, 1), ...C(2, 3, 2), ...C(3, 2, 2)],
  '3코 중심': [...F(2, 2, 2), ...F(3, 2, 2), ...C(3, 2, 4)],
  '밸류 8렙': [...F(1, 2, 2), ...F(2, 2, 2), ...C(4, 1, 3), ...C(5, 1, 1)],
  '밸류 9렙': [...F(1, 2, 2), ...F(2, 2, 2), ...C(4, 2, 3), ...C(5, 1, 1)],
  '4코 도배': [...F(4, 2, 1), ...F(4, 1, 1, 1), ...C(4, 2, 3), ...C(4, 1, 3, 3)],
  '앞줄 중심': [...F(1, 3, 2), ...F(2, 2, 3), ...F(3, 2, 1), ...C(3, 2, 2)],
  '균형': [...F(1, 2, 1), ...F(2, 2, 2), ...F(3, 2, 1), ...C(3, 2, 2), ...C(4, 1, 2)],
};
const NAMES = Object.keys(ARCHETYPES);

// ---------------------------------------------------------------- modifiers

const REAL = new Set(ALL_ITEM_DEFS.filter((i) => !i.isComponent).map((i) => i.id));
const keep = (ids: string[]) => ids.filter((id) => REAL.has(id));
const CARRY_ITEMS = keep(['champion_trophy', 'twilight_racing_suit', 'victory_bloodwind']);
const FRONT_ITEMS = keep(['unyielding_fighting_spirit', 'giant_overtaker', 'trainer_lifeblade']);
const itemsFor = (spec: Spec, tier: number): string[] =>
  tier === 0 ? [] : (spec.front ? FRONT_ITEMS : CARRY_ITEMS).slice(0, tier);

const AUGMENT_SETS: string[][] = [[], ['team_diversity', 'spell_jewel'], ['armor_lesson', 'finisher_recovery']];
const PLAN_SETS: Array<string[] | null> = [
  null,
  [RACE_PLAN_DEFS[0].id, RACE_EVOLUTION_DEFS[0].id, FINISHING_MOVE_DEFS[0].id],
];

/**
 * Board row 0 is the rank that faces the enemy. Carries sit on row 1 directly
 * behind the front line when screened, or spread out on row 3 alone when not —
 * which is what decides whether a bruiser dives them.
 */
function build(tag: string, spec: Spec[], itemTier: number, augments: string[],
  plan: string[] | null, screened: boolean): BattleSideInput {
  let front = 0, back = 0;
  const units = spec.map((s, i) => ({
    instanceId: `${tag}${i}`,
    unitDefId: s.id,
    star: s.star,
    items: itemsFor(s, itemTier),
    position: s.front
      ? { q: front++ % 7, r: 0 }
      : screened ? { q: back++ % 7, r: 1 } : { q: (back++ * 3) % 7, r: 3 },
  }));
  const carryIndex = spec.findIndex((s) => !s.front);
  const carry = units[carryIndex >= 0 ? carryIndex : 0];
  return {
    playerId: tag, augments, tacticianItems: [], units,
    racePlan: plan ? {
      entryUnitDefId: carry.unitDefId,
      entryInstanceId: carry.instanceId,
      nodeIds: plan,
      trackState: 'STANDARD',
    } : undefined,
  };
}

const CONDITIONS: Array<{ label: string; conditions: RaceConditions; theme: string }> = [
  { label: '미들·양호', conditions: { going: 'FIRM', pace: 'MIDDLE', weather: 'CLEAR', clause: 'NONE' }, theme: 'ARIMA' },
  { label: '하이페이스', conditions: { going: 'GOOD', pace: 'HIGH', weather: 'CLOUDY', clause: 'NONE' }, theme: 'SPRINTERS' },
  { label: '슬로페이스', conditions: { going: 'GOOD', pace: 'SLOW', weather: 'CLOUDY', clause: 'NONE' }, theme: 'TENNO_SPRING' },
  { label: '불량·비', conditions: { going: 'SOFT', pace: 'MIDDLE', weather: 'RAIN', clause: 'NONE' }, theme: 'FEBRUARY' },
  { label: '특례·장직선', conditions: { going: 'GOOD', pace: 'MIDDLE', weather: 'CLEAR', clause: 'LONG_STRAIGHT' }, theme: 'ARC' },
];

// -------------------------------------------------------------------- sweep

type Cell = { wins: number; games: number };
const overall = new Map<string, Cell>();
const pairs = new Map<string, Cell>();
const dims = new Map<string, Map<string, Cell>>();

function bump(map: Map<string, Cell>, key: string, won: boolean): void {
  const cell = map.get(key) ?? { wins: 0, games: 0 };
  cell.games += 1;
  if (won) cell.wins += 1;
  map.set(key, cell);
}

let battles = 0;
for (const A of NAMES) {
  for (const B of NAMES) {
    if (A === B) continue;
    for (let tier = 0; tier <= 2; tier += 1) {
      for (const augments of AUGMENT_SETS) {
        for (const plan of PLAN_SETS) {
          for (const screened of [true, false]) {
            for (let ci = 0; ci < CONDITIONS.length; ci += 1) {
              const cond = CONDITIONS[ci];
              for (let seed = 0; seed < FIGHTS; seed += 1) {
                const result = simulateBattle(
                  build('a', ARCHETYPES[A], tier, augments, plan, screened),
                  build('b', ARCHETYPES[B], tier, augments, plan, screened),
                  Rng.forStream(seed * 7919 + ci, 'mx:' + A + ':' + B),
                  { conditions: cond.conditions, g1ThemeId: cond.theme },
                );
                battles += 1;
                const won = result.winner === 'A';
                bump(overall, A, won);
                bump(pairs, A + SEP + B, won);
                const tags: Array<[string, string]> = [
                  ['아이템', ['없음', '1개', '2개'][tier]],
                  ['증강', augments.length ? '있음' : '없음'],
                  ['레이스플랜', plan ? '있음' : '없음'],
                  ['배치', screened ? '캐리 보호' : '캐리 노출'],
                  ['컨디션', cond.label],
                ];
                for (const [dim, label] of tags) {
                  const m = dims.get(dim) ?? new Map<string, Cell>();
                  dims.set(dim, m);
                  bump(m, A + SEP + label, won);
                }
              }
            }
          }
        }
      }
    }
  }
}

// ------------------------------------------------------------------ report

const pct = (cell: Cell): number => (100 * cell.wins) / Math.max(1, cell.games);
const width = (s: string): number => [...s].reduce((w, ch) => w + (ch.charCodeAt(0) > 127 ? 2 : 1), 0);
const pad = (s: string, n: number): string => s + ' '.repeat(Math.max(0, n - width(s)));

console.log('matchup matrix — ' + battles.toLocaleString() + ' battles, ' + FIGHTS + ' seeds per cell');

console.log('\n전체 승률 (모든 조건 통합)');
const ranked = NAMES.map((n) => [n, pct(overall.get(n)!)] as const).sort((a, b) => b[1] - a[1]);
for (const [name, value] of ranked) console.log('  ' + pad(name, 12) + value.toFixed(1).padStart(5) + '%');
console.log('  스프레드 ' + (ranked[0][1] - ranked[ranked.length - 1][1]).toFixed(1) + '포인트');

console.log('\n매치업 표 (행이 열을 이길 확률)');
console.log('  ' + pad('', 12) + NAMES.map((n) => pad(n, 11)).join(''));
for (const A of NAMES) {
  const row = NAMES.map((B) => (A === B ? pad('—', 11)
    : pad(pct(pairs.get(A + SEP + B)!).toFixed(0) + '%', 11)));
  console.log('  ' + pad(A, 12) + row.join(''));
}

for (const [dim, m] of dims) {
  const labels = [...new Set([...m.keys()].map((k) => k.split(SEP)[1]))];
  console.log('\n조건: ' + dim);
  console.log('  ' + pad('', 12) + labels.map((l) => pad(l, 13)).join(''));
  for (const A of NAMES) {
    const row = labels.map((l) => {
      const cell = m.get(A + SEP + l);
      return pad(cell ? pct(cell).toFixed(0) + '%' : '—', 13);
    });
    console.log('  ' + pad(A, 12) + row.join(''));
  }
}

console.log('\n조건에 따라 가장 크게 흔들리는 덱 (최대 − 최소 승률)');
const swings: Array<[string, string, number, string, string]> = [];
for (const [dim, m] of dims) {
  for (const A of NAMES) {
    const entries = [...m.entries()]
      .filter(([k]) => k.startsWith(A + SEP))
      .map(([k, v]) => [k.split(SEP)[1], pct(v)] as const);
    if (entries.length < 2) continue;
    const hi = entries.reduce((x, y) => (y[1] > x[1] ? y : x));
    const lo = entries.reduce((x, y) => (y[1] < x[1] ? y : x));
    swings.push([A, dim, hi[1] - lo[1], lo[0] + ' ' + lo[1].toFixed(0) + '%', hi[0] + ' ' + hi[1].toFixed(0) + '%']);
  }
}
for (const [deck, dim, delta, lo, hi] of swings.sort((a, b) => b[2] - a[2]).slice(0, 14)) {
  console.log('  ' + pad(deck, 12) + pad(dim, 12) + delta.toFixed(1).padStart(5) + 'p   '
    + pad(lo, 20) + '→ ' + hi);
}

console.log('\n덱별 활성 특성');
for (const [name, spec] of Object.entries(ARCHETYPES)) {
  const counts = new Map<TraitId, Set<string>>();
  for (const s of spec) {
    for (const t of getUnitTraits(s.id, 's1')) {
      const set = counts.get(t) ?? new Set<string>();
      set.add(s.id);
      counts.set(t, set);
    }
  }
  const active = [...counts]
    .filter(([t, ids]) => activeTierIndex(getTrait(t), ids.size) >= 0)
    .map(([t, ids]) => getTrait(t).name + ids.size);
  console.log('  ' + pad(name, 12) + pad(active.length + '개', 5) + ' ' + active.join(' '));
}
