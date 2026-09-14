/**
 * What happens when an item gives a unit a second 각질?
 *
 * Emblems exist so a board can reach a threshold the roster will not give it —
 * 추입 has no three- or four-cost unit at all — and as a synergy tool that is
 * worth keeping. But 각질 here is not only a threshold: it is a phase curve
 * whose whole point is that every style has a stretch of the race it is bad at.
 * A unit holding two of them is a unit with no trough, which is the concern.
 *
 * Four ways to resolve it, measured against each other:
 *
 *   FIRST   the engine's old behaviour — first entry in RUN_STYLES wins
 *   NATIVE  the unit runs what it was born with; the emblem is traits only
 *   BLEND   the average of both curves: no trough, but no peak either
 *   STACK   both curves at full strength — the feared case, measured to price it
 *
 *   npm run audit:emblem-style
 */
import { writeFileSync } from 'node:fs';
import { simulateBattle, type BattleSideInput } from '../src/game/engine/battle/engine';
import { Rng } from '../src/game/engine/rng';
import { getSeasonUnits, getUnitDef, getUnitTraits } from '../src/game/engine/roster';
import { RUN_STYLES, STYLE_CURVES, styleStepAt, type StyleResolution } from '../src/game/engine/race-plan/style-curve';
import { getTrait } from '../src/game/engine/traits/trait-defs';
import { DEFAULT_STYLE_RESOLUTION } from '../src/game/engine/race-plan/style-curve';
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
const PHASES: RaceCombatPhase[] = ['START', 'POSITIONING', 'LATE', 'LAST_3F'];
const PHASE_KO: Record<string, string> = {
  START: '발주', POSITIONING: '중반', LATE: '4코너', LAST_3F: '최종직선',
};

const s1 = getSeasonUnits('s1');
const isFront = (r: string): boolean => r === 'TANK' || r === 'BRUISER';
const styleOf = (id: string): RunStyle | null =>
  RUN_STYLES.find((st) => getUnitTraits(id, 's1').includes(st)) ?? null;

