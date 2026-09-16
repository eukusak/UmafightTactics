import { describe, expect, it } from 'vitest';
import { battleArtPlan } from '../src/game/ui/battle-art-plan';
import { ALL_UNITS, getUnitDef } from '../src/game/engine/roster';
import type { PlayerState, UnitInstance } from '../src/game/engine/state';

const unit = (defId: string, i: number): UnitInstance =>
  ({ instanceId: `u${i}`, unitDefId: defId, star: 1, sourceCopies: 1, items: [], position: { q: i, r: 0 } });
const legendary = ALL_UNITS.find(u => u.cost === 5)!;
const cheap = ALL_UNITS.filter(u => u.cost === 1).slice(0, 3);

const player = (over: Partial<PlayerState> = {}): PlayerState => ({
  board: [], bench: [], shop: [], ...over,
} as unknown as PlayerState);

describe('battleArtPlan', () => {
  it('leads with the fielded board, because those units are certain to fight', () => {
    const plan = battleArtPlan(player({
      board: [unit(cheap[0].id, 0)],
      bench: [unit(cheap[1].id, 1)],
    }));
    const board = plan.findIndex(u => u.includes(cheap[0].id));
    const bench = plan.findIndex(u => u.includes(cheap[1].id));
    expect(board).toBeGreaterThanOrEqual(0);
    expect(board).toBeLessThan(bench);
  });

  it('puts speculative shop art last, after everything already owned', () => {
    const plan = battleArtPlan(player({
      board: [unit(cheap[0].id, 0)],
      shop: [{ unitDefId: cheap[2].id, sold: false }],
    }));
    expect(plan.findIndex(u => u.includes(cheap[2].id))).toBe(plan.length - 1);
  });

  it('asks for a cut-in only where one exists', () => {
    const withLegendary = battleArtPlan(player({ board: [unit(legendary.id, 0)] }));
    const withoutLegendary = battleArtPlan(player({ board: [unit(cheap[0].id, 0)] }));
    expect(getUnitDef(legendary.id).cost).toBe(5);
    expect(withLegendary.some(u => u.includes('cutin'))).toBe(true);
    expect(withoutLegendary.some(u => u.includes('cutin'))).toBe(false);
  });

  it('never repeats a URL, so a duplicated unit costs one download', () => {
    const plan = battleArtPlan(player({
      board: [unit(cheap[0].id, 0), unit(cheap[0].id, 1), unit(cheap[0].id, 2)],
    }));
    expect(plan.length).toBe(new Set(plan).size);
  });

  it('includes the race furniture every battle draws whatever the board holds', () => {
    const plan = battleArtPlan(player());
    expect(plan.some(u => u.includes('hud_track_bar'))).toBe(true);
    expect(plan.some(u => u.includes('phase_banner_start'))).toBe(true);
  });

  /**
   * BattleScene defers the style/dive sheets a recording does not reference —
   * 8.6MB of the old critical path. Warming them here would put that straight
   * back, just earlier.
   */
  it('leaves the deferred style and dive sheets alone', () => {
    const plan = battleArtPlan(player({ board: [unit(cheap[0].id, 0)] }));
    expect(plan.some(u => u.includes('style_signature'))).toBe(false);
    expect(plan.some(u => u.includes('dive_'))).toBe(false);
  });
});
