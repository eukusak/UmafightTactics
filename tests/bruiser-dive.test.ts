import { describe, expect, it } from 'vitest';
import { BattleEngine, type BattleSideInput } from '../src/game/engine/battle/engine';
import { Rng } from '../src/game/engine/rng';
import { getSeasonUnits, getUnitDef } from '../src/game/engine/roster';
import { DEFAULT_CONDITIONS } from '../src/game/engine/race-plan/conditions';
import type { Role } from '../src/game/engine/types';

const s1 = getSeasonUnits('s1');
const byRole = (role: Role, n: number, skip = 0) => s1.filter((u) => u.role === role).slice(skip, skip + n);
type Placed = { id: string; q: number; r: number };
const side = (tag: string, us: Placed[]): BattleSideInput => ({
  playerId: tag, augments: [], tacticianItems: [],
  units: us.map((u, i) => ({
    instanceId: `${tag}${i}`, unitDefId: u.id, star: 2 as const, items: [],
    position: { q: u.q, r: u.r },
  })),
});

const [tank, tank2] = byRole('TANK', 2).map((u) => u.id);
const [bruiser, bruiser2] = byRole('BRUISER', 2).map((u) => u.id);
const adc = byRole('AD_CARRY', 1)[0].id;
const apc = byRole('AP_CARRY', 1)[0].id;
const attackers: Placed[] = [{ id: bruiser, q: 2, r: 0 }, { id: bruiser2, q: 4, r: 0 }];

/** Share of a side's bruiser damage that landed on enemy carries. */
function carryShare(defender: Placed[], seeds = 24): number {
  let carry = 0, total = 0;
  for (let i = 0; i < seeds; i += 1) {
    const engine = new BattleEngine(side('a', attackers), side('d', defender), Rng.forStream(i, 'dive'),
      { conditions: DEFAULT_CONDITIONS });
    const result = engine.run();
    const units = new Map(engine.units.map((u) => [u.id, u]));
    for (const event of result.events) {
      if (event.type !== 'DAMAGE') continue;
      const source = units.get(event.source);
      const target = units.get(event.target);
      if (!source || !target || getUnitDef(source.unitDefId).role !== 'BRUISER') continue;
      total += event.damage;
      const role = getUnitDef(target.unitDefId).role;
      if (role === 'AD_CARRY' || role === 'AP_CARRY') carry += event.damage;
    }
  }
  return total > 0 ? carry / total : 0;
}

/**
 * Bruisers dive the carries their opponent left unscreened.
 *
 * Targeting is nearest-first for every other role, which meant a melee fighter
 * walked into the enemy front line and stayed there — and since every bruiser's
 * skill carries a DASH aimed at its current target, the dive landed on the tank
 * it was already next to. The role had the animation and none of the job.
 */
describe('bruiser dive', () => {
  const screened: Placed[] = [
    { id: tank, q: 2, r: 2 }, { id: tank2, q: 4, r: 2 },
    { id: adc, q: 2, r: 3 }, { id: apc, q: 4, r: 3 },
  ];
  const exposed: Placed[] = [
    { id: tank, q: 2, r: 0 }, { id: tank2, q: 4, r: 0 },
    { id: adc, q: 0, r: 3 }, { id: apc, q: 6, r: 3 },
  ];

  it('goes past the front line for a carry left on its own', () => {
    expect(carryShare(exposed)).toBeGreaterThan(0.55);
  });

  it('leaves a carry alone when a body is placed beside it', () => {
    // The counterplay has to be real, or this is a flat buff rather than a
    // positional mechanic: screening must measurably pull the dive off.
    expect(carryShare(screened)).toBeLessThan(0.45);
  });

  it('separates the two placements by a wide margin', () => {
    expect(carryShare(exposed) - carryShare(screened)).toBeGreaterThan(0.2);
  });

  it('judges placement on the starting board, not on live positions', () => {
    // Front lines advance on contact, so a screen evaluated per-tick dissolves a
    // second or two in and every carry ends up exposed however it was placed.
    // Holding the reading from the start is what makes placement the decision.
    const engine = new BattleEngine(side('a', attackers), side('d', screened), Rng.forStream(1, 'dive'),
      { conditions: DEFAULT_CONDITIONS });
    engine.run();
    const moved = engine.units.filter((u) => u.team === 'B'
      && ['TANK', 'BRUISER'].includes(getUnitDef(u.unitDefId).role));
    // The screen really does leave its post during the fight — that is the whole
    // reason the reading cannot be live.
    expect(moved.length).toBeGreaterThan(0);
    expect(carryShare(screened)).toBeLessThan(0.45);
  });
});
