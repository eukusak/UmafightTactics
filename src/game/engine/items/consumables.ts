import type { MatchState, PlayerState } from '../state';
import type { Rng } from '../rng';
import { itemStorageCapacity } from '../shop';
import { ALL_ITEM_DEFS, getItem } from './item-defs';
import { addItemToStorage } from './inventory';

export type ItemTool = 'REMOVER' | 'REFORGER';
export type ItemToolTarget = { unit: string } | { item: string };

/** Temporary gloves equipment must never become permanent inventory. */
export function permanentItems(items: string[]): string[] {
  return items.includes('trick_strategy_gloves') ? ['trick_strategy_gloves'] : [...items];
}

export function reforgeOptions(id: string): string[] {
  const original = getItem(id);
  return ALL_ITEM_DEFS.filter(item => item.id !== id && !item.tactician
    && item.isComponent === original.isComponent && item.tier === original.tier
    && !!item.grantsTrait === !!original.grantsTrait).map(item => item.id);
}

/** Validate the entire operation before consuming a charge or advancing RNG. */
export function applyItemTool(state: MatchState, player: PlayerState, kind: ItemTool, target: ItemToolTarget, rng: Rng): boolean {
  if (state.phase !== 'ROUND_PREP' || player.hp <= 0) return false;
  const charge = player.pendingGrants.find(g => g.kind === kind && g.count > 0);
  if (!charge) return false;
  const unit = 'unit' in target ? [...player.board, ...player.bench].find(u => u.instanceId === target.unit) : undefined;
  const stored = 'item' in target ? player.items.find(i => i.instanceId === target.item) : undefined;
  if ((!unit && !stored) || (kind === 'REMOVER' && !unit)) return false;
  const originals = unit ? permanentItems(unit.items) : [stored!.itemId];
  if (!originals.length || (unit && player.items.length + originals.length > itemStorageCapacity(player))) return false;
  const pools = originals.map(reforgeOptions);
  if (kind === 'REFORGER' && pools.some(pool => !pool.length)) return false;
  const result = kind === 'REMOVER' ? originals : pools.map(pool => rng.pick(pool));
  if (unit) {
    unit.items = [];
    for (const id of result) addItemToStorage(state, player, id);
  } else stored!.itemId = result[0];
  charge.count--;
  if (!charge.count) player.pendingGrants.splice(player.pendingGrants.indexOf(charge), 1);
  return true;
}
