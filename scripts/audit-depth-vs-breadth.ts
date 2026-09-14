/**
 * The player report this answers, in its own words:
 *
 *   "ai보면 못해도 특정 시너지 6,8로 키고 … 10~11개는 킨 내가 밀리고"
 *   "밸류를 금방 맞출수는 있지만, 2,3코 리롤을 이길 밸류가 안나온다"
 *
 * Two separate claims, so two separate measurements:
 *
 *  1. **깊이 대 넓이** — is one trait at tier 3 worth more than ten at tier 1?
 *     Both boards are eight units of the same cost skeleton, so the only thing
 *     that differs is how the traits are spread.
 *  2. **리롤 대 밸류** — a fully three-starred 2/3-cost board against a
 *     high-cost board, at the gold each actually costs to assemble.
 *
 * And a third the report could not see: what one gold buys at each cost and
 * star, which is where the answer to "is it the synergy or the 2/3-cost units"
 * has to come from.
 *
 *   npm run audit:depth-vs-breadth
 */
import { writeFileSync } from 'node:fs';
import { simulateBattle, type BattleSideInput } from '../src/game/engine/battle/engine';
import { Rng } from '../src/game/engine/rng';
import { getSeasonUnits, getUnitTraits } from '../src/game/engine/roster';
import { activeTierIndex, getTrait } from '../src/game/engine/traits/trait-defs';
import { BASE_AD, BASE_HP, BASE_RESIST, starStatMultiplier } from '../src/game/engine/constants';
import { DEFAULT_CONDITIONS, type RaceConditions } from '../src/game/engine/race-plan/conditions';
import type { Cost, TraitId } from '../src/game/engine/types';

const LINES: string[] = [];
const say = (line = ''): void => { LINES.push(line); console.log(line); };
const width = (s: string): number => [...s].reduce((w, ch) => w + (ch.charCodeAt(0) > 127 ? 2 : 1), 0);
const pad = (s: string, n: number): string => s + ' '.repeat(Math.max(0, n - width(s)));

const s1 = getSeasonUnits('s1');
const isFront = (r: string): boolean => r === 'TANK' || r === 'BRUISER';
const traitsOf = (id: string): TraitId[] => getUnitTraits(id, 's1');

type Spec = { id: string; star: 1 | 2 | 3; front: boolean };

/** Active traits and the deepest tier reached, for a finished board. */
function traitProfile(spec: Spec[]): { active: TraitId[]; tiers: Map<TraitId, number> } {
  const counts = new Map<TraitId, Set<string>>();
  for (const s of spec) {
    for (const t of traitsOf(s.id)) {
      const set = counts.get(t) ?? new Set<string>();
      set.add(s.id);
      counts.set(t, set);
    }
  }
  const tiers = new Map<TraitId, number>();
  const active: TraitId[] = [];
  for (const [id, set] of counts) {
    const tier = activeTierIndex(getTrait(id), set.size);
    if (tier >= 0) { active.push(id); tiers.set(id, tier); }
  }
  return { active, tiers };
}

const describe = (spec: Spec[]): string => {
  const { active, tiers } = traitProfile(spec);
  const deep = [...tiers].filter(([, t]) => t >= 1)
    .sort((a, b) => b[1] - a[1])
    .map(([id, t]) => getTrait(id).name + (t + 1) + '단계');
  return `활성 ${active.length}개` + (deep.length ? ` · 깊은 것: ${deep.slice(0, 4).join(', ')}` : ' · 전부 1단계');
};

/**
 * Greedy board builders, free to pick any unit of the given cost band.
 *
 * A fixed cost-and-role skeleton was too tight to express the difference: both
 * objectives ran out of candidates in every slot and returned the same eight
 * units with the same trait profile, so the first run measured nothing. Only
 * the cost *band* and the four-front/four-back shape are held now, and the
 * gold each board costs is reported so the reader can see what it paid.
 *
 * `deep` keeps picking the unit that pushes an already-started trait a tier
 * further; `broad` keeps picking the one that switches on a trait nobody has.
 */
