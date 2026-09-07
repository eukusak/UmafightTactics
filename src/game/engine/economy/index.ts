/** Gold, interest, streaks, XP and levelling (spec §16). */
import {
  GOLD_PER_INTEREST, MAX_INTEREST, MAX_LEVEL, REROLL_COST, XP_PER_ROUND,
  XP_PURCHASE_AMOUNT, XP_PURCHASE_COST, XP_TO_LEVEL, streakGold,
} from '../constants';
import { getAugment } from '../augments/augment-defs';
import type { PlayerState } from '../state';

export function maxInterest(player: PlayerState): number {
  let max = MAX_INTEREST;
  for (const id of player.augments) max += getAugment(id).economy?.maxInterestDelta ?? 0;
  return Math.max(0, max);
}

export function interestGold(player: PlayerState): number {
  return Math.min(maxInterest(player), Math.floor(player.gold / GOLD_PER_INTEREST));
}

export function streakBonus(player: PlayerState): number {
  let shift = 0;
  for (const id of player.augments) shift += getAugment(id).economy?.streakShift ?? 0;
  const abs = Math.abs(player.streak) + shift;
  return streakGold(abs);
}

/** Spec §16.2 — base income for the round that just finished. */
export function baseIncome(stage: number, round: number): number {
  if (stage === 1) return round >= 3 ? 4 : 2;
  return 5;
}

export function roundIncome(player: PlayerState, stage: number, round: number, wonPvp: boolean): number {
  let base = baseIncome(stage, round);
  for (const id of player.augments) base += getAugment(id).economy?.baseIncomeDelta ?? 0;
  base = Math.max(0, base);
  const win = wonPvp ? 1 : 0;
  return base + win + interestGold(player) + streakBonus(player);
}

export function xpToNextLevel(player: PlayerState): number {
  if (player.level >= MAX_LEVEL) return 0;
  const needed = XP_TO_LEVEL[player.level + 1] ?? 0;
  let discount = 0;
  for (const id of player.augments) discount += getAugment(id).economy?.levelXpDiscount ?? 0;
  return Math.max(0, needed - discount);
}

/** Adds xp and applies as many level-ups as it covers. */
export function addXp(player: PlayerState, amount: number): number {
  let levelsGained = 0;
  player.xp += amount;
  for (let guard = 0; guard < 32; guard += 1) {
    if (player.level >= MAX_LEVEL) { player.xp = 0; break; }
    const need = xpToNextLevel(player);
    if (need <= 0 || player.xp < need) break;
    player.xp -= need;
    player.level += 1;
    levelsGained += 1;
  }
  return levelsGained;
}

export type PurchaseResult = { ok: true } | { ok: false; reason: string };

export function buyXp(player: PlayerState): PurchaseResult {
  if (player.level >= MAX_LEVEL) return { ok: false, reason: 'MAX_LEVEL' };
  if (player.gold < XP_PURCHASE_COST) return { ok: false, reason: 'NOT_ENOUGH_GOLD' };
  player.gold -= XP_PURCHASE_COST;
  addXp(player, XP_PURCHASE_AMOUNT);
  return { ok: true };
}

/** Reroll cost after free rerolls and the 리롤 크레딧 augment. */
export function rerollCost(player: PlayerState): number {
  if (player.freeRerolls > 0) return 0;
  let cheapCount = 0;
  let cheapCost = REROLL_COST;
  for (const id of player.augments) {
    const eco = getAugment(id).economy;
    if (!eco?.cheapRerollCount) continue;
    cheapCount += eco.cheapRerollCount;
    cheapCost = Math.min(cheapCost, eco.cheapRerollCost ?? REROLL_COST);
  }
  if (player.cheapRerollsUsed < cheapCount) return cheapCost;
  return REROLL_COST;
}

export function payReroll(player: PlayerState): PurchaseResult {
  const cost = rerollCost(player);
  if (player.gold < cost) return { ok: false, reason: 'NOT_ENOUGH_GOLD' };
  if (player.freeRerolls > 0) {
    player.freeRerolls -= 1;
  } else if (cost < REROLL_COST) {
    player.cheapRerollsUsed += 1;
    player.gold -= cost;
  } else {
    player.gold -= cost;
  }
  return { ok: true };
}

/** Called at the start of each prep phase. */
export function resetRoundEconomy(player: PlayerState): void {
  player.cheapRerollsUsed = 0;
  let free = 0;
  for (const id of player.augments) free += getAugment(id).economy?.freeRefreshPerRound ?? 0;
  player.freeRerolls = free;
}

export function grantRoundXp(player: PlayerState): void {
  addXp(player, XP_PER_ROUND);
}

/** Spec §15 — player damage reduction from the trainer shield and augments. */
export function reducePlayerDamage(player: PlayerState, rawDamage: number): number {
  let damage = rawDamage;
  if (player.tacticianItems.includes('trainer_shield')) damage = damage * 0.9;
  for (const id of player.augments) damage -= getAugment(id).economy?.playerDamageReduction ?? 0;
  return Math.max(1, Math.round(damage));
}
