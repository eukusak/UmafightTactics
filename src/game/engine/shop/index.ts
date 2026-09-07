/** Shop rolls, purchases, sales and star combination (spec §17, §10, §18). */
import { MAX_ITEMS_PER_UNIT, SHOP_ODDS, SHOP_SLOTS } from '../constants';
import { ACTIVE_BY_COST, getUnitDef } from '../roster';
import type { Rng } from '../rng';
import type { Cost, Star } from '../types';
import type { MatchState, PlayerState, PoolState, ShopSlot, UnitInstance } from '../state';
import { copiesForStar, give, remainingOf, returnInstance, take } from '../pool';
import { getAugment } from '../augments/augment-defs';

export function emptyShop(slots = SHOP_SLOTS): ShopSlot[] {
  return Array.from({ length: slots }, () => ({ unitDefId: null, sold: false }));
}

/** Per-augment adjustments to the level odds row, renormalised to 100. */
export function shopOddsFor(player: PlayerState): Record<Cost, number> {
  const level = Math.min(10, Math.max(1, player.level));
  const row: Record<Cost, number> = {
    1: SHOP_ODDS[1][level - 1], 2: SHOP_ODDS[2][level - 1], 3: SHOP_ODDS[3][level - 1],
    4: SHOP_ODDS[4][level - 1], 5: SHOP_ODDS[5][level - 1],
  };

  let highCostShift = 0;
  let level10FiveCost = 0;
  for (const id of player.augments) {
    const eco = getAugment(id).economy;
    if (!eco) continue;
    highCostShift += eco.shopOddsShiftHighCost ?? 0;
    level10FiveCost += eco.shopOddsLevel10FiveCost ?? 0;
  }

  if (highCostShift > 0) {
    // Move probability mass into 4/5 cost, taking it proportionally from 1..3.
    const lowTotal = row[1] + row[2] + row[3];
    const actual = Math.min(highCostShift, lowTotal);
    if (actual > 0) {
      for (const c of [1, 2, 3] as Cost[]) row[c] -= (row[c] / lowTotal) * actual;
      row[4] += actual * 0.6;
      row[5] += actual * 0.4;
    }
  }
  if (level10FiveCost > 0 && level === 10) {
    const take5 = Math.min(level10FiveCost, row[1] + row[2] + row[3]);
    const lowTotal = row[1] + row[2] + row[3];
    if (lowTotal > 0) for (const c of [1, 2, 3] as Cost[]) row[c] -= (row[c] / lowTotal) * take5;
    row[5] += take5;
  }

  const sum = ([1, 2, 3, 4, 5] as Cost[]).reduce((a, c) => a + Math.max(0, row[c]), 0);
  if (sum <= 0) return { 1: 100, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const c of [1, 2, 3, 4, 5] as Cost[]) row[c] = (Math.max(0, row[c]) / sum) * 100;
  return row;
}

export function shopSlotCount(player: PlayerState): number {
  let slots = SHOP_SLOTS;
  for (const id of player.augments) slots += getAugment(id).economy?.shopSlots ?? 0;
  return slots;
}

/** Unit ids the player already owns, used by duplicate-weighting augments. */
function ownedDefIds(player: PlayerState): Set<string> {
  const s = new Set<string>();
  for (const u of [...player.board, ...player.bench]) s.add(u.unitDefId);
  return s;
}

/**
 * Rolls one shop. Copies are NOT removed from the pool here (spec §17.3): a
 * provisional reservation only stops one roll from showing more copies of a
 * unit than actually remain.
 */