function build(shape: 'deep' | 'broad', costs: Cost[], star: 1 | 2 | 3 = 2): Spec[] {
  const chosen: Spec[] = [];
  const have = new Map<TraitId, number>();
  for (let slot = 0; slot < 8; slot += 1) {
    const front = slot < 4;
    const fits = s1.filter((u) => costs.includes(u.cost as Cost) && isFront(u.role) === front
      && !chosen.some((c) => c.id === u.id));
    if (!fits.length) throw new Error(`no candidate for slot ${slot}`);
    let best = fits[0], bestScore = -Infinity;
    for (const u of fits) {
      let score = 0;
      for (const t of traitsOf(u.id)) {
        const n = have.get(t) ?? 0;
        const before = activeTierIndex(getTrait(t), n);
        const after = activeTierIndex(getTrait(t), n + 1);
        score += shape === 'deep'
          // Reaching a deeper tier is the whole point; progress toward the next
          // one is worth something; switching on a brand-new trait is worth 0.
          ? (after > before ? 6 + 4 * after : n > 0 ? 2 : 0)
          // The mirror image: only a newly-active trait pays.
          : (before < 0 && after >= 0 ? 6 : 0);
      }
      if (score > bestScore) { bestScore = score; best = u; }
    }
    for (const t of traitsOf(best.id)) have.set(t, (have.get(t) ?? 0) + 1);
    chosen.push({ id: best.id, star, front });
  }
  return chosen;
}

function side(tag: string, spec: Spec[], augments: string[] = []): BattleSideInput {
  let f = 0, b = 0;
  return {
    playerId: tag, augments, tacticianItems: [],
    units: spec.map((s, i) => ({
      instanceId: tag + i, unitDefId: s.id, star: s.star, items: [],
      position: s.front ? { q: f++ % 4, r: 0 } : { q: b++ % 4, r: 1 },
    })),
  };
}

const CONDS: RaceConditions[] = [
  DEFAULT_CONDITIONS,
  { going: 'FIRM', pace: 'MIDDLE', weather: 'CLEAR', clause: 'NONE' },
  { going: 'GOOD', pace: 'HIGH', weather: 'CLOUDY', clause: 'NONE' },
  { going: 'GOOD', pace: 'SLOW', weather: 'CLOUDY', clause: 'NONE' },
  { going: 'SOFT', pace: 'MIDDLE', weather: 'RAIN', clause: 'NONE' },
];

function duel(a: Spec[], b: Spec[], augA: string[] = [], augB: string[] = [], n = 500): number {
  let wins = 0;
  for (let i = 0; i < n; i += 1) {
    const r = simulateBattle(side('a', a, augA), side('b', b, augB), Rng.forStream(i, 'dvb'),
      { conditions: CONDS[i % CONDS.length], g1ThemeId: 'ARIMA' });
    if (r.winner === 'A') wins += 1;
  }
  return (wins / n) * 100;
}

/** What the board cost to assemble, ignoring rerolls (which favours reroll boards). */
const gold = (spec: Spec[]): number =>
  spec.reduce((n, s) => n + s1.find((u) => u.id === s.id)!.cost * (s.star === 3 ? 9 : s.star === 2 ? 3 : 1), 0);

// ------------------------------------------------------------ 1. depth vs breadth
say('depth vs breadth audit — 유저 제보 검증');
say('');
/**
 * A board built around one trait, as deep as eight slots allow.
 *
 * The greedy `deep` objective could not get there: every unit activates *some*
 * new trait, so "reached a new tier" fired for almost every candidate and the
 * board came out as broad as the broad one, topping out three units deep. The
 * report describes 6 and 8 of a single trait, so the trait is chosen up front
 * and filled to the limit instead.
 */