// ------------------------------------------------------------------ the table
say('emblem × 각질 audit');
say('');
say('0) 각질 곡선 — 각 페이즈의 피해 보정 (피해감소는 괄호)');
say('  ' + pad('', 10) + PHASES.map((p) => pad(PHASE_KO[p], 10)).join(''));
for (const style of RUN_STYLES) {
  say('  ' + pad(STYLE_CURVES[style].nameKo, 10)
    + PHASES.map((p) => {
      const s = styleStepAt(style, p);
      return pad((s.damage >= 0 ? '+' : '') + (s.damage * 100).toFixed(0) + '%'
        + (s.resist ? ` (${(s.resist * 100).toFixed(0)})` : ''), 10);
    }).join(''));
}
say('');
say('  두 각질을 가진 경우, 정책별로 실제 적용되는 값 — 예: 추입 유닛 + 도주 인자');
const pair: RunStyle[] = ['nige', 'oikomi'];
const shown: Array<[string, (p: RaceCombatPhase) => number]> = [
  ['FIRST  (기존)', (p) => styleStepAt('nige', p).damage],
  ['NATIVE', (p) => styleStepAt('oikomi', p).damage],
  ['BLEND', (p) => pair.reduce((n, st) => n + styleStepAt(st, p).damage, 0) / 2],
  ['STACK', (p) => pair.reduce((n, st) => n + styleStepAt(st, p).damage, 0)],
];
for (const [label, f] of shown) {
  say('  ' + pad(label, 14) + PHASES.map((p) => {
    const v = f(p);
    return pad((v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%', 10);
  }).join(''));
}

// ------------------------------------------------------------------- the board
type Spec = { id: string; star: 1 | 2 | 3; front: boolean; items: string[] };

/**
 * What the emblem is actually competing with.
 *
 * An emblem occupies an item slot, so the real choice a player faces is not
 * "emblem or nothing" — it is "emblem or a damage item". Measuring it against
 * an empty slot prices it as a free trait and overstates it every time.
 */
const RIVAL_ITEM = 'champion_trophy';

/** A carry-led board; `emblemStyle` puts that emblem on every back-line carry. */
function board(emblemStyle: RunStyle | null, fillSlot = false): Spec[] {
  const front = s1.filter((u) => isFront(u.role) && u.cost <= 2).slice(0, 4);
  // Carries chosen so they all have a native 각질 to conflict with.
  const back = s1.filter((u) => !isFront(u.role) && u.cost === 3 && styleOf(u.id)).slice(0, 4);
  return [
    ...front.map((u) => ({ id: u.id, star: 2 as const, front: true, items: [] })),
    ...back.map((u) => ({
      id: u.id, star: 2 as const, front: false,
      items: emblemStyle && !getUnitTraits(u.id, 's1').includes(emblemStyle)
        ? [EMBLEM[emblemStyle]]
        : (fillSlot ? [RIVAL_ITEM] : []),
    })),
  ];
}

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

const BARE = board(null);
function rate(emblemStyle: RunStyle | null, policy: StyleResolution,
  conds: RaceConditions[] = CONDS, n = 400, opponent: Spec[] = BARE, fillSlot = false): number {
  const mine = board(emblemStyle, fillSlot);
  let wins = 0;
  for (let i = 0; i < n; i += 1) {
    const r = simulateBattle(side('a', mine), side('b', opponent), Rng.forStream(i, 'emblem'),
      { conditions: conds[i % conds.length], g1ThemeId: 'ARIMA', styleResolution: policy });
    if (r.winner === 'A') wins += 1;
  }
  return (wins / n) * 100;
}

const carryStyles = [...new Set(board(null).filter((s) => !s.front)
  .map((s) => styleOf(s.id)).filter((x): x is RunStyle => !!x))];
say('');
say('1) 같은 보드, 뒷줄 캐리 4명에게만 각질 인자를 박았을 때의 승률');
say('   상대는 인자 없는 같은 보드. 50%가 기준선이고, 그 위가 인자의 값이다.');
say('   캐리 고유 각질: ' + carryStyles.map((s) => getTrait(s).name).join(', '));
say('');
say('  ' + pad('부여 각질', 12) + (['FIRST', 'NATIVE', 'BLEND', 'STACK'] as StyleResolution[])
  .map((p) => pad(p, 10)).join(''));
const policies: StyleResolution[] = ['FIRST', 'NATIVE', 'BLEND', 'STACK'];
const worst: Record<string, number> = {};
for (const style of [null, ...RUN_STYLES] as Array<RunStyle | null>) {
  const label = style ? getTrait(style).name + ' 인자' : '(인자 없음)';
  const row = policies.map((p) => rate(style, p));
  row.forEach((v, i) => { worst[policies[i]] = Math.max(worst[policies[i]] ?? 0, Math.abs(v - 50)); });
  say('  ' + pad(label, 12) + row.map((v) => pad(v.toFixed(1) + '%', 10)).join(''));
}
say('');
say('  ' + pad('기준선 50%에서 벗어난 최대폭', 30)
  + policies.map((p) => pad(worst[p].toFixed(1) + 'p', 10)).join(''));
say('  → 작을수록 인자가 각질 곡선을 덜 왜곡한다는 뜻. 인자는 시너지 도구여야지');
say('    그 자체로 승률을 사는 도구여서는 안 된다.');

// ------------------------------------------------------- pace interaction
say('');
say('2) 페이스별 — 인자가 페이스 대응까지 사버리는가');
say('   하이페이스는 도주를 죽이고 추입을 살린다. 인자로 두 각질을 가지면');
say('   어느 페이스에서도 손해를 안 볼 수 있는지 확인한다.');
for (const policy of policies) {
  say('  ' + policy);
  for (const pace of PACE_DEFS) {
    const conds: RaceConditions[] = [{ ...DEFAULT_CONDITIONS, pace: pace.id }];
    const bare = rate(null, policy, conds, 300);
    const row = RUN_STYLES.map((st) => rate(st, policy, conds, 300));
    const spread = Math.max(...row) - Math.min(...row);
    say('    ' + pad(pace.nameKo, 12) + '인자없음 ' + bare.toFixed(1).padStart(5) + '%   '
      + RUN_STYLES.map((st, i) => getTrait(st).name + ' ' + row[i].toFixed(0) + '%').join(' · ')
      + '   폭 ' + spread.toFixed(1) + 'p');
  }
}

// ------------------------------------------------- opportunity cost
say('');
say('3) 슬롯 값을 치른 뒤 — 인자 대신 진짜 아이템을 꽂았을 때와 비교');
say('   인자는 아이템 슬롯을 먹는다. 빈 슬롯과 비교하면 공짜 특성으로 계산되어');
say('   매번 과대평가된다. 상대도 같은 슬롯에 ' + RIVAL_ITEM + '을 든 보드다.');
const RIVAL_BOARD = board(null, true);
say('');
say('  ' + pad('부여 각질', 12) + pad('빈 슬롯 상대', 14) + pad('아이템 상대', 14) + '슬롯 값');
for (const style of RUN_STYLES) {
  const free = rate(style, DEFAULT_STYLE_RESOLUTION);
  const paid = rate(style, DEFAULT_STYLE_RESOLUTION, CONDS, 400, RIVAL_BOARD);
  say('  ' + pad(getTrait(style).name + ' 인자', 12)
    + pad(free.toFixed(1) + '%', 14) + pad(paid.toFixed(1) + '%', 14)
    + (paid - free >= 0 ? '+' : '') + (paid - free).toFixed(1) + 'p');
}
say('  → 오른쪽 열이 실제 값이다. 50%를 크게 넘으면 그 인자는 아이템 한 칸보다 세다.');

// ------------------------------------------------- the 추입 outlier
say('');
say('4) 추입이 왜 혼자 튀는가 — 세 가지가 같은 방향을 가리킨다');
say('  ' + pad('각질', 8) + pad('발동 임계', 14) + pad('최종직선 곡선', 16) + pad('초반 피해감소', 16) + '2단계 효과');
const TIER_NOTE: Record<RunStyle, string> = {
  nige: '공속 +10%, 발주 6초 피해 +4%',
  senko: '체력 60% 이상일 때 피해 +8%',
  sashi: '치명타 +5%',
  oikomi: '대상 체력 50% 이하일 때 피해 +12%',
};
for (const style of RUN_STYLES) {
  const t = getTrait(style);
  const straight = styleStepAt(style, 'LAST_3F');
  const early = styleStepAt(style, 'START');
  say('  ' + pad(t.name, 8) + pad(t.thresholds.join(' / '), 14)
    + pad((straight.damage >= 0 ? '+' : '') + (straight.damage * 100).toFixed(0) + '%', 16)
    + pad('+' + (early.resist * 100).toFixed(0) + '%', 16) + TIER_NOTE[style]);
}
say('');
say('  추입만 임계가 한 칸씩 낮고(3/5 대 4/6), 최종직선 보너스가 가장 크고,');
say('  2단계 효과가 하필 승부가 나는 구간에 항상 켜져 있다. 셋이 곱해진다.');
say('');
say('  셋 중 어느 것이 실제로 값을 내는지 하나씩 껐다.');
say('');
say('  주의 — 추입 수치를 건드리면 *양쪽 모두* 바뀐다. 앞줄 1·2코 유닛 중에도');
say('  타고난 추입이 있어서, 승률을 그냥 재면 상대가 약해진 몫까지 섞여 들어온다.');
say('  그래서 재는 것은 승률이 아니라 **인자의 순값** — 같은 수정 아래에서');
say('  (인자 박은 보드 승률) − (인자 없는 보드 승률). 공유되는 몫은 상쇄된다.');
say('');
const oikomiTrait = getTrait('oikomi');
const oikomiCurve = STYLE_CURVES.oikomi;

/** The emblem's own contribution, with everything both sides share cancelled. */
const emblemValue = (): number =>
  rate('oikomi', DEFAULT_STYLE_RESOLUTION, CONDS, 400, RIVAL_BOARD)
  - rate(null, DEFAULT_STYLE_RESOLUTION, CONDS, 400, RIVAL_BOARD, true);

const before = emblemValue();
say('  ' + pad('손대지 않음', 28) + '인자 순값 ' + (before >= 0 ? '+' : '') + before.toFixed(1).padStart(5) + 'p');

const probe = (label: string, mutate: () => () => void): void => {
  const restore = mutate();
  const v = emblemValue();
  restore();
  say('  ' + pad(label, 28) + '인자 순값 ' + (v >= 0 ? '+' : '') + v.toFixed(1).padStart(5) + 'p'
    + '   변화 ' + (v - before >= 0 ? '+' : '') + (v - before).toFixed(1).padStart(5) + 'p');
};

probe('임계를 2/4/6/8/10으로', () => {
  const old = [...oikomiTrait.thresholds];
  const oldCounts = oikomiTrait.tiers.map((t) => t.count);
  oikomiTrait.thresholds = [2, 4, 6, 8, 10];
  oikomiTrait.tiers.forEach((t, i) => { (t as { count: number }).count = [2, 4, 6, 8, 10][i]; });
  return () => {
    oikomiTrait.thresholds = old;
    oikomiTrait.tiers.forEach((t, i) => { (t as { count: number }).count = oldCounts[i]; });
  };
});

probe('곡선을 선입과 같게', () => {
  const old = oikomiCurve.steps.map((st) => ({ ...st }));
  STYLE_CURVES.sashi.steps.forEach((src, i) => {
    const dst = oikomiCurve.steps[i] as { damage: number; resist: number };
    dst.damage = src.damage; dst.resist = src.resist;
  });
  return () => { old.forEach((src, i) => Object.assign(oikomiCurve.steps[i], src)); };
});

probe('최종직선만 +26% → +18%', () => {
  const step = oikomiCurve.steps.find((st) => st.phases.includes('LAST_3F'))! as { damage: number };
  const old = step.damage;
  step.damage = 0.18;
  return () => { step.damage = old; };
});

// Halving only tiers[0] would nerf a two-count board and leave a six-count one
// — which is my side — untouched. Every tier has to move together.
probe('단계 피해 증폭 절반으로', () => {
  const old = oikomiTrait.tiers.map((t) => t.effects);
  oikomiTrait.tiers.forEach((t) => {
    (t as { effects: typeof old[0] }).effects = t.effects.map((e) =>
      e.kind === 'DAMAGE_AMP' ? { ...e, value: (e.value ?? 0) / 2 } : e);
  });
  return () => { oikomiTrait.tiers.forEach((t, i) => { (t as { effects: typeof old[0] }).effects = old[i]; }); };
});

const out = process.argv.indexOf('--out');
if (out >= 0 && process.argv[out + 1]) {
  writeFileSync(process.argv[out + 1], LINES.join('\n') + '\n');
  console.log('\nwrote ' + process.argv[out + 1]);
}
void getUnitDef;
