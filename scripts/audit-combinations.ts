/**
 * The wide sweep: 각질 × 특성 폭 × 증강 × 레이스플랜 × 컨디션, all crossed.
 *
 * Every other audit isolates one axis. This one runs the cross product and then
 * asks two different questions of the same pile of battles:
 *
 *  1. **Which single choice moves the result most?** — the marginal mean for
 *     each level of each factor, which is the number a player should act on.
 *  2. **Does the right answer change with the situation?** — the same factor
 *     read inside each condition and each 각질. A factor with a big marginal but
 *     the same winner everywhere is a power level; a factor whose winner moves
 *     is a decision, and decisions are what the game is made of.
 *
 *   npm run audit:combinations -- --battles 240
 */
import { writeFileSync } from 'node:fs';
import { simulateBattle, type BattleSideInput } from '../src/game/engine/battle/engine';
import { Rng } from '../src/game/engine/rng';
import { getSeasonUnits, getUnitTraits } from '../src/game/engine/roster';
import { getTrait } from '../src/game/engine/traits/trait-defs';
import { RUN_STYLES } from '../src/game/engine/race-plan/style-curve';
import { DEFAULT_CONDITIONS, describeConditions, type RaceConditions } from '../src/game/engine/race-plan/conditions';
import type { RunStyle } from '../src/game/engine/types';

const arg = (name: string, fallback: number): number => {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 ? Number(process.argv[i + 1]) || fallback : fallback;
};
const BATTLES = arg('battles', 240);

const LINES: string[] = [];
const say = (line = ''): void => { LINES.push(line); console.log(line); };
const width = (s: string): number => [...s].reduce((w, ch) => w + (ch.charCodeAt(0) > 127 ? 2 : 1), 0);
const pad = (s: string, n: number): string => s + ' '.repeat(Math.max(0, n - width(s)));

const s1 = getSeasonUnits('s1');
const isFront = (r: string): boolean => r === 'TANK' || r === 'BRUISER';
const hasStyle = (id: string, st: RunStyle): boolean => getUnitTraits(id, 's1').includes(st);

// ------------------------------------------------------------------- factors

type Spec = { id: string; star: 1 | 2 | 3; front: boolean; items: string[] };

/**
 * Boards are built on one fixed cost skeleton so a 각질 lean never smuggles in
 * a cost advantage — the mistake that made an earlier audit report 100%.
 */
const SKELETON = [
  { cost: 1, front: true }, { cost: 2, front: true }, { cost: 2, front: true }, { cost: 3, front: true },
  { cost: 3, front: false }, { cost: 3, front: false }, { cost: 4, front: false }, { cost: 4, front: false },
];

/** `lean` biases each slot toward that 각질 where the roster allows it. */
function buildBoard(lean: RunStyle | null): Spec[] {
  const used = new Set<string>();
  return SKELETON.map((slot) => {
    const fits = s1.filter((u) => u.cost === slot.cost && isFront(u.role) === slot.front && !used.has(u.id));
    // Prefer the lean; fall back to any unit of the right cost and role.
    const pick = (lean && fits.find((u) => hasStyle(u.id, lean))) ?? fits[0];
    if (!pick) throw new Error(`cannot fill ${slot.cost}${slot.front ? 'F' : 'B'}`);
    used.add(pick.id);
    return { id: pick.id, star: 2 as const, front: slot.front, items: [] };
  });
}

const STYLE_LEANS: Array<[string, RunStyle | null]> = [
  ['혼합', null], ...RUN_STYLES.map((st) => [getTrait(st).name, st] as [string, RunStyle]),
];

/**
 * Every id here must have a live `teamEffects` entry. `trait_double` looks like
 * the obvious partner for 특성 폭 but it is `teamEffects: []` with a prep-phase
 * grant, so inside `simulateBattle` it does nothing at all and would have made
 * that whole column read weak for a reason that has nothing to do with balance.
 */
const AUGMENT_SETS: Array<[string, string[]]> = [
  ['없음', []],
  ['앞줄 보강', ['combat_front_guard', 'armor_lesson']],
  ['후열 화력', ['combat_back_focus', 'spell_jewel']],
  ['특성 폭', ['team_diversity', 'combat_all_stats']],
  ['후반 특화', ['overtime_master', 'finisher_mana']],
  ['처형 특화', ['combat_execute', 'spell_wound']],
];