function stackTrait(star: 1 | 2 | 3 = 2): { spec: Spec[]; trait: TraitId } {
  let best: { spec: Spec[]; trait: TraitId; depth: number } | null = null;
  const seen = new Set<TraitId>();
  for (const u of s1) for (const t of traitsOf(u.id)) seen.add(t);
  for (const trait of seen) {
    const of = s1.filter((u) => traitsOf(u.id).includes(trait));
    const front = of.filter((u) => isFront(u.role)).slice(0, 4);
    const back = of.filter((u) => !isFront(u.role)).slice(0, 4);
    const depth = front.length + back.length;
    if (depth < 4) continue;
    // Top up to eight from outside the trait, keeping the four/four shape.
    const fillFront = s1.filter((u) => isFront(u.role) && !of.includes(u)).slice(0, 4 - front.length);
    const fillBack = s1.filter((u) => !isFront(u.role) && !of.includes(u)).slice(0, 4 - back.length);
    const spec: Spec[] = [
      ...[...front, ...fillFront].map((u) => ({ id: u.id, star, front: true })),
      ...[...back, ...fillBack].map((u) => ({ id: u.id, star, front: false })),
    ];
    if (!best || depth > best.depth) best = { spec, trait, depth };
  }
  if (!best) throw new Error('no trait deep enough to stack');
  return { spec: best.spec, trait: best.trait };
}

const BAND: Cost[] = [1, 2, 3, 4, 5];
const stacked = stackTrait();
const DEEP = stacked.spec;
const BROAD = build('broad', BAND);
const depthOf = (spec: Spec[], t: TraitId): number => spec.filter((s) => traitsOf(s.id).includes(t)).length;
say('1) 깊은 시너지 vs 넓은 시너지 — 8명 전원 2성, 특성 분포만 다름');
say('  깊은 쪽 : ' + getTrait(stacked.trait).name + ' ' + depthOf(DEEP, stacked.trait) + '명 몰빵 — '
  + describe(DEEP) + '   (' + gold(DEEP) + 'g)');
say('  넓은 쪽 : ' + describe(BROAD) + '   (' + gold(BROAD) + 'g)');
if (DEEP.map((d) => d.id).join() === BROAD.map((d) => d.id).join()) {
  say('  ⚠ 두 보드가 동일합니다 — 이 측정은 무효입니다.');
}
const dvb = duel(DEEP, BROAD);
say('  → 깊은 쪽 승률 ' + dvb.toFixed(1) + '%   (50%보다 크면 깊이가 이긴다)');
say('');
say('  특성 수를 사는 증강(다채로운 팀워크)을 넓은 쪽에만 줬을 때');
const dvbAug = duel(DEEP, BROAD, [], ['team_diversity']);
say('  → 깊은 쪽 승률 ' + dvbAug.toFixed(1) + '%   ' + (dvbAug - dvb >= 0 ? '+' : '') + (dvbAug - dvb).toFixed(1) + 'p');
say('  (증강의 특성 상한은 현재 10입니다 — 이전 6에서 이번 PR에 올렸습니다)');
say('');
say('  깊이를 단계별로 — 한 특성에 몇 명까지 몰아야 넓이를 이기는가');
for (const n of [4, 5, 6, 7, 8]) {
  const of = s1.filter((u) => traitsOf(u.id).includes(stacked.trait));
  if (of.length < n) { say('    ' + n + '명   로스터에 ' + of.length + '명뿐'); continue; }
  const front = of.filter((u) => isFront(u.role)).slice(0, Math.min(4, n));
  const back = of.filter((u) => !isFront(u.role)).slice(0, n - front.length);
  const picked = [...front, ...back];
  if (picked.length < n) { say('    ' + n + '명   역할 배분 불가'); continue; }
  const fillF = s1.filter((u) => isFront(u.role) && !picked.includes(u)).slice(0, 4 - front.length);
  const fillB = s1.filter((u) => !isFront(u.role) && !picked.includes(u)).slice(0, 4 - back.length);
  const spec: Spec[] = [
    ...[...front, ...fillF].map((u) => ({ id: u.id, star: 2 as const, front: true })),
    ...[...back, ...fillB].map((u) => ({ id: u.id, star: 2 as const, front: false })),
  ];
  if (spec.length !== 8) { say('    ' + n + '명   슬롯 ' + spec.length + '개 — 건너뜀'); continue; }
  const tier = activeTierIndex(getTrait(stacked.trait), depthOf(spec, stacked.trait));
  const r = duel(spec, BROAD);
  say('    ' + pad(n + '명 (' + (tier + 1) + '단계)', 14) + r.toFixed(1).padStart(5) + '%   '
    + describe(spec).split(' · ')[0]);
}

