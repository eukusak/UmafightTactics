import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STYLE_RESOLUTION, RUN_STYLES, STYLE_CURVES, resolveRunStyles,
  styleCurveEffects, styleStepAt, type StyleResolution,
} from '../src/game/engine/race-plan/style-curve';
import { getItem } from '../src/game/engine/items/item-defs';
import { getTrait } from '../src/game/engine/traits/trait-defs';
import type { RunStyle, TraitId } from '../src/game/engine/types';

/**
 * Emblems let a board reach a 각질 threshold the roster will not give it, so a
 * unit can end up holding two running styles. It still has to run one race.
 */
describe('한 유닛이 각질을 둘 가졌을 때', () => {
  const native: TraitId[] = ['oikomi'];
  const both: TraitId[] = ['oikomi', 'nige'];

  it('각질이 하나뿐이면 어느 정책에서도 그대로다', () => {
    for (const policy of ['FIRST', 'NATIVE', 'BLEND', 'STACK'] as StyleResolution[]) {
      expect(resolveRunStyles(native, native, policy))
        .toEqual([{ style: 'oikomi', weight: 1, signature: true }]);
    }
  });

  it('BLEND는 곡선을 나눠 갖고 시그니처는 고유 각질 하나만 남긴다', () => {
    const got = resolveRunStyles(both, native, 'BLEND');
    expect(got).toHaveLength(2);
    expect(got.every((r) => r.weight === 0.5)).toBe(true);
    expect(got.filter((r) => r.signature).map((r) => r.style)).toEqual(['oikomi']);
  });

  it('NATIVE는 타고난 각질만 달리고 인자는 특성 수만 올린다', () => {
    expect(resolveRunStyles(both, native, 'NATIVE'))
      .toEqual([{ style: 'oikomi', weight: 1, signature: true }]);
  });

  it('STACK은 두 곡선을 모두 전부 적용한다 — 약한 구간이 사라지는 경우', () => {
    const got = resolveRunStyles(both, native, 'STACK');
    expect(got.map((r) => r.weight)).toEqual([1, 1]);
  });

  /**
   * The regression this policy exists for: `RUN_STYLES.find(...)` answered from
   * the array's declaration order, so a 추입 carry handed a 도주 인자 quietly
   * swapped its closer curve for a front-runner's and nobody could see why.
   */
  it('FIRST는 선언 순서로 답을 내서 고유 각질을 지운다 — 그래서 기본값이 아니다', () => {
    expect(RUN_STYLES.indexOf('nige')).toBeLessThan(RUN_STYLES.indexOf('oikomi'));
    expect(resolveRunStyles(both, native, 'FIRST')[0].style).toBe('nige');
    expect(DEFAULT_STYLE_RESOLUTION).not.toBe('FIRST');
  });

  it('BLEND된 최종직선 보정은 두 각질 사이에 놓인다', () => {
    const blended = resolveRunStyles(both, native, 'BLEND')
      .reduce((n, r) => n + styleStepAt(r.style, 'LAST_3F').damage * r.weight, 0);
    const lo = styleStepAt('nige', 'LAST_3F').damage;
    const hi = styleStepAt('oikomi', 'LAST_3F').damage;
    expect(blended).toBeGreaterThan(lo);
    expect(blended).toBeLessThan(hi);
  });

  it('시그니처를 뺀 곡선 효과는 단계 효과만 남긴다', () => {
    for (const style of RUN_STYLES) {
      const withSig = styleCurveEffects(style, true);
      const without = styleCurveEffects(style, false);
      expect(without.length).toBe(withSig.length - STYLE_CURVES[style].signature.effects.length);
    }
  });
});

describe('각질 특성과 인자', () => {
  it('네 각질 모두 인자 아이템이 존재하고 그 특성을 부여한다', () => {
    for (const style of RUN_STYLES) {
      const id = getTrait(style).emblemItemId;
      expect(id, `${style} has no emblem`).toBeTruthy();
      expect(getItem(id!).grantsTrait).toBe(style);
    }
  });

  /**
   * 추입 sits a whole step below the others at every tier. That is deliberate —
   * its roster is six to nine units a season because it has no three- or
   * four-cost entry at all, so the normal 4/6/8/10 ladder is unreachable and the
   * trait would never switch on.
   *
   * The catch is that an emblem buys 추입 count from an item slot, which skips
   * the roster hole the compressed ladder was compensating for. Pinned here so
   * that if the roster gains its missing 추입 units, whoever adds them sees that
   * this ladder is the other half of the same decision.
   */
  it('각질 특성의 발동 임계를 고정한다 — 추입만 한 칸씩 낮다', () => {
    const ladders = Object.fromEntries(
      RUN_STYLES.map((s: RunStyle) => [s, getTrait(s).thresholds]),
    );
    expect(ladders).toEqual({
      nige: [2, 4, 6, 8, 10],
      senko: [2, 4, 6, 8, 10],
      sashi: [2, 4, 6, 8, 10],
      oikomi: [2, 3, 5, 7, 9],
    });
  });
});
