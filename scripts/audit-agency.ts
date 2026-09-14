/**
 * Does choosing well actually win the fight?
 *
 * Every other audit varies the *board*. This holds the board completely fixed —
 * same units, same stars, same opponent — and varies only one decision at a
 * time, well against badly. If the swings are small the game is decided at the
 * shop and the player is a passenger; if they are large, a board that looks
 * losing on paper can be played into a win.
 *
 *   npm run audit:agency
 */
import { writeFileSync } from 'node:fs';
import { simulateBattle, type BattleSideInput } from '../src/game/engine/battle/engine';
import { Rng } from '../src/game/engine/rng';
import { getSeasonUnits, getUnitDef } from '../src/game/engine/roster';
import { ALL_RACE_PLAN_NODES, guardPasses } from '../src/game/engine/race-plan/defs';
import { RACE_PLAN_DEFS, RACE_EVOLUTION_DEFS, FINISHING_MOVE_DEFS } from '../src/game/engine/race-plan/defs';
import { DEFAULT_CONDITIONS, type RaceConditions } from '../src/game/engine/race-plan/conditions';

const LINES: string[] = [];
const say = (line = ''): void => { LINES.push(line); console.log(line); };
const width = (s: string): number => [...s].reduce((w, ch) => w + (ch.charCodeAt(0) > 127 ? 2 : 1), 0);
const pad = (s: string, n: number): string => s + ' '.repeat(Math.max(0, n - width(s)));

const s1 = getSeasonUnits('s1');
const pool = (cost: number, kind: 'front' | 'carry', n: number, skip = 0) =>
  s1.filter((u) => u.cost === cost && (kind === 'front'
    ? (u.role === 'TANK' || u.role === 'BRUISER')
    : (u.role === 'AD_CARRY' || u.role === 'AP_CARRY'))).slice(skip, skip + n);

type Spec = { id: string; star: 1 | 2 | 3; front: boolean };
/** The board under test: a value deck, the shape the player report was about. */
const BOARD: Spec[] = [
  ...pool(1, 'front', 2).map((u) => ({ id: u.id, star: 2 as const, front: true })),
  ...pool(2, 'front', 2).map((u) => ({ id: u.id, star: 2 as const, front: true })),
  ...pool(4, 'carry', 3).map((u) => ({ id: u.id, star: 2 as const, front: false })),
  ...pool(5, 'carry', 1).map((u) => ({ id: u.id, star: 1 as const, front: false })),
];
/**
 * Three opponents, chosen by calibration rather than by eye.
 *
 * Most matchups in this game are already decided before a single choice is
 * made — a calibration sweep put a value board at 90.7% against one reroll
 * front line and 1.0% against a front line one tier up. Measuring agency inside
 * either is meaningless, so the primary opponent is the mirror, the one matchup
 * that actually sits near even. The other two are kept to show the saturation.
 */
const OPPONENTS: Array<[string, Spec[]]> = [
  ['접전 (미러)', BOARD],
  ['유리 (1코 3성 앞줄)', [
    ...pool(1, 'front', 2).map((u) => ({ id: u.id, star: 3 as const, front: true })),
    ...pool(2, 'front', 2).map((u) => ({ id: u.id, star: 2 as const, front: true })),
    ...pool(3, 'carry', 4).map((u) => ({ id: u.id, star: 2 as const, front: false })),
  ]],
  ['불리 (2코 3성 앞줄)', [
    ...pool(2, 'front', 3).map((u) => ({ id: u.id, star: 3 as const, front: true })),
    ...pool(1, 'front', 1).map((u) => ({ id: u.id, star: 2 as const, front: true })),
    ...pool(3, 'carry', 4).map((u) => ({ id: u.id, star: 2 as const, front: false })),
  ]],
];
let OPPONENT: Spec[] = OPPONENTS[0][1];

const ENTRY = BOARD.find((s) => !s.front)!;
const ENTRY_DEF = getUnitDef(ENTRY.id);

type Choice = {
  items: 'carry' | 'misplaced' | 'bruiser' | 'none';
  placement: 'screened' | 'exposed';
  plan: 'fitted' | 'random' | 'none';
  augments: string[];
};

/**
 * One item pool, two allocations. `carry` stacks it on the damage dealers,
 * `misplaced` hands the identical items to the front line, where the +20%/+10%
 * attack damage rides a tank's small base AD and is mostly thrown away. That
 * isolates the decision from the items' own power level.
 *
 * `bruiser` is a third, genuinely different line — sustain and an on-hit
 * execute spread across the front rank — kept because it turned out to be
 * strong and is worth reporting rather than hiding.
 */
