/**
 * 각질별 페이즈 보정 — what each running style is actually good at, and when.
 *
 * Until now a unit's 각질 was a trait threshold and nothing else: 도주 and 추입
 * fought the same fight at the same strength from the first second to the last.
 * That is the one thing horse racing never does. A front-runner spends its lead
 * early and is hanging on by the straight; a closer gives up the first half of
 * the race on purpose and is paid back in the last 600 metres.
 *
 * So every unit — not only the GⅠ entry — now runs a curve keyed to the race
 * phase. Two things make it work rather than being a wash:
 *
 *  1. **The curve is not symmetric in time.** 중반 is half the race, 4코너 and
 *     최종 직선 a sixth each, and a good share of fights end before the straight
 *     ever opens. A late payout that merely mirrors the early one is worth far
 *     less than it looks, so the back-loaded styles are paid at a premium and
 *     the front-loaded ones surrender less than they gain.
 *  2. **Survival is half the curve.** A closer that dies at 중반 never collects.
 *     추입 and 선입 buy their late damage with early damage reduction, which is
 *     what actually gets them to the straight, and is why the trade is a real
 *     decision rather than a number that averages out.
 *
 * On top of the curve each style carries one *signature*: a structural payout
 * that fires once and changes how the unit plays, not what its numbers say.
 */
import type { EffectDef, RunStyle } from '../types';
import type { RaceCombatPhase } from './types';

/** Damage dealt / damage taken, as fractions, for one phase of one style. */
export type StyleCurveStep = {
  phases: RaceCombatPhase[];
  /** Bonus to damage dealt. Negative is the price a front-runner pays late. */
  damage: number;
  /** Bonus to damage reduction. This is what buys a closer its way to the straight. */
  resist: number;
};

export type StyleCurve = {
  style: RunStyle;
  nameKo: string;
  /** One line, in the language a race call uses. */
  summaryKo: string;
  steps: StyleCurveStep[];
  /** The structural payout. Fires once; see each style's note. */
  signature: {
    nameKo: string;
    descriptionKo: string;
    effects: EffectDef[];
  };
};

const EARLY: RaceCombatPhase[] = ['START'];
const MID: RaceCombatPhase[] = ['POSITIONING'];
const CORNER: RaceCombatPhase[] = ['LATE'];
const STRAIGHT: RaceCombatPhase[] = ['LAST_3F', 'OVERTIME'];

/**
 * The four curves.
 *
 * Read down a column and you get the shape of the style; read across a row and
 * the four styles should roughly cancel, so no style is simply stronger. The
 * late numbers are larger than the early ones on purpose — see the note above.
 */
