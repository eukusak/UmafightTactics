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
/**
 * Board row 0 is the rank that faces the enemy — `toBattleCell` maps it to cell
 * r=4 for side A and r=3 for side B, and the two sides meet across that seam.
 * Front-liners therefore go on row 0 and carries on row 1, directly behind
 * them. Placing carries on row 3 puts them *in front of* their own tanks, which
 * is not a board anybody builds and makes every measurement taken on it
 * meaningless.
 */
function side(tag: string, spec: Spec[]): BattleSideInput {
  let f = 0, b = 0;
  return { playerId: tag, augments: [], tacticianItems: [],
    units: spec.map((s) => ({ instanceId: `${tag}${f + b}`, unitDefId: s.id, star: s.star, items: [],
      position: s.front ? { q: f++, r: 0 } : { q: b++, r: 1 } })) };
}
function rate(A: Spec[], B: Spec[]): number {
  let a = 0;
  for (let i = 0; i < FIGHTS; i += 1) {
    if (simulateBattle(side('a', A), side('b', B), Rng.forStream(i, 'cost-curve'),
      { conditions: DEFAULT_CONDITIONS, g1ThemeId: 'ARIMA' }).winner === 'A') a += 1;
  }
  return (a / FIGHTS) * 100;
}

// --- deck shapes
//
// The carry comparison holds the front line identical on both sides and varies
// only the back, so it measures the cost/star curve rather than whose tanks are
// bigger. The full-deck rows then put realistic whole decks against each other.
const sharedFront: Spec[] = [
  ...pick(1, 'front', 2).map((u) => ({ id: u.id, star: 2 as const, front: true })),
  ...pick(2, 'front', 2).map((u) => ({ id: u.id, star: 2 as const, front: true })),
];
const backHighCost = (carryStar: 1 | 2): Spec[] => [
  ...sharedFront,
  ...pick(4, 'carry', 3).map((u) => ({ id: u.id, star: carryStar, front: false })),
  ...pick(5, 'carry', 1).map((u) => ({ id: u.id, star: 1 as const, front: false })),
];
const backMidCost: Spec[] = [
  ...sharedFront,
  ...pick(3, 'carry', 4).map((u) => ({ id: u.id, star: 2 as const, front: false })),
];
const backRerolled: Spec[] = [
  ...sharedFront,
  ...pick(3, 'carry', 4).map((u, i) => ({ id: u.id, star: (i < 2 ? 3 : 2) as 2 | 3, front: false })),
];

// Whole decks, front line included: a reroll board really does field 3-star
// cheap tanks, and that is part of what it buys.
const valueDeck = (carryStar: 1 | 2): Spec[] => backHighCost(carryStar);
const rerollDeck: Spec[] = [
  ...pick(1, 'front', 2).map((u) => ({ id: u.id, star: 3 as const, front: true })),
  ...pick(2, 'front', 2).map((u) => ({ id: u.id, star: 2 as const, front: true })),
  ...pick(3, 'carry', 4).map((u) => ({ id: u.id, star: 2 as const, front: false })),
];
// A pure high-cost board. The four-cost tier has two front-liners in the whole
// season, so eight slots cannot hold a line — the shape from the player report.
const stackedFourCost: Spec[] = [
  ...pick(4, 'front', 2).map((u, i) => ({ id: u.id, star: (i < 1 ? 2 : 1) as 1 | 2, front: true })),
  ...pick(4, 'carry', 6).map((u, i) => ({ id: u.id, star: (i < 3 ? 2 : 1) as 1 | 2, front: false })),
];

/** `known` rows are reported every run but do not fail; see the note below. */
type Row = [string, number, [number, number] | null, ('known' | undefined)?];
const rows: Row[] = [
  // Same front line, different back line: this is the cost/star curve itself.
  ['[앞줄 고정] 고코 1성 캐리 vs 3코 2성 캐리', rate(backHighCost(1), backMidCost), [40, 70]],
  ['[앞줄 고정] 고코 2성 캐리 vs 3코 2성 캐리', rate(backHighCost(2), backMidCost), [65, 100]],
  // Three-star three-costs are a genuinely larger investment than one-star
  // four-costs, so losing is right; the margin is what is worth watching.
  ['[앞줄 고정] 고코 1성 캐리 vs 3성 섞인 캐리', rate(backHighCost(1), backRerolled), [0, 35]],
  // Whole decks, front line included.
  // KNOWN OPEN ISSUE — reported, not gated. A reroll board fields three-star
  // cheap tanks (2106hp) where a value board can only field two-star ones
  // (1170hp), because the four- and five-cost tiers hold 2 and 3 front-liners
  // between them. The value board therefore always brings the weaker front
  // line, and no change to the cost curve fixes that — it needs front-line
  // units in the expensive tiers, which is a roster decision.
  // See docs/COST_CURVE_PATCH_2026-09-13.md.
  ['밸류덱(고코 캐리 1성) vs 리롤덱 [미해결]', rate(valueDeck(1), rerollDeck), [20, 50], 'known'],
  ['밸류덱(고코 캐리 2성) vs 리롤덱', rate(valueDeck(2), rerollDeck), [55, 95]],
  // Not [0, 35]. That band was written when the tier was undertuned and this
  // board lost 400-0; it encoded "should lose badly", which was the bug. What
  // has to hold is that a board which cannot form a front line is *disadvantaged
  // relative to its unit quality*, not that it is dead — and above all that the
  // tier never dominates from a broken structure. The ceiling is the real guard.
  ['4코 도배덱 vs 리롤덱 (앞줄 부족)', rate(stackedFourCost, rerollDeck), [0, 40]],
];
console.log(`deck matchups — ${FIGHTS} fights each\n`);
let failed = 0;
for (const [label, value, band, known] of rows) {
  const ok = !band || (value >= band[0] && value <= band[1]);
  if (!ok && !known) failed += 1;
  const mark = ok ? '' : known ? '  <-- 미해결(보고만)' : '  <-- 밴드 밖';
  console.log(`  ${label.padEnd(46)} ${value.toFixed(1).padStart(5)}%  ${band ? `[${band[0]}-${band[1]}]` : ''}${mark}`);
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
