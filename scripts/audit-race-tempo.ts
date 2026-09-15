/**
 * How much of a fight actually happens inside each race phase?
 *
 * The 각질 curve pays 도주 and 선행 in 발주 and 중반, and pays 선입 and 추입 in
 * 4코너 and 최종 직선. Reading the curve alone, the trade looks priced. But the
 * phases are not clock-driven: progress is the larger of elapsed time, bodies
 * lost and health lost, taken from the worse-off side. So the more one-sided a
 * fight is, the faster it runs through the early phases — and a bonus that is
 * live while nobody is hitting anybody is worth nothing at all.
 *
 * A percentage is only worth the damage that passes through it. This measures
 * that directly:
 *
 *  1. **Wall time** each phase holds, and
 *  2. **damage share** — what fraction of all damage in the fight lands while
 *     that phase is the live one.
 *
 * (2) is the real exchange rate. If 발주 and 중반 together carry a quarter of
 * the damage while 최종 직선 alone carries half, then 도주's +12%/+7% is being
 * paid in a currency worth half of what 추입's +26% is paid in, whatever the
 * numbers on the card say.
 *
 *   npm run audit:race-tempo
 */
import { writeFileSync } from 'node:fs';
import { simulateBattle, type BattleSideInput } from '../src/game/engine/battle/engine';
import { Rng } from '../src/game/engine/rng';
import { getSeasonUnits, getUnitTraits } from '../src/game/engine/roster';
import { RUN_STYLES, STYLE_CURVES, styleStepAt } from '../src/game/engine/race-plan/style-curve';
import { DEFAULT_CONDITIONS, type RaceConditions } from '../src/game/engine/race-plan/conditions';
import { RACE_PHASE_LABEL, type RaceCombatPhase } from '../src/game/engine/race-plan/types';
import type { SeasonId } from '../src/game/engine/seasons/catalog';
import type { RunStyle } from '../src/game/engine/types';

const LINES: string[] = [];
const say = (line = ''): void => { LINES.push(line); console.log(line); };
const width = (s: string): number => [...s].reduce((w, ch) => w + (ch.charCodeAt(0) > 127 ? 2 : 1), 0);
const pad = (s: string, n: number): string => s + ' '.repeat(Math.max(0, n - width(s)));
const padL = (s: string, n: number): string => ' '.repeat(Math.max(0, n - width(s))) + s;

const PHASES: RaceCombatPhase[] = ['START', 'POSITIONING', 'LATE', 'LAST_3F', 'OVERTIME'];
const SEASONS: SeasonId[] = ['s1', 's2', 's3', 's4', 's5'];

const CONDS: RaceConditions[] = [
  DEFAULT_CONDITIONS,
  { going: 'FIRM', pace: 'MIDDLE', weather: 'CLEAR', clause: 'NONE' },
  { going: 'GOOD', pace: 'HIGH', weather: 'CLOUDY', clause: 'NONE' },
  { going: 'GOOD', pace: 'SLOW', weather: 'CLOUDY', clause: 'NONE' },
  { going: 'SOFT', pace: 'MIDDLE', weather: 'RAIN', clause: 'NONE' },
];

const isFront = (role: string): boolean => role === 'TANK' || role === 'BRUISER';
const styleOf = (id: string, season: SeasonId): RunStyle | null =>
  RUN_STYLES.find((st) => getUnitTraits(id, season).includes(st)) ?? null;

/** A board of `size` units for one season, drawn the way a real lineup is. */
function board(season: SeasonId, size: number, seed: number): BattleSideInput['units'] {
  const pool = getSeasonUnits(season);
  const rng = Rng.forStream(seed, 'tempo-board');
  const front = pool.filter((u) => isFront(u.role));
  const back = pool.filter((u) => !isFront(u.role));
  const pick = <T,>(list: T[], n: number): T[] => {
    const copy = [...list];
    const out: T[] = [];
    for (let i = 0; i < n && copy.length; i += 1) out.push(copy.splice(rng.int(0, copy.length - 1), 1)[0]);
    return out;
  };
  const frontCount = Math.max(1, Math.round(size * 0.4));
  const chosen = [...pick(front, frontCount), ...pick(back, size - frontCount)];
  let f = 0, b = 0;
  return chosen.map((u, i) => ({
    instanceId: 'u' + i,
    unitDefId: u.id,
    star: (rng.int(0, 9) < 7 ? 2 : rng.int(0, 1) === 0 ? 1 : 3) as 1 | 2 | 3,
    items: [],
    position: isFront(u.role) ? { q: f++ % 4, r: 0 } : { q: b++ % 4, r: 1 + Math.floor(b / 5) },
  }));
}

