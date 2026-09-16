import { describe, expect, it } from 'vitest';
import {
  GOING_ROWS, PACE_ROWS, WEATHER_ROWS, CLAUSE_ROWS, MANDATE_ROWS,
  STYLE_CURVE_ROWS, PHASE_ROWS, CLAUSE_ANY_CHANCE,
} from '../src/game/engine/race-plan/guide';
import { GOING_DEFS, PACE_DEFS, WEATHER_DEFS, CLAUSE_DEFS } from '../src/game/engine/race-plan/conditions';
import { G1_THEMES } from '../src/game/engine/race-plan/profiles';
import { g1Identity } from '../src/game/engine/race-plan/g1-identity';
import { RUN_STYLES, styleStepAt } from '../src/game/engine/race-plan/style-curve';

/**
 * The guide is generated from the definitions rather than written beside them,
 * so these are the tests that keep it that way: add a 마장 or a 특례 and the
 * guide has to grow with it, because the count comes from the same array.
 */
describe('race guide covers every definition', () => {
  it('lists every 마장, 페이스, 날씨 and 특례', () => {
    expect(GOING_ROWS.map(r => r.id)).toEqual(GOING_DEFS.map(d => d.id));
    expect(PACE_ROWS.map(r => r.id)).toEqual(PACE_DEFS.map(d => d.id));
    expect(WEATHER_ROWS.map(r => r.id)).toEqual(WEATHER_DEFS.map(d => d.id));
    expect(CLAUSE_ROWS.map(r => r.id)).toEqual(CLAUSE_DEFS.map(d => d.id));
  });

  it('accounts for every GⅠ on the calendar exactly once', () => {
    const listed = MANDATE_ROWS.flatMap(r => r.races);
    expect(listed).toHaveLength(G1_THEMES.length);
    expect(new Set(MANDATE_ROWS.map(r => r.name)))
      .toEqual(new Set(G1_THEMES.map(t => g1Identity(t).nameKo)));
  });

  it('reports odds that sum to a whole axis', () => {
    for (const rows of [GOING_ROWS, PACE_ROWS, CLAUSE_ROWS]) {
      const total = rows.reduce((n, r) => n + (r.chance ?? 0), 0);
      expect(total).toBeGreaterThan(99.4);
      expect(total).toBeLessThan(100.6);
    }
  });

  it('gives weather the odds it actually has on each ground it can fall on', () => {
    // A flat share of the whole table would be a number that never occurs.
    const rain = WEATHER_ROWS.find(r => r.id === 'RAIN')!;
    expect(rain.chance).toBeNull();
    expect(rain.extra).toBeTruthy();
    expect(rain.extra).not.toContain('양호');
  });

  it('prints the curve the engine applies, not a copy of it', () => {
    for (const row of STYLE_CURVE_ROWS) {
      for (const [i, phase] of PHASE_ROWS.entries()) {
        const step = styleStepAt(row.style, phase.id);
        expect(row.phases[i].dealt).toBeCloseTo(step.damage * 100, 5);
        expect(row.phases[i].resist).toBeCloseTo(step.resist * 100, 5);
      }
    }
    expect(STYLE_CURVE_ROWS.map(r => r.style)).toEqual(RUN_STYLES);
  });

  it('describes every row, so nothing renders as an empty card', () => {
    for (const row of [...GOING_ROWS, ...PACE_ROWS, ...WEATHER_ROWS, ...CLAUSE_ROWS, ...MANDATE_ROWS]) {
      expect(row.name, row.id).toBeTruthy();
      expect(row.note, row.id).toBeTruthy();
    }
    // 특례 없음 is the one row that legitimately has no effects.
    for (const row of CLAUSE_ROWS.filter(r => r.id !== 'NONE')) {
      expect(row.lines.length, row.id).toBeGreaterThan(0);
    }
  });

  it('states how often any 특례 appears', () => {
    expect(CLAUSE_ANY_CHANCE).toBeGreaterThan(0);
    expect(CLAUSE_ANY_CHANCE).toBeLessThan(100);
  });
});
