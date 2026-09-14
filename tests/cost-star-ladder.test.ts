import { describe, expect, it } from 'vitest';
import {
  BASE_AD, BASE_HP, BASE_RESIST, COST_SKILL_POWER, STAR_STAT_MULT,
  costStatWeight, starSkillMultiplier, starStatMultiplier,
} from '../src/game/engine/constants';
import { getSeasonUnits } from '../src/game/engine/roster';
import type { Cost } from '../src/game/engine/types';

const COSTS: Cost[] = [1, 2, 3, 4, 5];
/** Health, damage and resistances a cost/star combination actually fields. */
const statLine = (cost: Cost, star: 1 | 2 | 3) => {
  const m = starStatMultiplier(star, cost);
  return { hp: BASE_HP[cost] * m, ad: BASE_AD[cost] * m, resist: BASE_RESIST[cost] * m };
};

/**
 * The cost ladder.
 *
 * A player reported losing every fight with a four-cost board, and the cause was
 * that one star level was worth about six cost steps: a one-star four-cost was
 * strictly worse than a two-star three-cost on health, damage, resistances and
 * skill at once, so the tier was unfieldable and turned up in 3 of 40 final
 * boards while five-costs turned up in none. These are the invariants that make
 * that state detectable rather than something a player has to report.
 */
describe('cost and star ladder', () => {
  it('keeps a one-star of cost N worth most of a two-star of cost N-1', () => {
    // The relationship every auto-battler leans on. Below ~0.8 the expensive
    // tier stops being worth buying at the star level it can actually reach.
    for (const cost of [2, 3, 4, 5] as Cost[]) {
      const mine = statLine(cost, 1);
      const cheaper = statLine((cost - 1) as Cost, 2);
      const ratio = (mine.hp / cheaper.hp + mine.ad / cheaper.ad) / 2;
      // Costs 2 and 3 are meant to be rerolled, so they may sit lower.
      const floor = cost >= 4 ? 0.8 : 0.5;
      expect(ratio, `${cost}코 1성 vs ${cost - 1}코 2성`).toBeGreaterThanOrEqual(floor);
    }
  });

  it('never lets a cheaper unit strictly dominate a dearer one at the same star', () => {
    for (const star of [1, 2] as const) {
      for (let i = 1; i < COSTS.length; i += 1) {
        const dear = statLine(COSTS[i], star);
        const cheap = statLine(COSTS[i - 1], star);
        expect(dear.hp, `${COSTS[i]}코 ${star}성 hp`).toBeGreaterThan(cheap.hp);
        expect(dear.ad, `${COSTS[i]}코 ${star}성 ad`).toBeGreaterThan(cheap.ad);
        expect(dear.resist, `${COSTS[i]}코 ${star}성 저항`).toBeGreaterThanOrEqual(cheap.resist);
      }
    }
  });

  /**
   * The benchmarks the designer set: a two-star four-cost sits just under a
   * three-star two-cost, and a two-star five-cost is worth about a three-star
   * three-cost. A two-star five-cost therefore lands *above* a three-star
   * two-cost, which is intended — three copies from a pool of 9, available only
   * at levels 9 and 10, is the harder thing to assemble.
   */
  const skill = (cost: Cost, star: 1 | 2 | 3) => COST_SKILL_POWER[cost] * starSkillMultiplier(star, cost);

  it('puts a two-star four-cost just under a three-star two-cost', () => {
    const dear = statLine(4, 2);
    const rerolled = statLine(2, 3);
    expect(dear.hp / rerolled.hp).toBeGreaterThan(0.75);
    expect(dear.hp / rerolled.hp).toBeLessThan(0.95);
    expect(skill(4, 2) / skill(2, 3)).toBeGreaterThan(0.8);
    expect(skill(4, 2) / skill(2, 3)).toBeLessThan(1);
  });

  it('puts a two-star five-cost at about a three-star three-cost', () => {
    const dear = statLine(5, 2);
    const rerolled = statLine(3, 3);
    expect(dear.hp / rerolled.hp).toBeGreaterThan(0.82);
    expect(dear.hp / rerolled.hp).toBeLessThan(1.05);
    expect(skill(5, 2) / skill(3, 3)).toBeGreaterThan(0.85);
  });

  it('pays the expensive tiers in firepower rather than bulk', () => {
    // This is what keeps the two ladders from being the same unit twice: the
    // dear unit wins its trade by hitting harder, the rerolled one by lasting.
    for (const [dearCost, cheapCost] of [[4, 2], [5, 3]] as Array<[Cost, Cost]>) {
      const dear = statLine(dearCost, 2);
      const rerolled = statLine(cheapCost, 3);
      expect(dear.ad / rerolled.ad, `${dearCost}코2성 화력`).toBeGreaterThan(1);
      expect(dear.hp / rerolled.hp, `${dearCost}코2성 체력`).toBeLessThan(1);
    }
  });

  it('keeps rerolling worth it against the tier it actually competes with', () => {
    // Nine copies of a two-cost must still beat three copies of a four-cost.
    const rerolled = statLine(2, 3);
    const bought = statLine(4, 2);
    expect(rerolled.hp * skill(2, 3)).toBeGreaterThan(bought.hp * skill(4, 2));
    expect(statLine(3, 3).hp * skill(3, 3)).toBeGreaterThan(statLine(5, 2).hp * skill(5, 2));
  });

  it('flattens the star curve only where three stars are out of reach', () => {
    // One- to three-costs are the tiers built to be rerolled and keep the full
    // second star; four- and five-costs cannot be found nine times, so their
    // power sits in the base instead.
    for (const cost of [1, 2, 3] as Cost[]) expect(starStatMultiplier(2, cost)).toBe(STAR_STAT_MULT[2]);
    for (const cost of [4, 5] as Cost[]) expect(starStatMultiplier(2, cost)).toBeLessThan(STAR_STAT_MULT[2]);
    // Star one is always the baseline, whatever the cost.
    for (const cost of COSTS) expect(starStatMultiplier(1, cost)).toBe(1);
  });

  it('gives anything estimating power a cost weight that matches the real curve', () => {
    // The AI reads this. A linear guess said a one-star four-cost was worth less
    // than a two-star two-cost when their stat lines are within a few percent.
    for (let i = 1; i < COSTS.length; i += 1) {
      expect(costStatWeight(COSTS[i])).toBeGreaterThan(costStatWeight(COSTS[i - 1]));
    }
    expect(costStatWeight(1)).toBe(1);
    const fourAtOne = costStatWeight(4) * starStatMultiplier(1, 4);
    const twoAtTwo = costStatWeight(2) * starStatMultiplier(2, 2);
    expect(Math.abs(fourAtOne / twoAtTwo - 1)).toBeLessThan(0.2);
  });

  it('leaves every cost tier able to field a front line', () => {
    // A tier with almost no tanks cannot hold a board on its own however good
    // its numbers are: the reported four-cost board had two front-liners against
    // four and lost its whole back line inside two seconds.
    const s1 = getSeasonUnits('s1');
    for (const cost of COSTS) {
      const tier = s1.filter((u) => u.cost === cost);
      if (!tier.length) continue;
      const front = tier.filter((u) => u.role === 'TANK' || u.role === 'BRUISER').length;
      expect(front, `${cost}코 앞줄 유닛 수 (${front}/${tier.length})`).toBeGreaterThanOrEqual(2);
    }
  });
});