type Tally = {
  battles: number;
  /** Seconds the phase was the live one, summed across battles. */
  seconds: number[];
  /** Damage dealt while the phase was live, summed across battles. */
  damage: number[];
  /** Battles in which the phase was ever reached. */
  reached: number[];
  totalSeconds: number;
  totalDamage: number;
};

function emptyTally(): Tally {
  return {
    battles: 0,
    seconds: PHASES.map(() => 0),
    damage: PHASES.map(() => 0),
    reached: PHASES.map(() => 0),
    totalSeconds: 0,
    totalDamage: 0,
  };
}

/** Walk one battle's events and attribute every point of damage to a phase. */
function measure(tally: Tally, events: ReturnType<typeof simulateBattle>['events'], duration: number): void {
  // Phase boundaries: the RACE_PHASE event carries the time the phase opened.
  const opened = new Map<RaceCombatPhase, number>([['START', 0]]);
  for (const e of events) if (e.type === 'RACE_PHASE' && !opened.has(e.phase)) opened.set(e.phase, e.t);

  const order = PHASES.filter((p) => opened.has(p));
  const startAt = order.map((p) => opened.get(p)!);
  const endAt = startAt.map((_, i) => (i + 1 < startAt.length ? startAt[i + 1] : duration));

  tally.battles += 1;
  tally.totalSeconds += duration;
  for (let i = 0; i < order.length; i += 1) {
    const index = PHASES.indexOf(order[i]);
    tally.reached[index] += 1;
    tally.seconds[index] += Math.max(0, endAt[i] - startAt[i]);
  }

  const phaseAt = (t: number): number => {
    let index = PHASES.indexOf(order[0]);
    for (let i = 0; i < order.length; i += 1) if (t >= startAt[i]) index = PHASES.indexOf(order[i]);
    return index;
  };
  for (const e of events) {
    if (e.type !== 'DAMAGE') continue;
    const amount = e.damage + e.absorbed;
    tally.damage[phaseAt(e.t)] += amount;
    tally.totalDamage += amount;
  }
}

// ------------------------------------------------------------------- the sweep
const BOARD_SIZES = [4, 6, 8, 9];
const overall = emptyTally();
const bySize = new Map<number, Tally>(BOARD_SIZES.map((n) => [n, emptyTally()]));
const bySeason = new Map<SeasonId, Tally>(SEASONS.map((s) => [s, emptyTally()]));
/**
 * The hypothesis under test: progress is the larger of clock, bodies lost and
 * health lost on the WORSE-OFF side, so a one-sided fight should race through
 * the early phases. Slice by how lopsided the result was and the effect, if it
 * exists, has to show here.
 */
const MARGINS = ['완승 (상대 전멸, 아군 70%+ 생존)', '우세', '접전'] as const;
const byMargin = new Map<string, Tally>(MARGINS.map((m) => [m, emptyTally()]));
const marginOf = (survA: number, survB: number, size: number): string => {
  const gap = Math.abs(survA - survB) / size;
  return gap >= 0.7 ? MARGINS[0] : gap >= 0.35 ? MARGINS[1] : MARGINS[2];
};

let seed = 0;
for (const season of SEASONS) {
  for (const size of BOARD_SIZES) {
    for (let i = 0; i < 60; i += 1) {
      seed += 1;
      const a: BattleSideInput = { playerId: 'a', augments: [], tacticianItems: [], units: board(season, size, seed) };
      const b: BattleSideInput = { playerId: 'b', augments: [], tacticianItems: [], units: board(season, size, seed + 99991) };
      const result = simulateBattle(a, b, Rng.forStream(seed, 'tempo'), {
        conditions: CONDS[seed % CONDS.length], g1ThemeId: 'ARIMA',
      });
      const margin = byMargin.get(marginOf(result.survivorsA, result.survivorsB, size))!;
      for (const t of [overall, bySize.get(size)!, bySeason.get(season)!, margin]) {
        measure(t, result.events, result.durationSeconds);
      }
    }
  }
}