export function rollShop(player: PlayerState, pool: PoolState, rng: Rng): ShopSlot[] {
  const slots = shopSlotCount(player);
  const odds = shopOddsFor(player);
  const owned = ownedDefIds(player);

  let dupWeight = 0;
  let pairWeight = 0;
  for (const id of player.augments) {
    const eco = getAugment(id).economy;
    if (!eco) continue;
    dupWeight += eco.duplicateWeightLowCost ?? 0;
    pairWeight += eco.pairHunterWeight ?? 0;
  }

  const reserved: Record<string, number> = {};
  const out: ShopSlot[] = [];

  for (let i = 0; i < slots; i += 1) {
    const costs: Cost[] = [1, 2, 3, 4, 5];
    // Only offer costs that still have at least one purchasable copy.
    const costWeights = costs.map((c) => {
      const available = ACTIVE_BY_COST[c].some(
        (u) => remainingOf(pool, u.id) - (reserved[u.id] ?? 0) > 0,
      );
      return available ? odds[c] : 0;
    });

    const costIdx = rng.weightedIndex(costWeights);
    if (costIdx < 0) { out.push({ unitDefId: null, sold: false }); continue; }
    const cost = costs[costIdx];

    const candidates = ACTIVE_BY_COST[cost];
    const weights = candidates.map((u) => {
      const avail = remainingOf(pool, u.id) - (reserved[u.id] ?? 0);
      if (avail <= 0) return 0;
      let w = avail;
      if (owned.has(u.id)) w *= 1 + pairWeight;
      if (dupWeight > 0 && (cost === 1 || cost === 2) && owned.has(u.id)) w *= 1 + dupWeight;
      return w;
    });

    const pickIdx = rng.weightedIndex(weights);
    if (pickIdx < 0) { out.push({ unitDefId: null, sold: false }); continue; }
    const unit = candidates[pickIdx];
    reserved[unit.id] = (reserved[unit.id] ?? 0) + 1;
    out.push({ unitDefId: unit.id, sold: false });
  }

  return out;
}

export function benchCapacity(player: PlayerState): number {
  let cap = 9;
  for (const id of player.augments) cap += getAugment(id).economy?.benchSlots ?? 0;
  return cap;
}

export function itemStorageCapacity(player: PlayerState): number {
  let cap = 10;
  for (const id of player.augments) cap += getAugment(id).economy?.itemSlots ?? 0;
  return cap;
}

/** Board size equals level, plus tactician items and the 특별 출전권 augment. */
export function teamSizeLimit(player: PlayerState): number {
  let size = player.level;
  for (const id of player.augments) size += getAugment(id).economy?.teamSizeBonus ?? 0;
  size += player.tacticianItems.length;
  return size;
}

export function newInstance(state: MatchState, unitDefId: string, star: Star = 1): UnitInstance {
  state.instanceCounter += 1;
  return {
    instanceId: `u${state.instanceCounter}`,
    unitDefId,
    star,
    sourceCopies: copiesForStar(star),
    items: [],
    position: null,
  };
}

export type BuyResult = { ok: true; instance: UnitInstance } | { ok: false; reason: string };

export function buyUnit(state: MatchState, player: PlayerState, slotIndex: number): BuyResult {
  const slot = player.shop[slotIndex];
  if (!slot || !slot.unitDefId || slot.sold) return { ok: false, reason: 'EMPTY_SLOT' };
  const def = getUnitDef(slot.unitDefId);
  if (player.gold < def.cost) return { ok: false, reason: 'NOT_ENOUGH_GOLD' };

  // A purchase that immediately completes a combine may bypass a full bench.
  const wouldCombine = countCopies(player, def.id, 1) + 1 >= 3;
  if (player.bench.length >= benchCapacity(player) && !wouldCombine) {
    return { ok: false, reason: 'BENCH_FULL' };
  }
  if (!take(state.pool, def.id, 1)) return { ok: false, reason: 'POOL_EMPTY' };

  player.gold -= def.cost;
  slot.sold = true;
  slot.unitDefId = null;

  const instance = newInstance(state, def.id, 1);
  player.bench.push(instance);
  applyCombines(state, player);
  return { ok: true, instance };
}

function countCopies(player: PlayerState, unitDefId: string, star: Star): number {
  return [...player.board, ...player.bench].filter(
    (u) => u.unitDefId === unitDefId && u.star === star,
  ).length;
}

