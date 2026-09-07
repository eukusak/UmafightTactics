/** Every tunable number the spec pins down. Nothing here is derived at runtime. */
import type { Cost, Role } from './types';

export const GAME_VERSION = 1 as const;
export const SAVE_KEY = 'uma-fight-tactics-save-v1';
export const CANONICAL_ROSTER_SIZE = 145;
export const ACTIVE_S1_SIZE = 60;

/** Spec §7.5 — active unit *kinds* per cost. */
export const COST_UNIT_COUNTS: Record<Cost, number> = { 1: 14, 2: 14, 3: 13, 4: 11, 5: 8 };
/** Spec §17.3 — shared pool copies per unit kind. */
export const POOL_COPIES: Record<Cost, number> = { 1: 22, 2: 20, 3: 17, 4: 10, 5: 9 };

/** Spec §9.2 — per-cost baselines before percentile shaping. */
export const BASE_HP: Record<Cost, number> = { 1: 650, 2: 720, 3: 820, 4: 930, 5: 1050 };
export const BASE_AD: Record<Cost, number> = { 1: 48, 2: 54, 3: 60, 4: 68, 5: 76 };
export const BASE_AS: Record<Cost, number> = { 1: 0.68, 2: 0.7, 3: 0.72, 4: 0.74, 5: 0.76 };
export const BASE_RESIST: Record<Cost, number> = { 1: 28, 2: 30, 3: 32, 4: 35, 5: 38 };

/** Spec §9.5 — role mana pools, before the run-style adjustment. */
export const ROLE_MANA: Record<Role, { start: number; max: number }> = {
  TANK: { start: 30, max: 90 },
  BRUISER: { start: 20, max: 80 },
  AD_CARRY: { start: 0, max: 70 },
  AP_CARRY: { start: 20, max: 80 },
  SUPPORT: { start: 30, max: 90 },
};
export const RUN_STYLE_START_MANA: Record<string, number> = {
  nige: -10,
  senko: 0,
  sashi: 10,
  oikomi: 15,
};

/** Spec §10 — star scaling. */
export const STAR_STAT_MULT: Record<number, number> = { 1: 1.0, 2: 1.8, 3: 3.24 };
export function starSkillMultiplier(star: number, cost: Cost): number {
  if (star === 1) return 1.0;
  if (star === 2) return 1.45;
  if (cost === 5) return 6.0;
  if (cost === 4) return 3.6;
  return 2.2;
}

export const DEFAULT_CRIT_CHANCE = 0.25;
export const DEFAULT_CRIT_MULTIPLIER = 1.3;
export const DEFAULT_ABILITY_POWER = 100;

/** Spec §17.2 — shop odds. Columns are player levels 1..10, and each sums to 100. */
export const SHOP_ODDS: Record<Cost, number[]> = {
  1: [100, 100, 75, 55, 45, 30, 19, 18, 10, 5],
  2: [0, 0, 25, 30, 33, 40, 35, 25, 20, 10],
  3: [0, 0, 0, 15, 20, 25, 35, 36, 25, 20],
  4: [0, 0, 0, 0, 2, 5, 10, 18, 35, 40],
  5: [0, 0, 0, 0, 0, 0, 1, 3, 10, 25],
};

export const SHOP_SLOTS = 5;
export const REROLL_COST = 2;
export const XP_PURCHASE_COST = 4;
export const XP_PURCHASE_AMOUNT = 4;
export const XP_PER_ROUND = 2;
export const MAX_LEVEL = 10;
export const STARTING_HP = 100;
export const STARTING_GOLD = 0;
export const BENCH_SLOTS = 9;
export const ITEM_SLOTS = 10;
export const MAX_ITEMS_PER_UNIT = 3;

/** Spec §16.4 — XP required to reach the keyed level. */
export const XP_TO_LEVEL: Record<number, number> = {
  2: 2, 3: 2, 4: 6, 5: 10, 6: 20, 7: 36, 8: 60, 9: 68, 10: 68,
};

/** Team size equals player level. */
export const MAX_INTEREST = 5;
export const GOLD_PER_INTEREST = 10;

/** Spec §16.2 — streak gold. */
export function streakGold(streakAbs: number): number {
  if (streakAbs >= 6) return 3;
  if (streakAbs === 5) return 2;
  if (streakAbs >= 2) return 1;
  return 0;
}

/** Spec §15 — player damage by stage. */
export function baseStageDamage(stage: number): number {
  if (stage <= 2) return 0;
  if (stage === 3) return 2;
  if (stage === 4) return 3;
  if (stage === 5) return 5;
  if (stage === 6) return 8;
  if (stage === 7) return 15;
  return 150;
}

/** Spec §15 — extra damage from surviving enemy units. */
export function survivorDamage(count: number): number {
  const table = [0, 2, 4, 6, 8, 10, 11, 12, 13, 14];
  if (count < table.length) return table[count];
  return 5 + count;
}

/** Spec §14.7 — combat clock. */
export const BATTLE_TICK_MS = 50;
export const BATTLE_NORMAL_SECONDS = 30;
export const BATTLE_OVERTIME_SECONDS = 15;
export const BATTLE_MAX_SECONDS = BATTLE_NORMAL_SECONDS + BATTLE_OVERTIME_SECONDS;
export const OVERTIME_ATTACK_SPEED_MULT = 4;
export const OVERTIME_DAMAGE_MULT = 3;
export const OVERTIME_CC_MULT = 0.34;
export const OVERTIME_HEAL_MULT = 0.34;
export const ATTACK_SPEED_CAP = 5.0;

export const MANA_PER_ATTACK = 10;
export const MANA_FROM_DAMAGE_CAP = 50;
export const MANA_LOCK_AFTER_CAST_SECONDS = 1;

/** Spec §13.1 — logical board. */
export const BOARD_COLS = 7;
export const BOARD_ROWS_PER_SIDE = 4;
export const BOARD_ROWS_TOTAL = BOARD_ROWS_PER_SIDE * 2;

/** Spec §13.3 — hex render metrics at the 1920×1080 reference resolution. */
export const HEX_STEP_X = 112;
export const HEX_STEP_Y = 82;
export const HEX_ODD_ROW_OFFSET_X = 56;

/** Spec §19.3 — prep timers, in seconds. */
export const PREP_SECONDS = { PVP: 30, PVE: 20, AUGMENT: 45, DRAFT: 30 } as const;

/** Spec §19.2 — augments are offered before these rounds. */
export const AUGMENT_ROUNDS: Array<{ stage: number; round: number }> = [
  { stage: 2, round: 1 },
  { stage: 3, round: 2 },
  { stage: 4, round: 2 },
];

export const PLAYER_COUNT = 8;
export const AI_COUNT = 7;
export const DEFAULT_SEED = 20260907;