export const STYLE_CURVES: Record<RunStyle, StyleCurve> = {
  nige: {
    style: 'nige',
    nameKo: '도주',
    summaryKo: '발주부터 앞에 서서 상대를 끌고 갑니다. 대신 최종 직선에서는 다리가 남지 않습니다.',
    steps: [
      { phases: EARLY, damage: 0.12, resist: 0.02 },
      { phases: MID, damage: 0.07, resist: 0 },
      { phases: CORNER, damage: 0, resist: 0 },
      { phases: STRAIGHT, damage: -0.08, resist: 0.06 },
    ],
    signature: {
      nameKo: '대도주',
      descriptionKo:
        '4코너를 절반 이상 체력으로 돌면 앞선 리드가 그대로 굳어, 최종 직선에서도 다리가 풀리지 않습니다.',
      // Held from the corner onward and never replaced, so it cancels the
      // straight's decay and then some. Only a nige that was actually winning
      // in front collects it.
      effects: [
        {
          kind: 'DAMAGE_AMP', value: 0.14, duration: 999, oncePerCombat: true,
          trigger: { when: 'ON_RACE_PHASE', phase: 'LATE', hpAbove: 0.5 },
        },
      ],
    },
  },
  senko: {
    style: 'senko',
    nameKo: '선행',
    summaryKo: '2, 3번수에 붙어 가다 4코너에서 먼저 승부를 겁니다. 어느 구간에도 약점이 없습니다.',
    steps: [
      { phases: EARLY, damage: 0.05, resist: 0.01 },
      { phases: MID, damage: 0.07, resist: 0.01 },
      { phases: CORNER, damage: 0.09, resist: 0 },
      { phases: STRAIGHT, damage: 0.05, resist: 0 },
    ],
    signature: {
      nameKo: '호흡 맞추기',
      descriptionKo:
        '구간이 바뀔 때마다 숨을 고릅니다. 페이스가 넘어갈 때마다 기력이 차서, 그만큼 스킬이 더 자주 나갑니다.',
      // Mana on every phase crossing: four crossings over a full race, so senko
      // is the style that casts most. Structural rather than numeric.
      effects: [
        { kind: 'MANA_ADD', value: 18, trigger: { when: 'ON_RACE_PHASE', phase: 'POSITIONING' } },
        { kind: 'MANA_ADD', value: 18, trigger: { when: 'ON_RACE_PHASE', phase: 'LATE' } },
        { kind: 'MANA_ADD', value: 18, trigger: { when: 'ON_RACE_PHASE', phase: 'LAST_3F' } },
      ],
    },
  },
  sashi: {
    style: 'sashi',
    nameKo: '선입',
    summaryKo: '중반까지 말군에 묻혀 있다가 4코너부터 밖으로 나옵니다. 앞이 비어 있을수록 잘 뻗습니다.',
    steps: [
      { phases: EARLY, damage: -0.05, resist: 0.06 },
      { phases: MID, damage: 0.01, resist: 0.03 },
      { phases: CORNER, damage: 0.12, resist: 0 },
      { phases: STRAIGHT, damage: 0.18, resist: 0 },
    ],
    signature: {
      nameKo: '말군 빠져나오기',
      descriptionKo:
        '최종 직선에 들어서면 앞에 남은 말 수만큼 발이 빨라집니다. 상대가 많이 남아 있을수록 크게 뻗습니다.',
      // scaleBy turns "still standing over there" into the magnitude, which is
      // exactly the read a closer makes coming out of the corner.
      effects: [
        {
          kind: 'STAT_MUL', stat: 'attackSpeed', value: 0.05, duration: 999,
          scaleBy: 'ENEMIES_ALIVE', scaleCap: 6, oncePerCombat: true,
          trigger: { when: 'ON_RACE_PHASE', phase: 'LAST_3F' },
        },
      ],
    },
  },
  oikomi: {
    style: 'oikomi',
    nameKo: '추입',
    summaryKo: '마지막 600m에 모든 것을 겁니다. 그 전까지는 맞아도 버티며 다리를 아낍니다.',
    steps: [
      { phases: EARLY, damage: -0.09, resist: 0.1 },
      { phases: MID, damage: -0.03, resist: 0.07 },
      { phases: CORNER, damage: 0.14, resist: 0 },
      { phases: STRAIGHT, damage: 0.26, resist: 0 },
    ],
    signature: {
      nameKo: '직선 한 방',
      descriptionKo:
        '최종 직선에 들어서는 순간 아껴 둔 기력이 한꺼번에 터집니다. 기력이 가득 차 곧바로 승부수가 나가고, 그 한 방이 유독 무겁습니다.',
      // Fill the bar so the cast lands on the next tick, and amplify that cast.
      // A closer's whole race is this one release.
      effects: [
        { kind: 'MANA_FILL', value: 1, oncePerCombat: true, trigger: { when: 'ON_RACE_PHASE', phase: 'LAST_3F' } },
        {
          kind: 'SKILL_DAMAGE_AMP', value: 0.3, duration: 6, oncePerCombat: true,
          trigger: { when: 'ON_RACE_PHASE', phase: 'LAST_3F' },
        },
      ],
    },
  },
};

export const RUN_STYLES: RunStyle[] = ['nige', 'senko', 'sashi', 'oikomi'];

/**
 * Every effect the curve contributes for one style, ready to bind.
 *
 * The curve steps come back as continuously-gated auras, so they switch
 * themselves on and off as the race moves without the engine tracking anything;
 * the signature comes back as its own one-shot effects.
 */
export function styleCurveEffects(style: RunStyle): EffectDef[] {
  const curve = STYLE_CURVES[style];
  const out: EffectDef[] = [];
  for (const step of curve.steps) {
    if (step.damage !== 0) {
      out.push({ kind: 'DAMAGE_AMP', value: step.damage, trigger: { when: 'IN_RACE_PHASE', phases: step.phases } });
    }
    if (step.resist !== 0) {
      out.push({ kind: 'DAMAGE_REDUCTION', value: step.resist, trigger: { when: 'IN_RACE_PHASE', phases: step.phases } });
    }
  }
  out.push(...curve.signature.effects);
  return out;
}

/** The step in force during `phase`, for the HUD and for tests. */
export function styleStepAt(style: RunStyle, phase: RaceCombatPhase): StyleCurveStep {
  const curve = STYLE_CURVES[style];
  return curve.steps.find((s) => s.phases.includes(phase))
    ?? { phases: [phase], damage: 0, resist: 0 };
}

/**
 * Total damage a style's curve contributes across a whole race, weighted by how
 * long each phase actually lasts. Used by the balance test to keep the four
 * styles from drifting apart.
 */
export function curveWeightedDamage(style: RunStyle, weights: Record<RaceCombatPhase, number>): number {
  let total = 0;
  for (const phase of Object.keys(weights) as RaceCombatPhase[]) {
    total += styleStepAt(style, phase).damage * weights[phase];
  }
  return total;
}