const PLANS: Array<[string, string[] | null]> = [
  ['없음', null],
  ['앞서가기', ['RP_LEAD_CONTROL', 'EV_EARLY_FRONT_LOCK', 'FM_FRONT_WIRE']],
  ['버티기', ['RP_SLOW_SAVE_LEGS', 'EV_LATE_SURGE', 'FM_SECOND_WIND']],
  ['막판승부', ['RP_LAST3F_ACCEL', 'EV_LATE_LONG_SPURT', 'FM_LAST_3F']],
  ['초반압박', ['RP_HIGH_PACE_PRESSURE', 'EV_EARLY_OVERPACE', 'FM_BREAKAWAY']],
];

const CONDITIONS: Array<[string, RaceConditions]> = [
  ['기준', DEFAULT_CONDITIONS],
  ['하이페이스', { going: 'GOOD', pace: 'HIGH', weather: 'CLEAR', clause: 'NONE' }],
  ['슬로우페이스', { going: 'GOOD', pace: 'SLOW', weather: 'CLEAR', clause: 'NONE' }],
  ['불량마장·비', { going: 'SOFT', pace: 'MIDDLE', weather: 'RAIN', clause: 'NONE' }],
  ['장직선 개최', { going: 'FIRM', pace: 'MIDDLE', weather: 'CLEAR', clause: 'LONG_STRAIGHT' }],
];

function side(tag: string, spec: Spec[], augments: string[], plan: string[] | null): BattleSideInput {
  let f = 0, b = 0;
  const units = spec.map((s, i) => ({
    instanceId: tag + i, unitDefId: s.id, star: s.star, items: s.items,
    position: s.front ? { q: f++ % 4, r: 0 } : { q: b++ % 4, r: 1 },
  }));
  const entry = units[units.length - 1];
  return {
    playerId: tag, augments, tacticianItems: [], units,
    racePlan: plan ? {
      entryUnitDefId: entry.unitDefId, entryInstanceId: entry.instanceId,
      nodeIds: plan, trackState: 'STANDARD',
    } : undefined,
  };
}

/** The yardstick: a neutral board with no augments and no plan. */
const REFERENCE = buildBoard(null);

type Row = {
  lean: string; augments: string; plan: string; conditions: string; rate: number;
};
const rows: Row[] = [];
const TOTAL = STYLE_LEANS.length * AUGMENT_SETS.length * PLANS.length * CONDITIONS.length;
const started = Date.now();

for (const [leanName, lean] of STYLE_LEANS) {
  const spec = buildBoard(lean);
  for (const [augName, augments] of AUGMENT_SETS) {
    for (const [planName, plan] of PLANS) {
      for (const [condName, cond] of CONDITIONS) {
        let wins = 0;
        for (let i = 0; i < BATTLES; i += 1) {
          const r = simulateBattle(
            side('a', spec, augments, plan),
            side('b', REFERENCE, [], null),
            Rng.forStream(i, 'combo'), { conditions: cond, g1ThemeId: 'ARIMA' },
          );
          if (r.winner === 'A') wins += 1;
        }
        rows.push({
          lean: leanName, augments: augName, plan: planName,
          conditions: condName, rate: (wins / BATTLES) * 100,
        });
        if (rows.length % 25 === 0) {
          const per = (Date.now() - started) / rows.length;
          process.stderr.write(`  ${rows.length}/${TOTAL} · 남은 시간 약 `
            + `${Math.round((per * (TOTAL - rows.length)) / 60000)}분\n`);
        }
      }
    }
  }
}

// -------------------------------------------------------------------- report

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

say('combination audit — ' + rows.length + '개 조합 × ' + BATTLES + '전 = '
  + (rows.length * BATTLES).toLocaleString('en-US') + '전투');
say('  각질 ' + STYLE_LEANS.length + ' × 증강 ' + AUGMENT_SETS.length
  + ' × 플랜 ' + PLANS.length + ' × 컨디션 ' + CONDITIONS.length);
say('  상대는 모든 칸에서 동일 — 증강 없음, 플랜 없음, 각질 혼합. 기준선 50%.');
say('');
// A lean can only bias the slots the roster can actually fill. 추입 has no
// three- or four-cost unit at all, so five of eight slots fall through to the
// default pick — and the three it can fill happen to already be the default,
// which makes its "board" the 혼합 board with a different label. Printed up
// front so the 각질 column is never read as a statement about 각질 curves.
say('0) 각질 편중이 실제로 채운 슬롯 — 이 열은 각질이 아니라 "어떤 8명이 되는가"를 잰다');
const composition = new Map<string, string>();
for (const [name, lean] of STYLE_LEANS) {
  const b = buildBoard(lean);
  const key = b.map((u) => u.id).join(',');
  const onLean = lean ? b.filter((u) => hasStyle(u.id, lean)).length : 0;
  const dup = [...composition].find(([, k]) => k === key);
  composition.set(name, key);
  say('  ' + pad(name, 8) + (lean ? `맞는 각질 ${onLean}/8` : '편중 없음   ')
    + (dup ? `   ← ${dup[0]} 보드와 완전히 동일. 로스터가 이 각질로 보드를 못 만든다` : ''));
}
say('');

