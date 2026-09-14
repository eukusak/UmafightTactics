/**
 * Which 각질 pairings are actually worth making?
 *
 * An emblem can turn a carry into 선입+선행, 도주+선행, 추입+선입 and so on.
 * Under BLEND the unit's numeric curve becomes the mean of the two, so on paper
 * it has "both styles" — but a mean is not a sum, and the emblem costs an item
 * slot. Whether a given pairing is worth it is therefore a real question with a
 * different answer per pair, and this enumerates all twelve.
 *
 * Two things are reported side by side:
 *
 *  1. the blended curve, so the shape of the trade is visible; and
 *  2. the measured win rate **with the slot paid** — the opponent holds a real
 *     item in the slot the emblem occupies, which is the choice a player makes.
 *
 *   npm run audit:style-pairs
 */
import { writeFileSync } from 'node:fs';
import { simulateBattle, type BattleSideInput } from '../src/game/engine/battle/engine';
import { Rng } from '../src/game/engine/rng';
import { getSeasonUnits, getUnitTraits } from '../src/game/engine/roster';
import { getTrait } from '../src/game/engine/traits/trait-defs';
import { RUN_STYLES, styleStepAt } from '../src/game/engine/race-plan/style-curve';
import { DEFAULT_CONDITIONS, PACE_DEFS, type RaceConditions } from '../src/game/engine/race-plan/conditions';
import type { RaceCombatPhase } from '../src/game/engine/race-plan/types';
import type { RunStyle } from '../src/game/engine/types';

const LINES: string[] = [];
const say = (line = ''): void => { LINES.push(line); console.log(line); };
const width = (s: string): number => [...s].reduce((w, ch) => w + (ch.charCodeAt(0) > 127 ? 2 : 1), 0);
const pad = (s: string, n: number): string => s + ' '.repeat(Math.max(0, n - width(s)));

const EMBLEM: Record<RunStyle, string> = {
  nige: 'emblem_nige', senko: 'emblem_senko', sashi: 'emblem_sashi', oikomi: 'emblem_oikomi',
};
/** What the emblem gives up: a real damage item in the same slot. */
const RIVAL_ITEM = 'champion_trophy';
const PHASES: RaceCombatPhase[] = ['START', 'POSITIONING', 'LATE', 'LAST_3F'];
const PHASE_KO = ['발주', '중반', '4코너', '최종직선'];

const s1 = getSeasonUnits('s1');
const isFront = (r: string): boolean => r === 'TANK' || r === 'BRUISER';
const styleOf = (id: string): RunStyle | null =>
  RUN_STYLES.find((st) => getUnitTraits(id, 's1').includes(st)) ?? null;

// -------------------------------------------------------------- the curve table
const blend = (a: RunStyle, b: RunStyle, p: RaceCombatPhase, key: 'damage' | 'resist'): number =>
  (styleStepAt(a, p)[key] + styleStepAt(b, p)[key]) / 2;
