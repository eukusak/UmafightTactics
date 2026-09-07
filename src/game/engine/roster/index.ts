/** Loads the generated static data once and exposes typed lookups. */
import allUnitsRaw from '../../../data/generated/all-units.json';
import activeSetRaw from '../../../data/generated/active-set-s1.json';
import type { Cost, TraitDef, UnitDef, ItemDef, AugmentDef, TraitId } from '../types';
import { TRAIT_DEFS, TRAIT_BY_ID } from '../traits/trait-defs';
import { ALL_ITEM_DEFS, ITEM_BY_ID } from '../items/item-defs';
import { AUGMENT_DEFS, AUGMENT_BY_ID } from '../augments/augment-defs';

const allUnits = allUnitsRaw as unknown as { rosterHash: string; units: UnitDef[] };
const activeSet = activeSetRaw as unknown as {
  rosterHash: string;
  unitIds: string[];
  byCost: Record<string, string[]>;
};

export const ROSTER_HASH: string = allUnits.rosterHash;
export const ALL_UNITS: UnitDef[] = allUnits.units;
export const UNIT_BY_ID = new Map<string, UnitDef>(ALL_UNITS.map((u) => [u.id, u]));
export const ACTIVE_UNITS: UnitDef[] = activeSet.unitIds.map((id) => {
  const u = UNIT_BY_ID.get(id);
  if (!u) throw new Error(`active-set references unknown unit ${id}`);
  return u;
});
export const ACTIVE_UNIT_IDS: string[] = activeSet.unitIds;
export const ACTIVE_BY_COST: Record<Cost, UnitDef[]> = {
  1: (activeSet.byCost['1'] ?? []).map((id) => UNIT_BY_ID.get(id)!),
  2: (activeSet.byCost['2'] ?? []).map((id) => UNIT_BY_ID.get(id)!),
  3: (activeSet.byCost['3'] ?? []).map((id) => UNIT_BY_ID.get(id)!),
  4: (activeSet.byCost['4'] ?? []).map((id) => UNIT_BY_ID.get(id)!),
  5: (activeSet.byCost['5'] ?? []).map((id) => UNIT_BY_ID.get(id)!),
};

/**
 * Registers a unit definition that exists only for combat (PvE enemies).
 * Synthetic units are resolvable by id but never appear in ALL_UNITS,
 * ACTIVE_UNITS or ACTIVE_BY_COST, so they cannot enter the pool or the shop.
 */
export function registerSyntheticUnit(def: UnitDef): void {
  if (UNIT_BY_ID.has(def.id)) throw new Error(`Unit id already registered: ${def.id}`);
  UNIT_BY_ID.set(def.id, def);
}

export function getUnitDef(id: string): UnitDef {
  const u = UNIT_BY_ID.get(id);
  if (!u) throw new Error(`Unknown unit def: ${id}`);
  return u;
}

export function getTraitDef(id: TraitId): TraitDef {
  const t = TRAIT_BY_ID.get(id);
  if (!t) throw new Error(`Unknown trait: ${id}`);
  return t;
}

export { TRAIT_DEFS, ALL_ITEM_DEFS, AUGMENT_DEFS, ITEM_BY_ID, AUGMENT_BY_ID };
export type { ItemDef, AugmentDef, TraitDef, UnitDef };