/**
 * The control both shapes have to beat.
 *
 * Neither greedy picks for unit quality — deep takes whatever shares a trait,
 * broad takes whatever adds one — so a win between them could just as easily be
 * one board having better units. This third board ignores traits entirely and
 * takes the highest per-slot statline at each role, which is the null
 * hypothesis: "traits did nothing, the units did it".
 */
say('');
say('  대조군 — 특성을 아예 무시하고 한 칸당 능력치가 가장 높은 8명');
say('  (두 그리디 모두 유닛의 질을 보고 뽑지 않습니다. 이 대조군을 못 이기면');
say('   그 보드가 이긴 이유는 시너지가 아니라 유닛이었다는 뜻입니다.)');
const slotValue = (id: string): number => {
  const u = s1.find((x) => x.id === id)!;
  const m = starStatMultiplier(2, u.cost as Cost);
  return (BASE_HP[u.cost as Cost] * m / BASE_HP[1] + BASE_AD[u.cost as Cost] * m / BASE_AD[1]) / 2;
};
const byValue = (front: boolean) => s1.filter((u) => isFront(u.role) === front)
  .sort((a, b) => slotValue(b.id) - slotValue(a.id)).slice(0, 4);
const CONTROL: Spec[] = [
  ...byValue(true).map((u) => ({ id: u.id, star: 2 as const, front: true })),
  ...byValue(false).map((u) => ({ id: u.id, star: 2 as const, front: false })),
];
say('  대조군 : ' + describe(CONTROL) + '   (' + gold(CONTROL) + 'g)');
const dc = duel(DEEP, CONTROL);
const bc = duel(BROAD, CONTROL);
say('    깊은 쪽 vs 대조군   ' + dc.toFixed(1).padStart(5) + '%');
say('    넓은 쪽 vs 대조군   ' + bc.toFixed(1).padStart(5) + '%');
say('    → ' + (dc > 55 && bc < 45
  ? '깊이는 유닛 질을 넘어서 이깁니다. 시너지 깊이가 진짜 원인입니다.'
  : dc < 55 && bc < 45
    ? '둘 다 대조군에 못 이깁니다 — 깊은 쪽이 넓은 쪽을 이긴 건 유닛 질 차이였습니다.'
    : '해석 주의 — 아래 본문 참고.'));

// ------------------------------------------------------------ 2. reroll vs value
say('');
say('2) 리롤 vs 밸류 — 유저가 말한 바로 그 대진');
say('   첫 판에서는 3성 리롤덱(207g)을 1성 밸류덱(39g)에 붙여 놓고 대진이라고');
say('   불렀습니다. 5배 차이라 결과가 나올 수밖에 없었습니다. 지금은 유저가');
say('   실제로 말한 구성 — 2·3코 **2성작** — 을 쓰고, 각 덱의 골드를 같이 적습니다.');
say('');
const band = (lo: Cost, hi: Cost, star: 1 | 2 | 3, frontLo?: Cost): Spec[] => {
  const inBand = (u: { cost: number }) => u.cost >= lo && u.cost <= hi;
  const front = s1.filter((u) => isFront(u.role) && (frontLo ? u.cost >= frontLo : inBand(u))).slice(0, 4);
  const back = s1.filter((u) => !isFront(u.role) && inBand(u)).slice(0, 4);
  return [...front.map((u) => ({ id: u.id, star, front: true })),
    ...back.map((u) => ({ id: u.id, star, front: false }))];
};

