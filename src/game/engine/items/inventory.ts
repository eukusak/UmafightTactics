/** Equipping, combining and removing items (spec §23.1, §24). */
import { MAX_ITEMS_PER_UNIT } from '../constants';
import { getUnitDef } from '../roster';
import { combine, getItem, TACTICIAN_ITEM_IDS } from './item-defs';
import { itemStorageCapacity } from '../shop';
import type { MatchState, PlayerState, UnitInstance } from '../state';

export type EquipResult = { ok: true; resultItemId: string } | { ok: false; reason: string };

function findUnit(player: PlayerState, instanceId: string): UnitInstance | null {
  return [...player.board, ...player.bench].find((u) => u.instanceId === instanceId) ?? null;
}

/** Item slots a unit currently uses; 변칙 작전 글러브 takes all three. */
export function usedSlots(unit: UnitInstance): number {
  return unit.items.reduce((acc, id) => acc + getItem(id).slotCost, 0);
}

export function canEquip(unit: UnitInstance, itemId: string): { ok: boolean; reason?: string } {
  const item = getItem(itemId);
  if (item.tactician) return { ok: false, reason: 'TACTICIAN_ITEM' };

  // An emblem is refused when the unit already has that trait natively.
  if (item.grantsTrait) {
    const def = getUnitDef(unit.unitDefId);
    if (def.traits.includes(item.grantsTrait)) return { ok: false, reason: 'ALREADY_HAS_TRAIT' };
    if (unit.items.some((id) => getItem(id).grantsTrait === item.grantsTrait)) {
      return { ok: false, reason: 'ALREADY_HAS_TRAIT' };
    }
  }
  if (item.unique && unit.items.includes(itemId)) return { ok: false, reason: 'UNIQUE' };

  const used = usedSlots(unit);
  // A component that will immediately combine occupies no extra slot.
  if (item.isComponent) {
    const partner = unit.items.find((id) => getItem(id).isComponent && combine(id, itemId));
    if (partner) return { ok: true };
  }
  if (used + item.slotCost > MAX_ITEMS_PER_UNIT) return { ok: false, reason: 'NO_SLOT' };
  return { ok: true };
}

/**
 * Equips an item from storage. Two components on the same unit combine at once
 * (spec §23.1); completed items never decompose.
 */
export function equipItem(
  player: PlayerState, unitInstanceId: string, itemInstanceId: string, inBattle = false,
): EquipResult {
  if (inBattle) return { ok: false, reason: 'IN_BATTLE' };

  const unit = findUnit(player, unitInstanceId);
  if (!unit) return { ok: false, reason: 'NO_UNIT' };
  const stored = player.items.find((i) => i.instanceId === itemInstanceId);
  if (!stored) return { ok: false, reason: 'NO_ITEM' };

  const check = canEquip(unit, stored.itemId);
  if (!check.ok) return { ok: false, reason: check.reason ?? 'CANNOT_EQUIP' };

  const item = getItem(stored.itemId);
  player.items = player.items.filter((i) => i.instanceId !== itemInstanceId);

  if (item.isComponent) {
    const partnerIdx = unit.items.findIndex(
      (id) => getItem(id).isComponent && combine(id, stored.itemId),
    );
    if (partnerIdx >= 0) {
      const partner = unit.items[partnerIdx];
      const resultId = combine(partner, stored.itemId)!;
      unit.items.splice(partnerIdx, 1, resultId);
      return { ok: true, resultItemId: resultId };
    }
  }

  unit.items.push(stored.itemId);
  return { ok: true, resultItemId: stored.itemId };
}

/** Moves a tactician item straight into the player's tactician slots. */
export function equipTactician(player: PlayerState, itemInstanceId: string): EquipResult {
  const stored = player.items.find((i) => i.instanceId === itemInstanceId);
  if (!stored) return { ok: false, reason: 'NO_ITEM' };
  if (!TACTICIAN_ITEM_IDS.includes(stored.itemId)) return { ok: false, reason: 'NOT_TACTICIAN' };
  player.items = player.items.filter((i) => i.instanceId !== itemInstanceId);
  player.tacticianItems.push(stored.itemId);
  return { ok: true, resultItemId: stored.itemId };
}

/** Item remover: strips a unit and returns everything it can to storage. */
export function removeItems(state: MatchState, player: PlayerState, unitInstanceId: string): boolean {
  const unit = findUnit(player, unitInstanceId);
  if (!unit) return false;
  const capacity = itemStorageCapacity(player);
  const returning = unit.items.slice();
  if (player.items.length + returning.length > capacity) return false;
  for (const id of returning) {
    state.instanceCounter += 1;
    player.items.push({ instanceId: `i${state.instanceCounter}`, itemId: id });
  }
  unit.items = [];
  return true;
}

export function addItemToStorage(state: MatchState, player: PlayerState, itemId: string): boolean {
  if (player.items.length >= itemStorageCapacity(player)) return false;
  state.instanceCounter += 1;
  player.items.push({ instanceId: `i${state.instanceCounter}`, itemId });
  return true;
}

/**
 * Resolves 변칙 작전 글러브 at the end of prep: it grants two random completed
 * items for the coming battle, never repeating one the unit already holds.
 */
export function resolveTrickGloves(
  player: PlayerState, rng: { pick: <T>(a: readonly T[]) => T; shuffle: <T>(a: readonly T[]) => T[] },
): void {
  const pool = ['champion_trophy', 'long_distance_training_coat', 'genius_trainer_hat',
    'red_turf_booster', 'blue_focus', 'stormproof_racing_cloak', 'iron_stable',
    'trainer_lifeblade', 'last_overtake', 'endless_spurt', 'steadfast_heart', 'recovery_saddle'];
  for (const unit of player.board) {
    const idx = unit.items.indexOf('trick_strategy_gloves');
    if (idx < 0) continue;
    // Keep the gloves in slot 0 and rebuild the two granted items each round.
    unit.items = ['trick_strategy_gloves', ...rng.shuffle(pool).slice(0, 2)];
  }
}

/** Total item slots a unit still has free. */
export function freeSlots(unit: UnitInstance): number {
  return Math.max(0, MAX_ITEMS_PER_UNIT - usedSlots(unit));
}
