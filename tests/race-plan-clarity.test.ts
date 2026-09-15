import { describe, expect, it } from 'vitest';
import { RACE_PLAN_DEFS } from '../src/game/engine/race-plan/plan-defs';
import { planSummary } from '../src/game/engine/race-plan/presentation';
import { findRacePlanNode } from '../src/game/engine/race-plan/defs';
import { bannerOpacity, bannerWindow } from '../src/game/ui/battle-playback';
import { RACE_PHASE_LABEL } from '../src/game/engine/race-plan/types';

describe('plan summaries say what a card does', () => {
  it('gives every plan a summary that names the phases its power lands in', () => {
    for (const node of RACE_PLAN_DEFS) {
      const summary = planSummary(node);
      expect(summary, node.id).not.toBe('');
      // The phase clause leads, because that is the axis a player matches
      // against their own board.
      for (const phase of node.fit.phases) {
        expect(summary, node.id).toContain(RACE_PHASE_LABEL[phase]);
      }
      expect(summary.startsWith(RACE_PHASE_LABEL[node.fit.phases[0]]), node.id).toBe(true);
    }
  });

  it('carries the evolution into the summary rather than describing the plan alone', () => {
    const plan = RACE_PLAN_DEFS.find((n) => n.fit.phases.includes('START'))!;
    const late = RACE_PLAN_DEFS.find((n) => n.fit.phases.includes('LAST_3F') && !n.fit.phases.includes('START'))!;
    const merged = planSummary(plan, late);
    expect(merged).toContain(RACE_PHASE_LABEL.START);
    expect(merged).toContain(RACE_PHASE_LABEL.LAST_3F);
  });

  it('never returns the raw effect list dressed up as prose', () => {
    // A summary is a fit line, not a numbers line — a stat value duplicated
    // here drifts the moment the card is tuned. 4코너 is a phase name, not a
    // number, so the check targets values and units rather than any digit.
    for (const node of RACE_PLAN_DEFS) {
      const summary = planSummary(node);
      expect(summary, node.id).not.toMatch(/%|[+\u2212-]\s?\d|\d\s?초|\d\s?회/);
    }
  });

  it('resolves the ids the panel and the top strip look plans up by', () => {
    for (const node of RACE_PLAN_DEFS.slice(0, 5)) {
      expect(findRacePlanNode(node.id)?.nameKo).toBe(node.nameKo);
    }
  });
});

describe('the phase call-out stays readable at every playback speed', () => {
  it('holds the call-out for the same real time whatever the speed multiplier', () => {
    // Battle time runs at the multiplier, so a constant battle-time window is a
    // shrinking real-time one. 1x and 2x both come back to 1.5 real seconds.
    for (const speed of [1, 2] as const) {
      expect(bannerWindow(speed) / speed).toBeCloseTo(1.5, 5);
    }
  });

  it('caps the window so a fast run does not leave 발주 up at 4코너', () => {
    expect(bannerWindow(10)).toBeLessThanOrEqual(4);
    expect(bannerWindow(10)).toBeGreaterThan(bannerWindow(1));
  });

  it('is strictly longer than the 0.6s it replaced, at every speed', () => {
    for (const speed of [1, 2, 4, 10] as const) expect(bannerWindow(speed)).toBeGreaterThan(0.6);
  });

  it('fades out over the tail instead of vanishing', () => {
    const w = bannerWindow(1);
    expect(bannerOpacity(0, w)).toBe(1);
    expect(bannerOpacity(w * 0.5, w)).toBe(1);
    const late = bannerOpacity(w * 0.9, w);
    expect(late).toBeGreaterThan(0);
    expect(late).toBeLessThan(1);
    expect(bannerOpacity(w, w)).toBe(0);
    expect(bannerOpacity(-0.1, w)).toBe(0);
  });

  it('decreases monotonically across the fade', () => {
    const w = bannerWindow(4);
    let previous = 1;
    for (let t = w * 0.7; t <= w; t += w * 0.02) {
      const v = bannerOpacity(t, w);
      expect(v).toBeLessThanOrEqual(previous + 1e-9);
      previous = v;
    }
  });
});