const GOOD_ITEMS = ['champion_trophy', 'twilight_racing_suit'];
const BRUISER_ITEMS = ['unyielding_fighting_spirit', 'giant_overtaker'];

/** Contact rank, in the columns the four-wide front line leaves uncovered. */
const EXPOSED_CELLS = [{ q: 6, r: 0 }, { q: 5, r: 0 }, { q: 4, r: 0 }, { q: 6, r: 1 }];

function build(tag: string, spec: Spec[], choice: Choice, plan: string[] | null): BattleSideInput {
  let front = 0, back = 0;
  const units = spec.map((s, i) => {
    const isCarry = !s.front;
    const items = choice.items === 'none' ? []
      : choice.items === 'carry' ? (isCarry ? GOOD_ITEMS : [])
        : choice.items === 'misplaced' ? (s.front ? GOOD_ITEMS : [])
          : (s.front ? BRUISER_ITEMS : []);
    return {
      instanceId: tag + i, unitDefId: s.id, star: s.star, items,
      // r = 0 is the rank that meets the enemy (toBattleCell maps board r to
      // cell r+4 for A and mirrors B, so the two r = 0 ranks end up adjacent).
      // Screened carries sit at r = 1 in the columns the front rank covers;
      // exposed ones stand in the contact rank itself, out on the flank columns
      // the front line never reaches.
      position: s.front
        ? { q: front++ % 4, r: 0 }
        : choice.placement === 'screened'
          ? { q: back++ % 4, r: 1 }
          : EXPOSED_CELLS[back++ % EXPOSED_CELLS.length],
    };
  });
  const entry = units.find((u) => u.unitDefId === ENTRY.id) ?? units[0];
  return {
    playerId: tag, augments: choice.augments, tacticianItems: [], units,
    racePlan: plan ? {
      entryUnitDefId: entry.unitDefId, entryInstanceId: entry.instanceId,
      nodeIds: plan, trackState: 'STANDARD',
    } : undefined,
  };
}

const FITTED = ['RP_HIGH_PACE_BREAK', 'EV_EARLY_OVERPACE', 'FM_BREAKAWAY'];
const RANDOM_PLAN = [RACE_PLAN_DEFS[0].id, RACE_EVOLUTION_DEFS[0].id, FINISHING_MOVE_DEFS[0].id];
const planFor = (kind: Choice['plan']): string[] | null =>
  kind === 'none' ? null : kind === 'fitted' ? FITTED : RANDOM_PLAN;

const CONDITIONS: RaceConditions[] = [
  DEFAULT_CONDITIONS,
  { going: 'FIRM', pace: 'MIDDLE', weather: 'CLEAR', clause: 'NONE' },
  { going: 'GOOD', pace: 'HIGH', weather: 'CLOUDY', clause: 'NONE' },
  { going: 'GOOD', pace: 'SLOW', weather: 'CLOUDY', clause: 'NONE' },
  { going: 'SOFT', pace: 'MIDDLE', weather: 'RAIN', clause: 'NONE' },
];

/** The opponent always plays the same reasonable line, so only our choice moves. */
const OPP_CHOICE: Choice = { items: 'carry', placement: 'screened', plan: 'none', augments: [] };

function rate(choice: Choice, n = 400): number {
  let wins = 0;
  for (let i = 0; i < n; i += 1) {
    const cond = CONDITIONS[i % CONDITIONS.length];
    const result = simulateBattle(
      build('a', BOARD, choice, planFor(choice.plan)),
      build('b', OPPONENT, OPP_CHOICE, null),
      Rng.forStream(i, 'agency'),
      { conditions: cond, g1ThemeId: 'ARIMA' },
    );
    if (result.winner === 'A') wins += 1;
  }
  return (wins / n) * 100;
}

const BEST: Choice = { items: 'carry', placement: 'screened', plan: 'fitted', augments: ['team_diversity', 'spell_jewel'] };
const WORST: Choice = { items: 'misplaced', placement: 'exposed', plan: 'none', augments: [] };

say('agency audit — 같은 보드, 같은 상대. 선택만 바꾼다.');
say('  내 보드 : 밸류덱 (1·2코 2성 앞줄 4 + 4코 2성 캐리 3 + 5코 1성 1)');
say('  출주마  : ' + ENTRY_DEF.nameKo + ' (' + ENTRY_DEF.cost + '코 ' + ENTRY_DEF.role + ')');
say('');