/**
 * Star combination (spec §10). `inBattle` holds back combines that would need a
 * unit currently fighting on the board.
 */
export function applyCombines(state: MatchState, player: PlayerState, inBattle = false): number {
  let combines = 0;
  for (let guard = 0; guard < 32; guard += 1) {
    const upgraded = tryOneCombine(state, player, inBattle);
    if (!upgraded) break;
    combines += 1;
  }
  return combines;
}

function tryOneCombine(state: MatchState, player: PlayerState, inBattle: boolean): boolean {
  for (const star of [1, 2] as Star[]) {
    const groups = new Map<string, UnitInstance[]>();
    const pool = inBattle ? player.bench : [...player.board, ...player.bench];
    for (const u of pool) {
      if (u.star !== star) continue;
      const list = groups.get(u.unitDefId) ?? [];
      list.push(u);
      groups.set(u.unitDefId, list);
    }
    for (const list of groups.values()) {
      if (list.length < 3) continue;
      // Keep the copy carrying the most items so the upgrade inherits the best loadout.
      const sorted = list.slice().sort((a, b) => b.items.length - a.items.length || a.instanceId.localeCompare(b.instanceId));
      const [keep, ...consumed] = sorted.slice(0, 3);
      const carriedItems = [keep, ...consumed].flatMap((u) => u.items);

      for (const c of consumed) removeInstance(player, c.instanceId);

      keep.star = (star + 1) as Star;
      keep.sourceCopies = copiesForStar(keep.star);
      keep.items = carriedItems.slice(0, MAX_ITEMS_PER_UNIT);
      // Items beyond three slots fall back into storage.
      for (const extra of carriedItems.slice(MAX_ITEMS_PER_UNIT)) {
        state.instanceCounter += 1;
        player.items.push({ instanceId: `i${state.instanceCounter}`, itemId: extra });
      }
      return true;
    }
  }
  return false;
}

function removeInstance(player: PlayerState, instanceId: string): void {
  player.board = player.board.filter((u) => u.instanceId !== instanceId);
  player.bench = player.bench.filter((u) => u.instanceId !== instanceId);
}

/** Spec §18 — sell price. */
export function sellPrice(player: PlayerState, unit: UnitInstance): number {
  const def = getUnitDef(unit.unitDefId);
  if (def.cost === 1) return def.cost * unit.sourceCopies;
  let loss = 1;
  for (const id of player.augments) loss -= getAugment(id).economy?.sellLossReduction ?? 0;
  loss = Math.max(0, loss);
  if (unit.star === 1) return def.cost;
  if (unit.star === 2) return Math.max(1, def.cost * 3 - loss);
  return Math.max(1, def.cost * 9 - loss);
}

export type SellResult = { ok: true; gold: number } | { ok: false; reason: string };

export function sellUnit(state: MatchState, player: PlayerState, instanceId: string): SellResult {
  const unit = [...player.board, ...player.bench].find((u) => u.instanceId === instanceId);
  if (!unit) return { ok: false, reason: 'NOT_FOUND' };
  // Spec §18: items go back to storage, and a full storage blocks the sale.
  if (player.items.length + unit.items.length > itemStorageCapacity(player)) {
    return { ok: false, reason: 'ITEM_STORAGE_FULL' };
  }
  const gold = sellPrice(player, unit);
  for (const itemId of unit.items) {
    state.instanceCounter += 1;
    player.items.push({ instanceId: `i${state.instanceCounter}`, itemId });
  }
  removeInstance(player, instanceId);
  returnInstance(state.pool, unit);
  player.gold += gold;
  return { ok: true, gold };
}

/** Every copy a player holds goes back when they are eliminated (spec §17.3). */
export function returnAllUnits(pool: PoolState, player: PlayerState): void {
  for (const u of [...player.board, ...player.bench]) give(pool, u.unitDefId, u.sourceCopies);
  player.board = [];
  player.bench = [];
}