const pct = (v: number): string => (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%';

say('style pair audit — 인자로 만들어지는 각질 조합 12가지');
say('');
say('1) 혼합 곡선 — BLEND는 합이 아니라 평균이다');
say('  ' + pad('', 14) + PHASE_KO.map((p) => pad(p, 11)).join('') + '초반 피해감소');
for (const st of RUN_STYLES) {
  say('  ' + pad(getTrait(st).name + ' (단독)', 14)
    + PHASES.map((p) => pad(pct(styleStepAt(st, p).damage), 11)).join('')
    + pct(styleStepAt(st, 'START').resist));
}
say('  ' + '-'.repeat(64));
type Pair = [RunStyle, RunStyle];
const PAIRS: Pair[] = [];
for (let i = 0; i < RUN_STYLES.length; i += 1) {
  for (let j = i + 1; j < RUN_STYLES.length; j += 1) PAIRS.push([RUN_STYLES[i], RUN_STYLES[j]]);
}
const straight = (p: Pair): number => blend(p[0], p[1], 'LAST_3F', 'damage');
for (const p of [...PAIRS].sort((a, b) => straight(b) - straight(a))) {
  say('  ' + pad(getTrait(p[0]).name + '+' + getTrait(p[1]).name, 14)
    + PHASES.map((ph) => pad(pct(blend(p[0], p[1], ph, 'damage')), 11)).join('')
    + pct(blend(p[0], p[1], 'START', 'resist')));
}
say('');
say('  전투의 99.6%가 최종직선까지 가므로 마지막 열이 사실상 성적표입니다.');
say('  도주를 섞으면 그 열이 내려가고(도주 단독 −8%), 추입을 섞으면 올라갑니다.');

// ------------------------------------------------------------------- measurement
type Spec = { id: string; star: 1 | 2 | 3; front: boolean; items: string[] };

/** Four carries that all natively run `native`, behind a fixed front line. */
function board(native: RunStyle, emblem: RunStyle | null, payRival = false,
  star: 1 | 2 | 3 = 2): Spec[] | null {
  const front = s1.filter((u) => isFront(u.role) && u.cost <= 2).slice(0, 4);
  const back = s1.filter((u) => !isFront(u.role) && styleOf(u.id) === native).slice(0, 4);
  if (back.length < 4) return null;
  return [
    ...front.map((u) => ({ id: u.id, star: 2 as const, front: true, items: [] })),
    ...back.map((u) => ({
      id: u.id, star, front: false,
      items: emblem ? [EMBLEM[emblem]] : payRival ? [RIVAL_ITEM] : [],
    })),
  ];
}

/** Mean cost of the four carries a row uses, for reading the table across rows. */
const carryCost = (native: RunStyle): number => {
  const back = s1.filter((u) => !isFront(u.role) && styleOf(u.id) === native).slice(0, 4);
  return back.reduce((n, u) => n + u.cost, 0) / Math.max(1, back.length);
};

function side(tag: string, spec: Spec[]): BattleSideInput {
  let f = 0, b = 0;
  return {
    playerId: tag, augments: [], tacticianItems: [],
    units: spec.map((s, i) => ({
      instanceId: tag + i, unitDefId: s.id, star: s.star, items: s.items,
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

function duel(a: Spec[], b: Spec[], conds = CONDS, n = 400): number {
  let wins = 0;
  for (let i = 0; i < n; i += 1) {
    const r = simulateBattle(side('a', a), side('b', b), Rng.forStream(i, 'pairs'),
      { conditions: conds[i % conds.length], g1ThemeId: 'ARIMA' });
    if (r.winner === 'A') wins += 1;
  }
  return (wins / n) * 100;
}

say('');
say('2) 실제 승률 — 인자를 낀 보드 vs 같은 슬롯에 진짜 아이템을 낀 보드');
say('   50%가 손익분기입니다. 그 아래면 인자 대신 아이템을 끼는 게 낫습니다.');
say('   (상대는 같은 유닛·같은 배치. 차이는 그 한 칸뿐입니다.)');
say('');
say('  ' + pad('타고난 각질', 14) + RUN_STYLES.map((st) => pad('+' + getTrait(st).name, 12)).join('')
  + '캐리 평균 코스트');
const results = new Map<string, number>();
for (const native of RUN_STYLES) {
  const rival = board(native, null, true);
  if (!rival) { say('  ' + pad(getTrait(native).name, 14) + '이 각질의 후열 유닛이 4명이 안 됩니다'); continue; }
  const cells = RUN_STYLES.map((em) => {
    if (em === native) return pad('—', 12);
    const mine = board(native, em);
    if (!mine) return pad('—', 12);
    const v = duel(mine, rival);
    results.set(native + '+' + em, v);
    return pad(v.toFixed(1) + '%', 12);
  });
  say('  ' + pad(getTrait(native).name, 14) + cells.join('') + carryCost(native).toFixed(2) + '코');
}
say('');
say('  행끼리는 유닛이 달라 직접 비교하면 안 됩니다 — 각 행은 "같은 유닛에');
say('  인자냐 아이템이냐"만 비교한 값입니다. 다만 캐리 평균 코스트와 성적이');
say('  같이 움직이는 것이 눈에 띄어, 4절에서 따로 통제해 확인합니다.');

say('');
const ranked = [...results].sort((a, b) => b[1] - a[1]);
say('  순위 — 인자를 낄 값이 있는 조합');
for (const [k, v] of ranked) {
  const [a, b] = k.split('+') as Pair;
  say('    ' + pad(getTrait(a).name + ' 기물 + ' + getTrait(b).name + ' 인자', 24)
    + v.toFixed(1).padStart(5) + '%   ' + (v >= 50 ? '낄 만함' : '아이템이 낫다'));
}

say('');
say('3) 페이스가 바뀌면 답도 바뀌는가');
say('   하이페이스는 도주를 0.55배로 죽이고 추입을 1.45배로 살립니다.');
say('');
say('  ' + pad('조합', 24) + PACE_DEFS.map((p) => pad(p.nameKo, 13)).join(''));
for (const [k] of ranked.slice(0, 6)) {
  const [native, em] = k.split('+') as Pair;
  const mine = board(native, em)!;
  const rival = board(native, null, true)!;
  const row = PACE_DEFS.map((p) => {
    const v = duel(mine, rival, [{ ...DEFAULT_CONDITIONS, pace: p.id }], 300);
    return pad(v.toFixed(1) + '%', 13);
  });
  say('  ' + pad(getTrait(native).name + ' + ' + getTrait(em).name + ' 인자', 24) + row.join(''));
}

// --------------------------------------------------- 4. why cheap carries differ
/**
 * The cross-row pattern needs a controlled test before it can be believed.
 *
 * `champion_trophy` is +20% attack damage: its value rides on the stat the unit
 * already has, while a trait tier pays the same flat bonus to anyone. So the
 * emblem should look better the weaker the holder is. Star level moves exactly
 * that, on the same four units, which is the control the table above lacks.
 */
say('');
say('4) 왜 싼 캐리에서 인자가 더 좋아 보이는가 — 같은 유닛, 성수만 바꿔서 확인');
say('   연승 사냥꾼의 트로피는 공격력 +20%라 원래 센 유닛일수록 값이 큽니다.');
say('   반면 특성 단계 보너스는 누구에게나 같은 값입니다. 성수를 올리면');
say('   아이템 쪽만 커지므로, 인자의 상대 가치는 내려가야 맞습니다.');
say('');
say('  ' + pad('보드', 22) + [1, 2, 3].map((st) => pad(st + '성', 12)).join(''));
for (const native of RUN_STYLES) {
  if (!board(native, null, true)) continue;
  const em: RunStyle = native === 'oikomi' ? 'nige' : 'oikomi';
  const row = ([1, 2, 3] as const).map((st) => {
    const mine = board(native, em, false, st)!;
    const rival = board(native, null, true, st)!;
    return pad(duel(mine, rival, CONDS, 300).toFixed(1) + '%', 12);
  });
  say('  ' + pad(getTrait(native).name + ' + ' + getTrait(em).name + ' 인자', 22) + row.join(''));
}
say('');
say('  → 성수가 오를수록 값이 내려가면 가설이 맞습니다: 인자는 약한 기물에게,');
say('    아이템은 이미 센 기물에게. 오르거나 평평하면 코스트 설명은 틀린 것이고,');
say('    2절의 행간 차이는 유닛 구성 차이로 봐야 합니다.');

const out = process.argv.indexOf('--out');
if (out >= 0 && process.argv[out + 1]) {
  writeFileSync(process.argv[out + 1], LINES.join('\n') + '\n');
  console.log('\nwrote ' + process.argv[out + 1]);
}