// ---------------------------------------------------------------------- report
const pct = (v: number): string => (v * 100).toFixed(1) + '%';

say('race tempo audit — 각 구간이 실제로 전투의 몇 퍼센트인가');
say('');
say(`${overall.battles}전투 · 시즌 5종 × 보드 ${BOARD_SIZES.join('/')}명 × 조건 5종`);
say('');
say('1) 전체');
say('  ' + pad('구간', 12) + padL('도달률', 8) + padL('평균 지속', 10) + padL('시간 비중', 10)
  + padL('피해 비중', 10) + padL('배율', 8));
say('  ' + '-'.repeat(60));
for (let i = 0; i < PHASES.length; i += 1) {
  const timeShare = overall.seconds[i] / overall.totalSeconds;
  const dmgShare = overall.damage[i] / overall.totalDamage;
  say('  ' + pad(RACE_PHASE_LABEL[PHASES[i]], 12)
    + padL(pct(overall.reached[i] / overall.battles), 8)
    + padL((overall.seconds[i] / Math.max(1, overall.reached[i])).toFixed(1) + '초', 10)
    + padL(pct(timeShare), 10)
    + padL(pct(dmgShare), 10)
    + padL(timeShare > 0 ? (dmgShare / timeShare).toFixed(2) + '×' : '—', 8));
}
say('');
say('  「배율」은 그 구간의 1초가 평균적인 1초보다 몇 배 치열한가입니다.');
say('  1.00× 미만이면 그 구간은 시간만 흐르고 실제 교전은 적다는 뜻입니다.');

const early = overall.damage[0] + overall.damage[1];
const late = overall.damage[2] + overall.damage[3] + overall.damage[4];
say('');
say('2) 앞구간 대 뒷구간 — 각질 보정이 실제로 통과하는 피해량');
say('  ' + pad('발주+중반 (도주·선행이 버는 구간)', 38) + padL(pct(early / overall.totalDamage), 8));
say('  ' + pad('4코너+최종직선+결승선 (선입·추입이 버는 구간)', 38) + padL(pct(late / overall.totalDamage), 8));
say('  ' + pad('뒷구간 / 앞구간', 38) + padL((late / Math.max(1, early)).toFixed(2) + '배', 8));

say('');
say('3) 보드 크기별 — 기물이 적을수록 한 명이 죽는 값이 커집니다');
say('  ' + pad('보드', 8) + PHASES.map((p) => padL(RACE_PHASE_LABEL[p], 11)).join('') + padL('앞구간 피해', 12));
for (const size of BOARD_SIZES) {
  const t = bySize.get(size)!;
  say('  ' + pad(size + '명', 8)
    + PHASES.map((_, i) => padL(pct(t.damage[i] / t.totalDamage), 11)).join('')
    + padL(pct((t.damage[0] + t.damage[1]) / t.totalDamage), 12));
}

say('');
say('4) 시즌별');
say('  ' + pad('시즌', 8) + PHASES.map((p) => padL(RACE_PHASE_LABEL[p], 11)).join('') + padL('앞구간 피해', 12));
for (const season of SEASONS) {
  const t = bySeason.get(season)!;
  say('  ' + pad(season, 8)
    + PHASES.map((_, i) => padL(pct(t.damage[i] / t.totalDamage), 11)).join('')
    + padL(pct((t.damage[0] + t.damage[1]) / t.totalDamage), 12));
}

say('');
say('5) 승부 격차별 — 「일방적인 전투일수록 앞구간이 빨리 지나간다」 가설');
say('  진행도는 열세인 쪽의 체력·기물 손실로 계산되므로, 가설이 맞다면');
say('  완승 전투에서 발주·중반 피해 비중이 눈에 띄게 낮아져야 합니다.');
say('');
say('  ' + pad('격차', 30) + padL('전투수', 8) + PHASES.slice(0, 4).map((p) => padL(RACE_PHASE_LABEL[p], 11)).join('')
  + padL('앞구간', 10) + padL('평균 길이', 10));
