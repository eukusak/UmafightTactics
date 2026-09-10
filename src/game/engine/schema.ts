/** Runtime Zod schemas for everything loaded from JSON (spec §3.1). */
import { z } from 'zod';

export const CostSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);
export const StarSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export const RoleSchema = z.enum(['TANK', 'BRUISER', 'AD_CARRY', 'AP_CARRY', 'SUPPORT']);
export const DamageTypeSchema = z.enum(['PHYSICAL', 'MAGIC', 'TRUE', 'NONE']);
export const AttackRangeSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

export const TraitIdSchema = z.enum([
  'nige', 'senko', 'sashi', 'oikomi',
  'sprinter', 'miler', 'middle', 'stayer',
  'dirt_champion', 'all_rounder',
  'golden_generation', 'famous_house', 'international', 'unbeaten', 'comeback', 'triple_crown',
  'era_star', 'classic_legend', 'heisei_dynasty', 'reiwa_elite', 'queen', 'emperor',
  'record_breaker', 'iron_horse',
]);

export const StatKeySchema = z.enum([
  'hp', 'attackDamage', 'abilityPower', 'armor', 'magicResist', 'attackSpeed', 'attackRange',
  'moveSpeedHexPerSec', 'critChance', 'critMultiplier', 'startMana', 'maxMana',
]);

export const TriggerSchema = z.object({
  when: z.enum([
    'ALWAYS', 'COMBAT_START', 'ON_ATTACK', 'ON_NTH_ATTACK', 'ON_HIT_TAKEN', 'ON_CAST', 'ON_KILL',
    'ON_TAKEDOWN_ASSIST', 'HP_BELOW', 'HP_ABOVE', 'TARGET_HP_BELOW', 'AFTER_SECONDS',
    'EVERY_SECONDS', 'ON_DEATH', 'ADJACENT_ALLIES_AT_LEAST', 'NO_ADJACENT_ALLIES',
    'IN_FRONT_ROWS', 'IN_BACK_ROWS',
    'ON_SAME_TARGET_NTH_ATTACK', 'ON_BASIC_HIT_TAKEN', 'ON_SKILL_HIT', 'ON_CC_APPLIED', 'ON_SUPPORT_SKILL',
  ]),
  threshold: z.number().optional(),
});

export const EffectSchema = z.object({
  shape: z.enum(['LINE', 'CONE', 'CHAIN']).optional(), range: z.number().positive().max(12).optional(),
  maxTargets: z.number().int().min(1).max(8).optional(), leech: z.number().min(0).max(1).optional(),
  isolatedMultiplier: z.number().min(1).max(2).optional(), onKillMana: z.number().min(0).max(50).optional(),
  scaling: z.object({ attackDamage: z.number().optional(), abilityPower: z.number().optional(), armor: z.number().optional(), selfMaxHp: z.number().optional(), targetCurrentHp: z.number().optional(), targetMissingHp: z.number().optional(), cap: z.number().optional() }).optional(),
  refresh: z.boolean().optional(),
  perTargetCooldown: z.boolean().optional(),
  excludeSelf: z.boolean().optional(),
  kind: z.string(),
  stat: StatKeySchema.optional(),
  value: z.number().optional(),
  perStar: z.array(z.number()).optional(),
  duration: z.number().optional(),
  interval: z.number().optional(),
  delay: z.number().min(0).max(10).optional(),
  maxStacks: z.number().optional(),
  radius: z.number().optional(),
  target: z.string().optional(),
  trigger: TriggerSchema.optional(),
  damageType: DamageTypeSchema.optional(),
  status: z.string().optional(),
  tag: z.string().optional(),
  oncePerCombat: z.boolean().optional(),
});

export const SkillDefSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  template: z.enum([
    'DASH_LINE', 'AOE_BURST', 'SINGLE_EXECUTE', 'SHIELD_TAUNT', 'HEAL_BUFF', 'BACKLINE_DIVE',
    'MULTI_SHOT', 'CONE', 'AURA', 'CONTROL', 'RAMP', 'SUMMON',
  ]),
  baseValues: z.array(z.number()),
  starMultipliers: z.array(z.number()).length(3),
  damageType: DamageTypeSchema,
  targetRule: z.string(),
  manaCost: z.number().positive(),
  effects: z.array(EffectSchema).min(1),
  vfxKey: z.string().min(1),
  description: z.string().min(1),
  choreography: z.object({
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), emblem: z.number().int().min(0).max(144).optional(), label: z.string().optional(), motion: z.enum(['STRIKE','PULSE','CHANNEL']).optional(),
    windup: z.number().min(0).max(2), recovery: z.number().min(0).max(2),
    pulseInterval: z.number().positive().max(2), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), variant: z.string().min(1),
  }).optional(),
});

export const UnitDefSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  horseId: z.string().min(1),
  nameKo: z.string().min(1),
  nameJa: z.string(),
  nameEn: z.string(),
  cost: CostSchema,
  role: RoleSchema,
  activeS1: z.boolean(),
  uftRating: z.number().min(0).max(1),
  hp: z.number().positive(),
  attackDamage: z.number().positive(),
  abilityPower: z.number().positive(),
  armor: z.number().nonnegative(),
  magicResist: z.number().nonnegative(),
  attackSpeed: z.number().positive(),
  attackRange: AttackRangeSchema,
  moveSpeedHexPerSec: z.number().positive(),
  critChance: z.number().min(0).max(1),
  critMultiplier: z.number().min(1),
  startMana: z.number().nonnegative(),
  maxMana: z.number().positive(),
  traits: z.array(TraitIdSchema).min(3).max(4),
  skillId: z.string().min(1),
  skill: SkillDefSchema,
  source: z.object({
    powerIndex: z.number(),
    stats: z.object({
      speed: z.number(), stamina: z.number(), power: z.number(),
      guts: z.number(), intelligence: z.number(),
    }),
    birthYear: z.number().int(),
    signatureId: z.string(),
    signatureName: z.string(),
    archetype: z.string(),
    primaryStyle: z.enum(['nige', 'senko', 'sashi', 'oikomi']),
    bestDistance: z.enum(['sprinter', 'miler', 'middle', 'stayer']),
    dataConfidence: z.string(),
    historySummary: z.object({
      starts: z.number(), wins: z.number(),
      mainWin: z.string().nullable(),
      gradeWins: z.record(z.string(), z.number()),
    }),
    legacyTier: z.number(),
    legacyStarterCost: z.number(),
  }),
});

export const ArtManifestSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string(),
  characters: z.array(z.object({
    id: z.string(),
    nameKo: z.string(),
    activeS1: z.boolean(),
    cost: CostSchema,
    portrait: z.string(),
    battleSheet: z.string(),
    cutinRequired: z.boolean(),
  })),
  items: z.array(z.string()),
  traits: z.array(z.string()),
  augments: z.array(z.string()),
  status: z.array(z.string()),
  vfx: z.array(z.string()),
  starVfx: z.array(z.string()),
  pve: z.array(z.string()),
  boards: z.array(z.string()),
  ui: z.array(z.string()),
  banners: z.array(z.string()),
});

export const UnitInstanceSchema = z.object({
  instanceId: z.string(),
  unitDefId: z.string(),
  star: StarSchema,
  sourceCopies: z.union([z.literal(1), z.literal(3), z.literal(9)]),
  items: z.array(z.string()),
  position: z.object({ q: z.number().int(), r: z.number().int() }).nullable().optional(),
});

export const SaveGameSchema = z.object({
  version: z.literal(1),
  savedAt: z.string(),
  activeRosterHash: z.string(),
  match: z.unknown(),
});
