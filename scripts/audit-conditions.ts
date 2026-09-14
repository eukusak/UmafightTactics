/**
 * Is 레이스 컨디션 variance or decision?
 *
 * The worry is a fair one: the pace axis multiplies a style's whole curve by
 * anything from 0.55 to 1.45, which is the largest single number in the game.
 * If that number lands on a fight the player cannot see coming, it is a coin
 * flip and should go. If it lands in front of them during prep, and a correct
 * response exists that recovers the loss, it is a decision axis.
 *
 * So this measures three separate things:
 *
 *  1. **Swing** — how far each axis moves a fixed matchup, one axis at a time.
 *  2. **Noise floor** — how far the same matchup moves on seed alone, so the
 *     swings above have something to be large *relative to*.
 *  3. **Recoverability** — whether adapting the race plan to the condition wins
 *     back what the condition took. This is the one that decides the question.
 *
 *   npm run audit:conditions
 */
import { writeFileSync } from 'node:fs';
import { simulateBattle, type BattleSideInput } from '../src/game/engine/battle/engine';
import { Rng } from '../src/game/engine/rng';
import { getSeasonUnits, getUnitTraits } from '../src/game/engine/roster';
import { getTrait } from '../src/game/engine/traits/trait-defs';
import {
  CLAUSE_DEFS, DEFAULT_CONDITIONS, GOING_DEFS, PACE_DEFS, WEATHER_DEFS,
  describeConditions, type RaceConditions,
} from '../src/game/engine/race-plan/conditions';
import type { RunStyle } from '../src/game/engine/types';

const LINES: string[] = [];
const say = (line = ''): void => { LINES.push(line); console.log(line); };
const width = (s: string): number => [...s].reduce((w, ch) => w + (ch.charCodeAt(0) > 127 ? 2 : 1), 0);
const pad = (s: string, n: number): string => s + ' '.repeat(Math.max(0, n - width(s)));

const s1 = getSeasonUnits('s1');
const isFront = (role: string): boolean => role === 'TANK' || role === 'BRUISER';
const hasStyle = (id: string, style: RunStyle): boolean => getUnitTraits(id, 's1').includes(style);

type Slot = { cost: number; front: boolean };
/**
 * One cost skeleton, filled twice.
 *
 * 각질 is not spread evenly over the roster — 추입 has no three-cost back-liner
 * at all, so "all the 도주 units against all the 추입 units" silently compares a
 * board of four- and five-costs against a board of ones and twos and reports
 * 100%. Both sides are built from the *same* cost and role slots instead, and
 * the pair is chosen as the one the roster can actually fill on both sides.
 */
const SKELETON: Slot[] = [
  { cost: 1, front: true }, { cost: 2, front: true }, { cost: 2, front: true }, { cost: 3, front: true },
  { cost: 1, front: false }, { cost: 1, front: false }, { cost: 2, front: false }, { cost: 2, front: false },
];

type Board = Array<{ id: string; front: boolean }>;
function styleBoard(style: RunStyle): Board {
  const used = new Set<string>();
  return SKELETON.map((slot) => {
    const pick = s1.find((u) => u.cost === slot.cost && isFront(u.role) === slot.front
      && hasStyle(u.id, style) && !used.has(u.id));
    if (!pick) throw new Error(`roster cannot fill ${slot.cost}${slot.front ? 'F' : 'B'} for ${style}`);
    used.add(pick.id);
    return { id: pick.id, front: slot.front };
  });
}

/** A neutral mid-cost board, used on both sides where only the plan differs. */
function neutralBoard(): Board {
  const used = new Set<string>();
  const spec: Slot[] = [
    { cost: 1, front: true }, { cost: 2, front: true }, { cost: 2, front: true }, { cost: 3, front: true },
    { cost: 3, front: false }, { cost: 3, front: false }, { cost: 4, front: false }, { cost: 4, front: false },
  ];
  return spec.map((slot) => {
    const pick = s1.find((u) => u.cost === slot.cost && isFront(u.role) === slot.front && !used.has(u.id))!;
    used.add(pick.id);
    return { id: pick.id, front: slot.front };
  });
}

function side(tag: string, board: Board, plan: string[] | null): BattleSideInput {
  let f = 0, b = 0;
  const units = board.map((s, i) => ({
    instanceId: tag + i, unitDefId: s.id, star: 2 as const, items: [] as string[],
    position: s.front ? { q: f++ % 4, r: 0 } : { q: b++ % 4, r: 1 },
  }));
  const entry = units[units.length - 1];
  return {
    playerId: tag, augments: [], tacticianItems: [], units,
    racePlan: plan
      ? { entryUnitDefId: entry.unitDefId, entryInstanceId: entry.instanceId,
          nodeIds: plan, trackState: 'STANDARD' as const }
      : undefined,
  };
}

const NIGE = styleBoard('nige');
const SASHI = styleBoard('sashi');
const NEUTRAL = neutralBoard();