for (const m of MARGINS) {
  const t = byMargin.get(m)!;
  if (!t.battles) continue;
  say('  ' + pad(m, 30) + padL(String(t.battles), 8)
    + PHASES.slice(0, 4).map((_, i) => padL(pct(t.damage[i] / t.totalDamage), 11)).join('')
    + padL(pct((t.damage[0] + t.damage[1]) / t.totalDamage), 10)
    + padL((t.totalSeconds / t.battles).toFixed(1) + '초', 10));
}

say('');
say('6) 각질 보정의 실효값 — 측정된 피해 분포로 환산하면 얼마인가');
say('  카드에 적힌 퍼센트는 그 구간을 통과하는 피해량만큼만 값어치가 있습니다.');
say('  아래는 실측 피해 비중으로 가중한 값입니다. 밸런스 테스트가 쓰는 명목');
say('  가중치(1/6, 1/2, 1/6, 1/6)와 나란히 둡니다.');
say('');
const measured: Record<RaceCombatPhase, number> = {
  START: overall.damage[0] / overall.totalDamage,
  POSITIONING: overall.damage[1] / overall.totalDamage,
  LATE: overall.damage[2] / overall.totalDamage,
  LAST_3F: overall.damage[3] / overall.totalDamage,
  OVERTIME: overall.damage[4] / overall.totalDamage,
};
const nominal: Record<RaceCombatPhase, number> = {
  START: 1 / 6, POSITIONING: 1 / 2, LATE: 1 / 6, LAST_3F: 1 / 6, OVERTIME: 0,
};
const weigh = (style: RunStyle, w: Record<RaceCombatPhase, number>, key: 'damage' | 'resist'): number =>
  PHASES.reduce((n, p) => n + styleStepAt(style, p)[key] * w[p], 0);
const signed = (v: number): string => (v >= 0 ? '+' : '') + (v * 100).toFixed(2) + '%';
say('  ' + pad('각질', 10) + padL('명목 딜', 10) + padL('실측 딜', 10) + padL('실측 방어', 12) + padL('합', 10));
say('  ' + '-'.repeat(52));
const totals = RUN_STYLES.map((st) => ({
  st,
  nom: weigh(st, nominal, 'damage'),
  dmg: weigh(st, measured, 'damage'),
  res: weigh(st, measured, 'resist'),
}));
for (const t of totals) {
  say('  ' + pad(STYLE_CURVES[t.st].nameKo, 10)
    + padL(signed(t.nom), 10) + padL(signed(t.dmg), 10)
    + padL(signed(t.res), 12) + padL(signed(t.dmg + t.res), 10));
}
const dmgSpread = Math.max(...totals.map((t) => t.dmg)) - Math.min(...totals.map((t) => t.dmg));
const sumSpread = Math.max(...totals.map((t) => t.dmg + t.res)) - Math.min(...totals.map((t) => t.dmg + t.res));
say('');
say('  딜 격차 ' + (dmgSpread * 100).toFixed(2) + '%p · 딜+방어 격차 ' + (sumSpread * 100).toFixed(2) + '%p');
say('  (밸런스 테스트의 허용 한계는 딜 기준 6.00%p입니다.)');

say('');
say('7) 로스터 실태 — 각질별로 쓸 수 있는 후열이 몇 명인가');
say('  승률을 재기 전에 확인해야 할 것. 코스트가 다르면 승률은 각질이 아니라');
say('  유닛 값을 재게 됩니다.');
say('');
say('  ' + pad('시즌', 6) + pad('각질', 8) + [1, 2, 3, 4, 5].map((c) => padL(c + '코', 5)).join('') + padL('합계', 7));
for (const season of SEASONS) {
  for (const st of RUN_STYLES) {
    const back = getSeasonUnits(season).filter((u) => !isFront(u.role) && styleOf(u.id, season) === st);
    say('  ' + pad(season, 6) + pad(STYLE_CURVES[st].nameKo, 8)
      + [1, 2, 3, 4, 5].map((c) => padL(String(back.filter((u) => u.cost === c).length), 5)).join('')
      + padL(String(back.length), 7));
  }
}

