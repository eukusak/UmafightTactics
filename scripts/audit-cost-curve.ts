/**
 * Deck-shape matchup audit.
 *
 * The 250-match simulator measures whole matches; this measures the specific
 * question a balance report usually asks — "why did my deck lose to that one" —
 * by building the realistic deck shapes directly and fighting them.
 *
 * Added after a player report of a four-cost board losing every fight. The cause
 * was that one star level outweighed six cost steps, which whole-match averages
 * hid completely: profile placements looked healthy while an entire cost tier
 * had quietly become unfieldable.
 *
 *   npm run audit:cost-curve
 */
import { simulateBattle, type BattleSideInput } from '../src/game/engine/battle/engine';
import { Rng } from '../src/game/engine/rng';
import { getSeasonUnits } from '../src/game/engine/roster';
import { DEFAULT_CONDITIONS } from '../src/game/engine/race-plan/conditions';
import { BASE_AD, BASE_HP, starStatMultiplier } from '../src/game/engine/constants';
import type { Cost } from '../src/game/engine/types';

const FIGHTS = Number(process.argv[process.argv.indexOf('--fights') + 1]) || 200;
const s1 = getSeasonUnits('s1');
const pick = (cost: number, role: 'front' | 'carry', n: number) =>
  s1.filter((u) => u.cost === cost
    && (role === 'front' ? (u.role === 'TANK' || u.role === 'BRUISER') : (u.role === 'AD_CARRY' || u.role === 'AP_CARRY')))
    .slice(0, n);

type Spec = { id: string; star: 1 | 2 | 3; front: boolean };
function side(tag: string, spec: Spec[]): BattleSideInput {
  let f = 0, b = 0;
  return { playerId: tag, augments: [], tacticianItems: [],
    units: spec.map((s, i) => ({ instanceId: `${tag}${i}`, unitDefId: s.id, star: s.star, items: [],
      position: s.front ? { q: f++, r: 3 } : { q: b++, r: 0 } })) };
}
function rate(A: Spec[], B: Spec[]): number {
  let a = 0;
  for (let i = 0; i < FIGHTS; i += 1) {
    if (simulateBattle(side('a', A), side('b', B), Rng.forStream(i, 'cost-curve'),
      { conditions: DEFAULT_CONDITIONS, g1ThemeId: 'ARIMA' }).winner === 'A') a += 1;
  }
  return (a / FIGHTS) * 100;
}

// --- the deck shapes people actually build at level 8-9
const valueDeck = (carryStar: 1 | 2): Spec[] => [
  ...pick(1, 'front', 2).map((u) => ({ id: u.id, star: 2 as const, front: true })),
  ...pick(2, 'front', 2).map((u) => ({ id: u.id, star: 2 as const, front: true })),
  ...pick(4, 'carry', 3).map((u) => ({ id: u.id, star: carryStar, front: false })),
  ...pick(5, 'carry', 1).map((u) => ({ id: u.id, star: 1 as const, front: false })),
];
const rerollDeck: Spec[] = [
  ...pick(1, 'front', 2).map((u) => ({ id: u.id, star: 3 as const, front: true })),
  ...pick(2, 'front', 2).map((u) => ({ id: u.id, star: 2 as const, front: true })),
  ...pick(3, 'carry', 4).map((u) => ({ id: u.id, star: 2 as const, front: false })),
];
const midDeck: Spec[] = [
  ...pick(2, 'front', 2).map((u) => ({ id: u.id, star: 2 as const, front: true })),
  ...pick(3, 'front', 2).map((u) => ({ id: u.id, star: 2 as const, front: true })),
  ...pick(3, 'carry', 4).map((u) => ({ id: u.id, star: 2 as const, front: false })),
];
// A reroll board that puts its three-star into the *front line*, which is what
// actually punishes a thin front. The generic reroll deck above cannot.
const frontHeavyReroll: Spec[] = [
  ...pick(2, 'front', 3).map((u, i) => ({ id: u.id, star: (i === 0 ? 3 : 2) as 2 | 3, front: true })),
  ...pick(3, 'front', 1).map((u) => ({ id: u.id, star: 2 as const, front: true })),
  ...pick(3, 'carry', 4).map((u) => ({ id: u.id, star: 2 as const, front: false })),
];
// A pure high-cost board. The four-cost tier has two front-liners in the whole
// season, so eight slots cannot hold a line — this is meant to stay weak against
// a board built to exploit that, and it is the shape the player report used.
const stackedFourCost: Spec[] = [
  ...pick(4, 'front', 2).map((u, i) => ({ id: u.id, star: (i < 1 ? 2 : 1) as 1 | 2, front: true })),
  ...pick(4, 'carry', 6).map((u, i) => ({ id: u.id, star: (i < 3 ? 2 : 1) as 1 | 2, front: false })),
];

const rows: Array<[string, number, [number, number] | null]> = [
  ['밸류덱(고코 캐리 1성) vs 리롤덱', rate(valueDeck(1), rerollDeck), [35, 60]],
  ['밸류덱(고코 캐리 2성) vs 리롤덱', rate(valueDeck(2), rerollDeck), [60, 100]],
  ['밸류덱(고코 캐리 1성) vs 중코덱', rate(valueDeck(1), midDeck), [40, 70]],
  ['리롤덱 vs 중코덱', rate(rerollDeck, midDeck), [55, 95]],
  ['4코 도배덱 vs 앞줄 두꺼운 리롤덱 (앞줄 부족)', rate(stackedFourCost, frontHeavyReroll), [0, 35]],
  ['4코 도배덱 vs 일반 리롤덱', rate(stackedFourCost, rerollDeck), [40, 80]],
];
console.log(`deck matchups — ${FIGHTS} fights each\n`);
let failed = 0;
for (const [label, value, band] of rows) {
  const ok = !band || (value >= band[0] && value <= band[1]);
  if (!ok) failed += 1;
  console.log(`  ${label.padEnd(46)} ${value.toFixed(1).padStart(5)}%  ${band ? `[${band[0]}-${band[1]}]` : ''} ${ok ? '' : '  <-- 밴드 밖'}`);
}

console.log('\ncost ladder (hp / ad at each star):');
for (const cost of [1, 2, 3, 4, 5] as Cost[]) {
  const line = [1, 2, 3].map((st) => {
    const m = starStatMultiplier(st, cost);
    return `${(BASE_HP[cost] * m).toFixed(0)}/${(BASE_AD[cost] * m).toFixed(0)}`.padStart(10);
  });
  console.log(`  ${cost}코 ${line.join(' ')}${cost >= 4 ? '   (3성 도달 불가)' : ''}`);
}
console.log(failed ? `\naudit:cost-curve — ${failed}건 밴드 밖` : '\naudit:cost-curve — OK');
if (failed && process.argv.includes('--strict')) process.exit(1);