/** Side A's win rate. `pair` decides which experiment is running. */
function rate(cond: RaceConditions, opts: {
  pair: 'style' | 'mirror'; planA?: string[] | null; planB?: string[] | null;
  n?: number; seedBase?: number;
} ): number {
  const { pair, planA = null, planB = null, n = 300, seedBase = 0 } = opts;
  const a = pair === 'style' ? NIGE : NEUTRAL;
  const b = pair === 'style' ? SASHI : NEUTRAL;
  let wins = 0;
  for (let i = 0; i < n; i += 1) {
    const r = simulateBattle(side('a', a, planA), side('b', b, planB),
      Rng.forStream(seedBase + i, 'cond'), { conditions: cond, g1ThemeId: 'ARIMA' });
    if (r.winner === 'A') wins += 1;
  }
  return (wins / n) * 100;
}

const D = DEFAULT_CONDITIONS;
const LEAD_PLAN = ['RP_LEAD_CONTROL', 'EV_EARLY_FRONT_LOCK', 'FM_FRONT_WIRE'];
const SURVIVE_PLAN = ['RP_SLOW_SAVE_LEGS', 'EV_LATE_SURGE', 'FM_SECOND_WIND'];

say('condition audit — 컨디션만 바꾼다.');
say('  실험 1 (각질): 같은 코스트 뼈대로 채운 ' + getTrait('nige').name + ' 보드 vs ' + getTrait('sashi').name + ' 보드');
say('  실험 2 (계획): 완전히 같은 보드 양쪽. A만 도주형 계획을 든다 — 기준선이 정확히 50%인 깨끗한 신호');
say('  기준 컨디션: ' + describeConditions(D));
say('');

const AXES: Array<[string, Array<[string, RaceConditions]>]> = [
  ['마장 (going)', GOING_DEFS.map((d) => [d.nameKo, { ...D, going: d.id }] as [string, RaceConditions])],
  ['페이스 (pace)', PACE_DEFS.map((d) => [d.nameKo, { ...D, pace: d.id }] as [string, RaceConditions])],
  // Weather is gated by going, so a sweep that lets `going` follow each weather
  // is really two axes at once. Held at 습윤, which is legal for four of the
  // five; 맑음 cannot co-occur with it and is measured on its own ground below.
  ['날씨 (습윤 고정)', WEATHER_DEFS.filter((d) => d.goings.includes('YIELDING'))
    .map((d) => [d.nameKo, { ...D, going: 'YIELDING', weather: d.id }] as [string, RaceConditions])],
  ['날씨 (양호 고정)', WEATHER_DEFS.filter((d) => d.goings.includes('FIRM'))
    .map((d) => [d.nameKo, { ...D, going: 'FIRM', weather: d.id }] as [string, RaceConditions])],
  ['개최 특례 (clause)', CLAUSE_DEFS.map((d) => [d.nameKo, { ...D, clause: d.id }] as [string, RaceConditions])],
];

function noiseFloor(pair: 'style' | 'mirror', planA: string[] | null): number {
  const blocks = [0, 1000, 2000, 3000, 4000].map((sb) => rate(D, { pair, planA, seedBase: sb }));
  say('   ' + blocks.map((v) => v.toFixed(1) + '%').join('  ')
    + '   폭 ' + (Math.max(...blocks) - Math.min(...blocks)).toFixed(1) + 'p');
  return Math.max(...blocks) - Math.min(...blocks);
}