say('상대별 — 잘 고른 경우 vs 못 고른 경우');
for (const [label, opp] of OPPONENTS) {
  OPPONENT = opp;
  const b = rate(BEST), w = rate(WORST);
  say('  ' + pad(label, 22) + b.toFixed(1).padStart(5) + '%  vs ' + w.toFixed(1).padStart(5)
    + '%   차이 ' + (b - w).toFixed(1).padStart(5) + 'p');
}
say('');
say('이하 모든 측정은 접전(미러) 상대 기준 — 이미 결정된 매치업에서는 선택이 움직일 여지가 없다.');
OPPONENT = OPPONENTS[0][1];

const best = rate(BEST);
const worst = rate(WORST);
say('');
say('모두 잘 고른 경우   ' + best.toFixed(1).padStart(5) + '%');
say('모두 못 고른 경우   ' + worst.toFixed(1).padStart(5) + '%');
say('               차이 ' + (best - worst).toFixed(1).padStart(5) + '포인트');
say('');

say('선택 하나씩 — 최선에서 그 항목만 나쁘게 바꿨을 때');
const single: Array<[string, Choice, string]> = [
  ['아이템 (캐리→앞줄)', { ...BEST, items: 'misplaced' }, '같은 아이템을 앞줄에 잘못 주기'],
  ['아이템 (캐리→없음)', { ...BEST, items: 'none' }, '캐리에 몰아주기 → 아예 없음'],
  ['아이템 (캐리→브루저)', { ...BEST, items: 'bruiser' }, '다른 노선: 앞줄에 지속력+집행 아이템'],
  ['배치 (보호→노출)', { ...BEST, placement: 'exposed' }, '캐리를 몸 뒤에 → 혼자 노출'],
  ['레이스플랜 (맞춤→아무거나)', { ...BEST, plan: 'random' }, '유닛에 맞는 조합 → 첫 장 아무거나'],
  ['레이스플랜 (맞춤→없음)', { ...BEST, plan: 'none' }, '유닛에 맞는 조합 → 미선택'],
  ['증강 (있음→없음)', { ...BEST, augments: [] }, '보드에 맞는 2개 → 없음'],
];
for (const [label, choice, note] of single) {
  const v = rate(choice);
  say('  ' + pad(label, 28) + v.toFixed(1).padStart(5) + '%   ' + (v - best >= 0 ? '+' : '') + (v - best).toFixed(1).padStart(5) + 'p   ' + note);
}

say('');
say('선택 하나씩 — 최악에서 그 항목만 좋게 바꿨을 때');
const rescue: Array<[string, Choice]> = [
  ['아이템만 캐리에', { ...WORST, items: 'carry' }],
  ['배치만 보호로', { ...WORST, placement: 'screened' }],
  ['레이스플랜만 맞춤으로', { ...WORST, plan: 'fitted' }],
  ['증강만 추가', { ...WORST, augments: BEST.augments }],
];
for (const [label, choice] of rescue) {
  const v = rate(choice);
  say('  ' + pad(label, 28) + v.toFixed(1).padStart(5) + '%   ' + (v - worst >= 0 ? '+' : '') + (v - worst).toFixed(1).padStart(5) + 'p');
}

say('');
say('레이스 플랜 선택지의 폭 — 같은 보드에 서로 다른 계획을 얹었을 때');
const legal = RACE_PLAN_DEFS.filter((n) => guardPasses(n, ENTRY_DEF, 8));
const sampled = legal.filter((_, i) => i % 4 === 0).slice(0, 8);
const planRates: Array<[string, number]> = [];
for (const node of sampled) {
  const ids = [node.id, 'EV_EARLY_OVERPACE', 'FM_BREAKAWAY'];
  let wins = 0;
  const n = 240;
  for (let i = 0; i < n; i += 1) {
    const cond = CONDITIONS[i % CONDITIONS.length];
    if (simulateBattle(build('a', BOARD, BEST, ids), build('b', OPPONENT, OPP_CHOICE, null),
      Rng.forStream(i, 'agency'), { conditions: cond, g1ThemeId: 'ARIMA' }).winner === 'A') wins += 1;
  }
  planRates.push([node.nameKo, (wins / n) * 100]);
}
planRates.sort((a, b) => b[1] - a[1]);
for (const [name, v] of planRates) say('  ' + pad(name, 16) + v.toFixed(1).padStart(5) + '%');
if (planRates.length >= 2) {
  say('  최고와 최저 차이 ' + (planRates[0][1] - planRates[planRates.length - 1][1]).toFixed(1) + '포인트');
}

void ALL_RACE_PLAN_NODES;
const out = process.argv.indexOf('--out');
if (out >= 0 && process.argv[out + 1]) {
  writeFileSync(process.argv[out + 1], LINES.join('\n') + '\n');
  console.log('\nwrote ' + process.argv[out + 1]);
}