say('');
say('8) 코스트를 맞춘 승률 — 곡선만 남기고 유닛 값을 지운 비교');
say('  네 각질 모두 2코스트 이하 후열을 3명씩 세울 수 있는 조합은 s5뿐입니다.');
say('  전열 4명은 양쪽 동일. 승률 50%가 기준선입니다.');
say('');
const MATCH_SEASON: SeasonId = 's5';
const CARRIES = 3;
const backCheap = (st: RunStyle) =>
  getSeasonUnits(MATCH_SEASON).filter((u) => !isFront(u.role) && styleOf(u.id, MATCH_SEASON) === st && u.cost <= 2).slice(0, CARRIES);
const frontShared = getSeasonUnits(MATCH_SEASON).filter((u) => isFront(u.role) && u.cost <= 2).slice(0, 4);

function styleSide(tag: string, st: RunStyle): BattleSideInput | null {
  const back = backCheap(st);
  if (back.length < CARRIES) return null;
  let f = 0, b = 0;
  return {
    playerId: tag, augments: [], tacticianItems: [],
    units: [
      ...frontShared.map((u, i) => ({ instanceId: tag + 'f' + i, unitDefId: u.id, star: 2 as const, items: [] as string[], position: { q: f++ % 4, r: 0 } })),
      ...back.map((u, i) => ({ instanceId: tag + 'b' + i, unitDefId: u.id, star: 2 as const, items: [] as string[], position: { q: b++ % 4, r: 1 } })),
    ],
  };
}

const tally = new Map<RunStyle, { wins: number; games: number }>(RUN_STYLES.map((st) => [st, { wins: 0, games: 0 }]));
const grid: string[][] = [];
for (const x of RUN_STYLES) {
  const cells: string[] = [];
  for (const y of RUN_STYLES) {
    if (x === y) { cells.push('—'); continue; }
    const a = styleSide('a', x), b = styleSide('b', y);
    if (!a || !b) { cells.push('n/a'); continue; }
    let wins = 0;
    const n = 300;
    for (let i = 0; i < n; i += 1) {
      const r = simulateBattle(a, b, Rng.forStream(i, 'tempo-cost-' + x + y), {
        conditions: CONDS[i % CONDS.length], g1ThemeId: 'ARIMA',
      });
      if (r.winner === 'A') wins += 1;
    }
    const row = tally.get(x)!; row.wins += wins; row.games += n;
    cells.push((wins / n * 100).toFixed(1) + '%');
  }
  grid.push(cells);
}
say('  ' + pad('', 8) + RUN_STYLES.map((st) => padL('vs ' + STYLE_CURVES[st].nameKo, 10)).join('')
  + padL('종합', 9) + padL('캐리 코스트', 12) + padL('캐리 수', 9));
for (let i = 0; i < RUN_STYLES.length; i += 1) {
  const st = RUN_STYLES[i];
  const row = tally.get(st)!;
  const back = backCheap(st);
  say('  ' + pad(STYLE_CURVES[st].nameKo, 8) + grid[i].map((c) => padL(c, 10)).join('')
    + padL(row.games ? (row.wins / row.games * 100).toFixed(1) + '%' : '—', 9)
    + padL(back.length ? (back.reduce((n, u) => n + u.cost, 0) / back.length).toFixed(2) : '—', 12)
    + padL(String(back.length), 9));
}
say('');
say('  코스트가 같아도 유닛의 스킬과 역할까지 같지는 않으므로, 이 표도 곡선만');
say('  떼어낸 값은 아닙니다. 다만 4코 대 2.5코를 비교하던 앞의 표보다는');
say('  곡선에 훨씬 가깝습니다.');

const stamp = new Date().toISOString().slice(0, 10);
const out = `docs/generated/audit-race-tempo-${stamp}.txt`;
writeFileSync(out, LINES.join('\n') + '\n');
say('');
say(out + ' 에 저장했습니다.');