function sweep(label: string, pair: 'style' | 'mirror', planA: string[] | null, noise: number): void {
  const spans: Array<[string, number]> = [];
  say('  ' + label);
  for (const [axis, values] of AXES) {
    const got: Array<[string, number]> = values.map(([name, cond]) => [name, rate(cond, { pair, planA })]);
    const nums = got.map(([, v]) => v);
    const span = Math.max(...nums) - Math.min(...nums);
    spans.push([axis, span]);
    say('    ' + pad(axis, 18) + '진폭 ' + span.toFixed(1).padStart(5) + 'p   '
      + got.map(([n, v]) => n + ' ' + v.toFixed(0) + '%').join(' · '));
  }
  say('    ' + pad('축별 진폭 순위', 18)
    + [...spans].sort((a, b) => b[1] - a[1])
      .map(([a, v]) => a.replace(/ \(.*/, '') + ' ' + v.toFixed(1) + 'p').join('  >  '));
  say('    잡음 바닥 ' + noise.toFixed(1) + 'p — 이보다 큰 진폭만 컨디션의 실제 효과');
}

say('0) 잡음 바닥 — 완전히 같은 컨디션, 시드만 다른 5개 블록');
say('  실험 1');
const noiseStyle = noiseFloor('style', null);
say('  실험 2');
const noiseMirror = noiseFloor('mirror', LEAD_PLAN);
say('');

say('1) 축별 진폭 — 나머지는 기준값 고정, 한 축만 바꿨을 때 A의 승률');
sweep('실험 1 — 각질 대결 (도주 A vs 선입 B)', 'style', null, noiseStyle);
say('');
sweep('실험 2 — 같은 보드, A만 도주형 계획', 'mirror', LEAD_PLAN, noiseMirror);
say('');

say('2) 회복 가능성 — 페이스가 불리해졌을 때 계획을 바꾸면 되돌아오는가');
say('   같은 보드 양쪽. A만 계획을 든다. 기준선 50%.');
for (const pace of PACE_DEFS) {
  const cond: RaceConditions = { ...D, pace: pace.id };
  const bare = rate(cond, { pair: 'mirror' });
  const lead = rate(cond, { pair: 'mirror', planA: LEAD_PLAN });
  const survive = rate(cond, { pair: 'mirror', planA: SURVIVE_PLAN });
  const best = Math.max(lead, survive);
  const worst = Math.min(lead, survive);
  say('  ' + pad(pace.nameKo, 12)
    + '계획 없음 ' + bare.toFixed(1).padStart(5) + '%'
    + '   앞서가기 ' + lead.toFixed(1).padStart(5) + '%'
    + '   버티기 ' + survive.toFixed(1).padStart(5) + '%'
    + '   → 옳은 쪽을 고르면 ' + (best - worst).toFixed(1).padStart(5) + 'p 이득'
    + (best === lead ? ' (앞서가기)' : ' (버티기)'));
}
say('');

say('3) 실제로 나올 수 있는 조합 — 각질 대결 기준');
const EXTREMES: Array<[string, RaceConditions]> = [
  ['도주에게 최악', { going: 'SOFT', pace: 'HIGH', weather: 'RAIN', clause: 'LONG_STRAIGHT' }],
  ['도주에게 최선', { going: 'FIRM', pace: 'SLOW', weather: 'CLEAR', clause: 'INNER_RAIL' }],
  ['가장 흔한 조합', { going: 'GOOD', pace: 'MIDDLE', weather: 'CLEAR', clause: 'NONE' }],
];
for (const [label, cond] of EXTREMES) {
  const bare = rate(cond, { pair: 'style' });
  const lead = rate(cond, { pair: 'style', planA: LEAD_PLAN });
  const survive = rate(cond, { pair: 'style', planA: SURVIVE_PLAN });
  say('  ' + pad(label, 16) + pad(describeConditions(cond), 36)
    + '계획 없음 ' + bare.toFixed(1).padStart(5) + '%'
    + '   최선 계획 ' + Math.max(lead, survive).toFixed(1).padStart(5) + '%');
}

say('');
say('4) 얼마나 자주 나오는가 — 진폭이 커도 안 나오면 문제가 아니다');
const pick = <T extends { id: string; weight: number }>(list: T[], id: string): number =>
  (list.find((d) => d.id === id)?.weight ?? 0) / list.reduce((n, d) => n + d.weight, 0);
function chance(c: RaceConditions): number {
  const legalWeather = WEATHER_DEFS.filter((w) => w.goings.includes(c.going));
  return pick(GOING_DEFS, c.going) * pick(legalWeather, c.weather)
    * pick(PACE_DEFS, c.pace) * pick(CLAUSE_DEFS, c.clause);
}
// Weather is gated by going, so the stack has to step through legal ground:
// 흐림 never falls on 불량, and a combination the roller cannot produce is not
// worth simulating.
const STACKS: Array<[string, RaceConditions]> = [
  ['0축 — 기준', D],
  ['1축 — 페이스만', { ...D, pace: 'HIGH' }],
  ['2축 — 마장+날씨', { going: 'SOFT', pace: 'MIDDLE', weather: 'RAIN', clause: 'NONE' }],
  ['3축 — +페이스', { going: 'SOFT', pace: 'HIGH', weather: 'RAIN', clause: 'NONE' }],
  ['4축 — +특례 (최악)', { going: 'SOFT', pace: 'HIGH', weather: 'RAIN', clause: 'LONG_STRAIGHT' }],
  ['4축 — 반대쪽 (최선)', { going: 'FIRM', pace: 'SLOW', weather: 'CLEAR', clause: 'INNER_RAIL' }],
];
for (const [label, cond] of STACKS) {
  const p = chance(cond);
  if (p <= 0) { say('  ' + pad(label, 20) + describeConditions(cond) + '   ← 나올 수 없는 조합'); continue; }
  const v = rate(cond, { pair: 'style' });
  say('  ' + pad(label, 20) + pad(describeConditions(cond), 38)
    + 'A ' + v.toFixed(1).padStart(5) + '%'
    + '   발생 ' + (p * 100).toFixed(2).padStart(5) + '%'
    + '   (약 ' + Math.round(1 / p).toLocaleString('en-US') + '라운드에 한 번)');
}

const out = process.argv.indexOf('--out');
if (out >= 0 && process.argv[out + 1]) {
  writeFileSync(process.argv[out + 1], LINES.join('\n') + '\n');
  console.log('\nwrote ' + process.argv[out + 1]);
}