const FACTORS: Array<[string, (r: Row) => string, string[]]> = [
  ['각질', (r) => r.lean, STYLE_LEANS.map(([n]) => n)],
  ['증강', (r) => r.augments, AUGMENT_SETS.map(([n]) => n)],
  ['플랜', (r) => r.plan, PLANS.map(([n]) => n)],
  ['컨디션', (r) => r.conditions, CONDITIONS.map(([n]) => n)],
];

say('1) 축별 한계 효과 — 그 값을 고른 모든 조합의 평균 승률');
const spans: Array<[string, number]> = [];
for (const [name, key, levels] of FACTORS) {
  const got = levels.map((lv) => [lv, mean(rows.filter((r) => key(r) === lv).map((r) => r.rate))] as [string, number]);
  const span = Math.max(...got.map(([, v]) => v)) - Math.min(...got.map(([, v]) => v));
  spans.push([name, span]);
  say('  ' + pad(name, 8) + got.map(([lv, v]) => lv + ' ' + v.toFixed(1) + '%').join('  ·  '));
  say('  ' + pad('', 8) + '→ 폭 ' + span.toFixed(1) + '포인트');
}
say('');
say('  축 무게 순위: ' + [...spans].sort((a, b) => b[1] - a[1])
  .map(([n, v]) => n + ' ' + v.toFixed(1) + 'p').join('  >  '));
say('');

say('2) 가장 센 조합 10개');
for (const r of [...rows].sort((a, b) => b.rate - a.rate).slice(0, 10)) {
  say('  ' + r.rate.toFixed(1).padStart(5) + '%   ' + pad(r.lean, 6) + pad(r.augments, 12)
    + pad(r.plan, 10) + r.conditions);
}
say('');
say('  가장 약한 조합 10개');
for (const r of [...rows].sort((a, b) => a.rate - b.rate).slice(0, 10)) {
  say('  ' + r.rate.toFixed(1).padStart(5) + '%   ' + pad(r.lean, 6) + pad(r.augments, 12)
    + pad(r.plan, 10) + r.conditions);
}
say('');

/** The heart of it: does the best choice change with the situation? */
function bestBy(group: (r: Row) => string, choice: (r: Row) => string, label: string): void {
  say('3-' + label);
  const groups = [...new Set(rows.map(group))];
  const winners = new Map<string, string>();
  for (const g of groups) {
    const inGroup = rows.filter((r) => group(r) === g);
    const byChoice = [...new Set(inGroup.map(choice))]
      .map((c) => [c, mean(inGroup.filter((r) => choice(r) === c).map((r) => r.rate))] as [string, number])
      .sort((a, b) => b[1] - a[1]);
    winners.set(g, byChoice[0][0]);
    say('  ' + pad(g, 14) + '최선 ' + pad(byChoice[0][0], 12) + byChoice[0][1].toFixed(1) + '%'
      + '   최악 ' + pad(byChoice[byChoice.length - 1][0], 12) + byChoice[byChoice.length - 1][1].toFixed(1) + '%'
      + '   폭 ' + (byChoice[0][1] - byChoice[byChoice.length - 1][1]).toFixed(1) + 'p');
  }
  const distinct = new Set(winners.values()).size;
  say('  → 서로 다른 최선이 ' + distinct + '가지'
    + (distinct > 1 ? ' — 상황에 따라 답이 바뀐다 (결정)' : ' — 어디서나 같은 답 (파워 레벨)'));
  say('');
}

say('3) 상황에 따라 정답이 바뀌는가');
bestBy((r) => r.conditions, (r) => r.plan, '1) 컨디션별 최선의 플랜');
bestBy((r) => r.conditions, (r) => r.lean, '2) 컨디션별 최선의 각질');
bestBy((r) => r.lean, (r) => r.plan, '3) 각질별 최선의 플랜');
bestBy((r) => r.lean, (r) => r.augments, '4) 각질별 최선의 증강');
bestBy((r) => r.conditions, (r) => r.augments, '5) 컨디션별 최선의 증강');

const out = process.argv.indexOf('--out');
if (out >= 0 && process.argv[out + 1]) {
  writeFileSync(process.argv[out + 1], LINES.join('\n') + '\n');
  console.log('\nwrote ' + process.argv[out + 1]);
}
void describeConditions;
