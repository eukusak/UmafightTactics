/** Every tunable number the spec pins down. Nothing here is derived at runtime. */
import type { Cost, Role } from './types';

export const GAME_VERSION = 1 as const;
export const SAVE_KEY = 'uma-fight-tactics-save-v1';
export const CANONICAL_ROSTER_SIZE = 145;
export const ACTIVE_S1_SIZE = 60;

/** Spec §7.5 — active unit *kinds* per cost. */
export const COST_UNIT_COUNTS: Record<Cost, number> = { 1: 14, 2: 14, 3: 13, 4: 11, 5: 8 };
/** Adopted 14.15 standard pool; see docs/TFT_PARITY_AUDIT.md for version boundaries. */
export const POOL_COPIES: Record<Cost, number> = { 1: 30, 2: 25, 3: 18, 4: 10, 5: 9 };

/**
 * Spec §9.2 — per-cost baselines before percentile shaping.
 *
 * 2026-09 balance: 4/5-cost bodies were trimmed (hp 930/1050, ad 68/76,
 * resist 35/38). A board of one-star legendaries picked up at level 6-7 beat a
 * finished reroll board on raw stats alone; the 1-3 cost columns are untouched
 * so the early game plays the same.
 */
export const BASE_HP: Record<Cost, number> = { 1: 650, 2: 720, 3: 820, 4: 900, 5: 1000 };
export const BASE_AD: Record<Cost, number> = { 1: 48, 2: 54, 3: 60, 4: 65, 5: 72 };
export const BASE_AS: Record<Cost, number> = { 1: 0.68, 2: 0.7, 3: 0.72, 4: 0.74, 5: 0.76 };
export const BASE_RESIST: Record<Cost, number> = { 1: 28, 2: 30, 3: 32, 4: 34, 5: 36 };

/**
 * Same kit/percentile at one star: damage, healing and flat shields separate by cost.
 *
 * These feed SkillDef.baseValues, which every art review pins by hash, so cost
 * balance is tuned on the stat curve and the shop instead — changing a number
 * here would force a re-review of all 145 motion sheets.
 */
export const COST_SKILL_POWER: Record<Cost, number> = { 1: 1, 2: 1.14, 3: 1.32, 4: 1.56, 5: 1.9 };
/** Utility scales more gently to avoid multiplying team-wide buffs into runaway carries. */
export const COST_SKILL_UTILITY: Record<Cost, number> = { 1: 1, 2: 1.06, 3: 1.14, 4: 1.24, 5: 1.36 };

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

/**
 * Spec §10 — star scaling.
 *
 * 2026-09 balance: three stars pay 3.5 instead of 3.24. Nine copies is the
 * game's most expensive commitment and the simulator finishes ~0.00 four- and
 * five-cost three-stars per match, so this lands almost entirely on reroll boards.
 */
export const STAR_STAT_MULT: Record<number, number> = { 1: 1.0, 2: 1.8, 3: 3.5 };
/** Also stored on SkillDef.starMultipliers, so it is pinned by art review too. */
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

/** Levels 7/8/9 follow published 17.1/16.1 values. Other columns retain the project baseline. */
/**
 * 2026-09 balance: levels 5-7 give out fewer 4-costs (2/5/10 -> 0/3/8).
 * Hitting a legendary at level 5-6 decided the mid game before a reroll board
 * could finish anything. Levels 8-10 are untouched, so the late game still
 * rewards levelling. Every column still sums to 100.
 */
export const SHOP_ODDS: Record<Cost, number[]> = {
  1: [100, 100, 75, 55, 46, 32, 20, 15, 10, 5],
  2: [0, 0, 25, 30, 34, 40, 31, 20, 17, 10],
  3: [0, 0, 0, 15, 20, 25, 40, 32, 25, 20],
  4: [0, 0, 0, 0, 0, 3, 8, 30, 33, 40],
  5: [0, 0, 0, 0, 0, 0, 1, 3, 15, 25],
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

/** Published 14.1 streak thresholds. */
export function streakGold(streakAbs: number): number {
  if (streakAbs >= 6) return 3;
  if (streakAbs === 5) return 2;
  if (streakAbs >= 3) return 1;
  return 0;
}

/** Published 14.9 full table plus 16.1 stage 3/4 changes. */
export function baseStageDamage(stage: number): number {
  if (stage <= 1) return 0;
  if (stage === 2) return 2;
  if (stage === 3) return 6;
  if (stage === 4) return 7;
  if (stage === 5) return 10;
  if (stage === 6) return 12;
  if (stage === 7) return 17;
  return 150;
}

/** Spec §15 — extra damage from surviving enemy units. */
export function survivorDamage(count: number): number {
  return Math.max(0, Math.floor(count));
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

/** Public 15.1 role rules. Our SUPPORT uses the Caster resource model. */
export const ROLE_ATTACK_MANA: Record<Role, number> = {
  TANK: 5, BRUISER: 10, AD_CARRY: 10, AP_CARRY: 7, SUPPORT: 7,
};
export const ROLE_MANA_REGEN: Record<Role, number> = {
  TANK: 0, BRUISER: 0, AD_CARRY: 0, AP_CARRY: 2, SUPPORT: 2,
};
/** 15.4 replaced Fighter omnivamp with stage-based attack speed. */
export function fighterAttackSpeed(stage: number): number {
  return stage <= 1 ? 0 : stage === 2 ? .05 : stage === 3 ? .1 : stage === 4 ? .2 : .3;
}
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

/**
 * Race Plan decision points. Deliberately clear of the augment rounds
 * (2-1 / 3-2 / 4-2), the twinkle draft (x-4) and the PvE round (x-7).
 */
export const RACE_PLAN_ROUNDS: Array<{ stage: number; round: number; kind: 'PLAN' | 'EVOLUTION' | 'ENTRY' }> = [
  { stage: 2, round: 5, kind: 'PLAN' },
  { stage: 3, round: 5, kind: 'EVOLUTION' },
  { stage: 4, round: 5, kind: 'ENTRY' },
];
export const RACE_PLAN_SECONDS = { PLAN: 45, ENTRY: 50, FINISHING: 35 } as const;
/**
 * A player on 20 hp or less is unlikely to survive to 4-5, and this is the
 * match's headline decision — so it opens early for them. Same cards, same
 * power, just reachable.
 */
export const RACE_ENTRY_EARLY_ROUND = { stage: 4, round: 3 } as const;
export const RACE_ENTRY_EARLY_HP = 30;
/** Deferring the entry is free but not open-ended. */
export const RACE_ENTRY_DEADLINE = { stage: 5, round: 2 } as const;
/** One free 승부마 변경 per match, up to here. */
export const RACE_TRANSFER_DEADLINE = { stage: 5, round: 5 } as const;

export const PLAYER_COUNT = 8;
export const AI_COUNT = 7;
export const DEFAULT_SEED = 20260907;
