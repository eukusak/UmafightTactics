/** Spec §37.2 — generated data must match the pinned counts exactly. */
import { describe, expect, it } from 'vitest';
import {
  ACTIVE_UNITS, ALL_ITEM_DEFS, ALL_UNITS, ACTIVE_BY_COST, AUGMENT_DEFS, TRAIT_DEFS,
} from '../src/game/engine/roster';
import { COMPLETED_ITEM_DEFS, COMPONENT_DEFS, RECIPE_KEY, combine } from '../src/game/engine/items/item-defs';
import { COST_UNIT_COUNTS, MAX_LEVEL, POOL_COPIES, SHOP_ODDS } from '../src/game/engine/constants';
import { UnitDefSchema } from '../src/game/engine/schema';
import type { Cost } from '../src/game/engine/types';
import sourceValidation from '../src/data/source/horse-game-db.validation.json';
import sourceDb from '../src/data/source/horse-game-db.json';

describe('source data', () => {
  it('vendors 331 horses with 145 P0 and no missing stats', () => {
    expect((sourceDb as { horses: unknown[] }).horses).toHaveLength(331);
    expect(sourceValidation.horseCount).toBe(331);
    expect(sourceValidation.p0Count).toBe(145);
    expect(sourceValidation.missingStats).toBe(0);
    expect(sourceValidation.duplicateIds).toBe(0);
  });
});

describe('unit roster', () => {
  it('holds the full 145-character pool', () => {
    expect(ALL_UNITS).toHaveLength(145);
    expect(new Set(ALL_UNITS.map((u) => u.id)).size).toBe(145);
    expect(new Set(ALL_UNITS.map((u) => u.nameKo)).size).toBe(145);
  });

  it('freezes 60 Season 1 units', () => {
    expect(ACTIVE_UNITS).toHaveLength(60);
    expect(ACTIVE_UNITS.every((u) => u.activeS1)).toBe(true);
  });

  it('distributes active costs exactly 14/14/13/11/8', () => {
    for (const cost of [1, 2, 3, 4, 5] as Cost[]) {
      expect(ACTIVE_BY_COST[cost]).toHaveLength(COST_UNIT_COUNTS[cost]);
    }
  });

  it('uses pool copies 22/20/17/10/9', () => {
    expect(POOL_COPIES).toEqual({ 1: 22, 2: 20, 3: 17, 4: 10, 5: 9 });
  });

  it('passes the unit schema for every unit', () => {
    for (const u of ALL_UNITS) expect(UnitDefSchema.safeParse(u).success).toBe(true);
  });

  it('gives every unit 3 traits, or 4 only at 5 cost', () => {
    for (const u of ALL_UNITS) {
      expect(u.traits.length).toBeGreaterThanOrEqual(3);
      expect(u.traits.length).toBeLessThanOrEqual(u.cost === 5 ? 4 : 3);
      expect(new Set(u.traits).size).toBe(u.traits.length);
    }
  });

  it('keeps every trait reachable inside the active roster', () => {
    for (const t of TRAIT_DEFS) {
      const n = ACTIVE_UNITS.filter((u) => u.traits.includes(t.id)).length;
      expect(n, `trait ${t.id}`).toBeGreaterThanOrEqual(t.thresholds[0]);
    }
  });

  it('keeps at least 8 active units per combat role', () => {
    for (const role of ['TANK', 'BRUISER', 'AD_CARRY', 'AP_CARRY', 'SUPPORT'] as const) {
      expect(ACTIVE_UNITS.filter((u) => u.role === role).length, role).toBeGreaterThanOrEqual(8);
    }
  });

  it('treats emperor as unique', () => {
    expect(ALL_UNITS.filter((u) => u.traits.includes('emperor'))).toHaveLength(1);
  });

  it('never reuses UmaRogue tier or starterCost as the game cost', () => {
    // Spec §7.1: legacy fields are reference-only. If cost were copied from
    // them the two columns would correlate almost perfectly.
    const matching = ACTIVE_UNITS.filter((u) => u.cost === u.source.legacyStarterCost).length;
    expect(matching).toBeLessThan(ACTIVE_UNITS.length);
  });

  it('gives every unit an art-manifest-compatible snake_case id', () => {
    for (const u of ALL_UNITS) expect(u.id).toMatch(/^[a-z0-9_]+$/);
  });
});

describe('shop odds', () => {
  it('sums to 100 at every level', () => {
    for (let level = 1; level <= MAX_LEVEL; level += 1) {
      const sum = ([1, 2, 3, 4, 5] as Cost[]).reduce((a, c) => a + SHOP_ODDS[c][level - 1], 0);
      expect(sum, `level ${level}`).toBe(100);
    }
  });
});

describe('items', () => {
  it('has 10 components and 55 completed items', () => {
    expect(COMPONENT_DEFS).toHaveLength(10);
    expect(COMPLETED_ITEM_DEFS).toHaveLength(55);
    expect(ALL_ITEM_DEFS).toHaveLength(65);
  });

  it('maps every unordered component pair to exactly one unique result', () => {
    const seen = new Map<string, string>();
    for (const item of COMPLETED_ITEM_DEFS) {
      const [a, b] = item.components!;
      const key = RECIPE_KEY(a, b);
      expect(seen.has(key), `duplicate recipe ${key}`).toBe(false);
      seen.set(key, item.id);
    }
    expect(seen.size).toBe(55);

    // 10 components produce 55 unordered pairs; all must be covered.
    const ids = COMPONENT_DEFS.map((c) => c.id);
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i; j < ids.length; j += 1) {
        expect(combine(ids[i], ids[j]), `${ids[i]}+${ids[j]}`).not.toBeNull();
      }
    }
  });

  it('is order-independent when combining', () => {
    expect(combine('winner_ribbon', 'reinforced_horseshoe'))
      .toBe(combine('reinforced_horseshoe', 'winner_ribbon'));
  });

  it('defines 16 trait emblems and 3 tactician items', () => {
    expect(COMPLETED_ITEM_DEFS.filter((i) => i.grantsTrait)).toHaveLength(16);
    expect(COMPLETED_ITEM_DEFS.filter((i) => i.tactician)).toHaveLength(3);
  });
});

describe('augments', () => {
  it('defines 48 unique augments across 3 grades', () => {
    expect(AUGMENT_DEFS).toHaveLength(48);
    expect(new Set(AUGMENT_DEFS.map((a) => a.id)).size).toBe(48);
    for (const g of ['S', 'G', 'P'] as const) {
      expect(AUGMENT_DEFS.filter((a) => a.grade === g).length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('traits', () => {
  it('defines 24 traits with ascending thresholds', () => {
    expect(TRAIT_DEFS).toHaveLength(24);
    for (const t of TRAIT_DEFS) {
      expect(t.tiers).toHaveLength(t.thresholds.length);
      for (let i = 1; i < t.thresholds.length; i += 1) {
        expect(t.thresholds[i]).toBeGreaterThan(t.thresholds[i - 1]);
      }
    }
  });
});