const DECKS: Array<[string, Spec[]]> = [
  ['리롤 2·3코 2성작', band(2, 3, 2)],
  ['리롤 2·3코 3성작', band(2, 3, 3)],
  ['밸류 4·5코 1성', band(4, 5, 1)],
  ['밸류 4·5코 2성', band(4, 5, 2)],
  ['밸류 4·5코 반2성', band(4, 5, 1).map((u, i) => ({ ...u, star: (i % 2 ? 2 : 1) as 1 | 2 }))],
];
say('  ' + pad('', 20) + pad('골드', 8) + '특성');
for (const [name, deck] of DECKS) {
  say('  ' + pad(name, 20) + pad(gold(deck) + 'g', 8) + describe(deck));
}
say('');
say('  ' + pad('', 20) + DECKS.slice(0, 2).map(([n]) => pad(n + ' 상대', 22)).join(''));
for (const [name, deck] of DECKS.slice(2)) {
  say('  ' + pad(name, 20) + DECKS.slice(0, 2).map(([, opp]) => {
    const r = duel(deck, opp);
    return pad(r.toFixed(1) + '%' + (r >= 50 ? ' 밸류승' : ' 리롤승'), 22);
  }).join(''));
}

// ------------------------------------------------------------ 3. gold efficiency
say('');
say('3) 골드 1당 능력치 — "시너지 문제인가 2·3코 성능 문제인가"의 답은 여기에 있다');
say('  기물 값 = 코스트 × (1성 1장 · 2성 3장 · 9성 9장). 리롤 비용은 뺀 값이라');
say('  리롤덱 쪽에 유리하게 잡힌 수치입니다.');
say('');
say('  보드는 8칸뿐이라 실전에서 더 중요한 것은 골드당이 아니라 **한 칸당** 값입니다.');
say('');
say('  ' + pad('', 10) + pad('골드', 8) + pad('체력', 9) + pad('공격력', 9) + pad('방어', 8)
  + pad('골드당', 12) + '한 칸당');
const rows: Array<[string, number, number]> = [];
const perSlot: Array<[string, number]> = [];
for (const cost of [1, 2, 3, 4, 5] as Cost[]) {
  for (const star of [1, 2, 3] as const) {
    const copies = star === 3 ? 9 : star === 2 ? 3 : 1;
    const g = cost * copies;
    const m = starStatMultiplier(star, cost);
    const hp = BASE_HP[cost] * m, ad = BASE_AD[cost] * m, res = BASE_RESIST[cost] * m;
    // One index so the tiers can be ranked: health and damage weighted equally.
    const total = (hp / BASE_HP[1] + ad / BASE_AD[1]) / 2;
    rows.push([`${cost}코 ${star}성`, g, total / g]);
    perSlot.push([`${cost}코 ${star}성`, total]);
    say('  ' + pad(`${cost}코 ${star}성`, 10) + pad(g + 'g', 8)
      + pad(Math.round(hp).toString(), 9) + pad(Math.round(ad).toString(), 9)
      + pad(Math.round(res).toString(), 8) + pad((total / g).toFixed(3), 12)
      + total.toFixed(2));
  }
}
say('');
say('  한 칸당 순위 — 8칸을 무엇으로 채울지의 답');
for (const [name, v] of [...perSlot].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  say('    ' + pad(name, 10) + v.toFixed(2));
}
say('');
say('  설계 의도와 대조 — "4코2성 ≈ 2코3성 바로 아래, 5코2성 ≈ 3코3성"');
const look = (n: string): number => perSlot.find(([k]) => k === n)![1];
say('    4코 2성 ' + look('4코 2성').toFixed(2) + '  vs  2코 3성 ' + look('2코 3성').toFixed(2)
  + '   → ' + (look('4코 2성') < look('2코 3성') ? '의도대로 (조금 아래)' : '의도와 다름'));
say('    5코 2성 ' + look('5코 2성').toFixed(2) + '  vs  3코 3성 ' + look('3코 3성').toFixed(2)
  + '   → ' + (Math.abs(look('5코 2성') - look('3코 3성')) < 0.3 ? '의도대로 (거의 같음)' : '의도와 다름'));

const out = process.argv.indexOf('--out');
if (out >= 0 && process.argv[out + 1]) {
  writeFileSync(process.argv[out + 1], LINES.join('\n') + '\n');
  console.log('\nwrote ' + process.argv[out + 1]);
}
