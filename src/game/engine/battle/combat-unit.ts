/** A unit as it exists inside one battle, plus all stat/effect bookkeeping. */
import {
  ATTACK_SPEED_CAP, DEFAULT_ABILITY_POWER, STAR_STAT_MULT, starSkillMultiplier,
} from '../constants';
import { getItem } from '../items/item-defs';
import { getUnitDef } from '../roster';
import type { BattleStats, DamageType, EffectDef, Role, SkillDef, StatusKind, TraitId } from '../types';
import type { Hex } from './hex';

export type Team = 'A' | 'B';

export type ActiveStatus = {
  kind: StatusKind;
  expiresAt: number;
  /** Source unit, for burn/wound attribution. */
  sourceId: string;
  /** Damage per tick for burn, as a fraction of max hp. */
  magnitude?: number;
  nextTickAt?: number;
};

export type TimedModifier = {
  stat: keyof BattleStats;
  /** Additive amount, or multiplier delta when `isMultiplier`. */
  value: number;
  isMultiplier: boolean;
  expiresAt: number;
};

export type Shield = { amount: number; expiresAt: number };

export type CombatUnit = {
  id: string;
  instanceId: string;
  unitDefId: string;
  nameKo: string;
  team: Team;
  role: Role;
  cost: 1 | 2 | 3 | 4 | 5;
  star: 1 | 2 | 3;
  traits: TraitId[];
  items: string[];
  skill: SkillDef;
  /** Cell the unit occupies right now. */
  cell: Hex;
  /** Fractional progress toward the next cell, for render interpolation. */
  moveProgress: number;
  moveFrom: Hex | null;

  /** Permanent stats for this battle before timed modifiers. */
  base: BattleStats;
  hp: number;
  maxHp: number;
  mana: number;
  shields: Shield[];
  statuses: ActiveStatus[];
  modifiers: TimedModifier[];
  timedEffects: Array<{ effect: EffectDef; expiresAt: number; key: string }>;
  /** Named permanent stacks: key -> stack count. */
  stacks: Record<string, number>;
  /** Flags for once-per-combat effects, keyed by effect signature. */
  usedOnce: Set<string>;

  targetId: string | null;
  attackCooldown: number;
  manaLockUntil: number;
  /** Consecutive attacks, for ON_NTH_ATTACK. */
  attackCount: number;
  /** Attacks landed on the current target, for 파죽지세 편자. */
  attacksOnCurrentTarget: number;
  lastTargetId: string | null;
  /** Units currently targeting this unit, for 경주장 석갑. */
  attackedBy: Set<string>;
  blockedSince: number;
  alive: boolean;
  diedAt: number;
  reviveAt: number | null;
  /** Aggregated passive amounts contributed by traits/items/augments. */
  aura: AuraTotals;
  /** Skill scaling for the unit's star level. */
  skillMultiplier: number;
  /** Attacks whose damage is still owed to takedown-assist tracking. */
  recentDamageTo: Map<string, number>;
};

export type AuraTotals = {
  damageAmp: number;
  damageReduction: number;
  omnivamp: number;
  critDamage: number;
  critChance: number;
  skillDamageAmp: number;
  shieldDamageAmp: number;
  healShieldAmp: number;
  ccResist: number;
  executeThreshold: number;
  attackSpeedCapBonus: number;
  skillsCanCrit: boolean;
  ccImmuneUntil: number;
  untargetableUntil: number;
};

export const emptyAura = (): AuraTotals => ({
  damageAmp: 0, damageReduction: 0, omnivamp: 0, critDamage: 0, critChance: 0,
  skillDamageAmp: 0, shieldDamageAmp: 0, healShieldAmp: 0, ccResist: 0,
  executeThreshold: 0, attackSpeedCapBonus: 0, skillsCanCrit: false,
  ccImmuneUntil: 0, untargetableUntil: 0,
});

/** Builds the pre-combat stat block from unit def + star + items. */
export function buildBaseStats(unitDefId: string, star: 1 | 2 | 3, items: string[]): BattleStats {
  const def = getUnitDef(unitDefId);
  const starMul = STAR_STAT_MULT[star];

  const stats: BattleStats = {
    hp: def.hp * starMul,
    attackDamage: def.attackDamage * starMul,
    abilityPower: DEFAULT_ABILITY_POWER,
    armor: def.armor,
    magicResist: def.magicResist,
    attackSpeed: def.attackSpeed,
    attackRange: def.attackRange,
    moveSpeedHexPerSec: def.moveSpeedHexPerSec,
    critChance: def.critChance,
    critMultiplier: def.critMultiplier,
    startMana: def.startMana,
    maxMana: def.maxMana,
  };

  // Flat item stats first, then percentage stats on the flat-inclusive total.
  const pct: Partial<Record<keyof BattleStats, number>> = {};
  for (const itemId of items) {
    const item = getItem(itemId);
    for (const [k, v] of Object.entries(item.stats)) {
      const key = k as keyof BattleStats;
      (stats[key] as number) += v as number;
    }
    for (const [k, v] of Object.entries(item.pctStats ?? {})) {
      const key = k as keyof BattleStats;
      pct[key] = (pct[key] ?? 0) + (v as number);
    }
  }
  for (const [k, v] of Object.entries(pct)) {
    const key = k as keyof BattleStats;
    (stats[key] as number) *= 1 + (v as number);
  }

  stats.attackRange = Math.min(4, Math.max(1, Math.round(stats.attackRange))) as BattleStats['attackRange'];
  stats.startMana = Math.min(stats.startMana, stats.maxMana);
  return stats;
}

export function makeCombatUnit(params: {
  id: string;
  instanceId: string;
  unitDefId: string;
  star: 1 | 2 | 3;
  items: string[];
  extraTraits: TraitId[];
  team: Team;
  cell: Hex;
}): CombatUnit {
  const def = getUnitDef(params.unitDefId);
  const base = buildBaseStats(params.unitDefId, params.star, params.items);
  const traits = [...def.traits];
  for (const t of params.extraTraits) if (!traits.includes(t)) traits.push(t);
  // Emblem items grant their trait to the holder.
  for (const itemId of params.items) {
    const granted = getItem(itemId).grantsTrait;
    if (granted && !traits.includes(granted)) traits.push(granted);
  }

  return {
    id: params.id,
    instanceId: params.instanceId,
    unitDefId: params.unitDefId,
    nameKo: def.nameKo,
    team: params.team,
    role: def.role,
    cost: def.cost,
    star: params.star,
    traits,
    items: params.items,
    skill: def.skill,
    cell: params.cell,
    moveProgress: 0,
    moveFrom: null,
    base,
    hp: base.hp,
    maxHp: base.hp,
    mana: base.startMana,
    shields: [],
    statuses: [],
    modifiers: [],
    timedEffects: [],
    stacks: {},
    usedOnce: new Set(),
    targetId: null,
    attackCooldown: 0,
    manaLockUntil: 0,
    attackCount: 0,
    attacksOnCurrentTarget: 0,
    lastTargetId: null,
    attackedBy: new Set(),
    blockedSince: -1,
    alive: true,
    diedAt: -1,
    reviveAt: null,
    aura: emptyAura(),
    skillMultiplier: starSkillMultiplier(params.star, def.cost),
    recentDamageTo: new Map(),
  };
}

/** Current value of a stat after permanent stacks and timed modifiers. */
export function stat(unit: CombatUnit, key: keyof BattleStats, now: number): number {
  let flat = unit.base[key] as number;
  let mult = 1;

  const stackFlat = unit.stacks[`flat:${key}`] ?? 0;
  const stackPct = unit.stacks[`pct:${key}`] ?? 0;
  flat += stackFlat;
  mult += stackPct;

  for (const m of unit.modifiers) {
    if (m.stat !== key || m.expiresAt <= now) continue;
    if (m.isMultiplier) mult += m.value;
    else flat += m.value;
  }

  let value = flat * mult;
  if (key === 'attackSpeed') {
    value = Math.min(ATTACK_SPEED_CAP + unit.aura.attackSpeedCapBonus, Math.max(0.1, value));
  }
  if (key === 'attackRange') value = Math.min(4, Math.max(1, Math.round(value)));
  if (key === 'critChance') value = Math.max(0, value);
  return value;
}

export function hasStatus(unit: CombatUnit, kind: StatusKind, now: number): boolean {
  return unit.statuses.some((s) => s.kind === kind && s.expiresAt > now);
}

export function isStunned(unit: CombatUnit, now: number): boolean {
  return hasStatus(unit, 'STUN', now);
}

export function isSilenced(unit: CombatUnit, now: number): boolean {
  return hasStatus(unit, 'SILENCE', now);
}

export function isTargetable(unit: CombatUnit, now: number): boolean {
  return unit.alive && unit.aura.untargetableUntil <= now && !hasStatus(unit, 'UNTARGETABLE', now);
}

export function totalShield(unit: CombatUnit, now: number): number {
  return unit.shields.reduce((acc, s) => (s.expiresAt > now ? acc + s.amount : acc), 0);
}

export function addShield(unit: CombatUnit, amount: number, duration: number, now: number): void {
  const scaled = amount * (1 + unit.aura.healShieldAmp);
  unit.shields.push({ amount: scaled, expiresAt: now + (duration > 0 ? duration : 999) });
}

export function heal(unit: CombatUnit, amount: number, now: number): number {
  if (!unit.alive) return 0;
  let scaled = amount * (1 + unit.aura.healShieldAmp);
  // A wound cuts incoming healing by a third.
  if (hasStatus(unit, 'WOUND', now)) scaled *= 0.67;
  const before = unit.hp;
  unit.hp = Math.min(unit.maxHp, unit.hp + scaled);
  return unit.hp - before;
}

export function addModifier(
  unit: CombatUnit, key: keyof BattleStats, value: number, isMultiplier: boolean,
  duration: number, now: number,
): void {
  if (duration <= 0) {
    // Permanent for this battle: fold into the stack table so it survives cleanup.
    const bucket = isMultiplier ? `pct:${key}` : `flat:${key}`;
    unit.stacks[bucket] = (unit.stacks[bucket] ?? 0) + value;
    if (key === 'hp') {
      const ratio = unit.maxHp > 0 ? unit.hp / unit.maxHp : 1;
      unit.maxHp = stat(unit, 'hp', now);
      unit.hp = Math.min(unit.maxHp, unit.maxHp * ratio);
    }
    return;
  }
  unit.modifiers.push({ stat: key, value, isMultiplier, expiresAt: now + duration });
  if (key === 'hp') {
    const ratio = unit.maxHp > 0 ? unit.hp / unit.maxHp : 1;
    unit.maxHp = stat(unit, 'hp', now);
    unit.hp = Math.min(unit.maxHp, unit.maxHp * ratio);
  }
}

/** Spec §14.5 — resistance to damage multiplier, defined for negative resist too. */
export function mitigationMultiplier(resist: number): number {
  if (resist >= 0) return 100 / (100 + resist);
  return 2 - 100 / (100 - resist);
}

export function resistFor(unit: CombatUnit, type: DamageType, now: number): number {
  if (type === 'TRUE' || type === 'NONE') return 0;
  const key: keyof BattleStats = type === 'PHYSICAL' ? 'armor' : 'magicResist';
  let value = stat(unit, key, now);
  const shredKey = type === 'PHYSICAL' ? 'shred:armor' : 'shred:magicResist';
  const kind = type === 'PHYSICAL' ? 'SUNDER_ARMOR_PCT' : 'SHRED_MR_PCT';
  const shredPct = Math.min(0.9, Math.max(unit.stacks[shredKey] ?? 0,
    ...unit.timedEffects.filter((e) => e.effect.kind === kind && e.expiresAt > now).map((e) => e.effect.value ?? 0)));
  value *= 1 - shredPct;
  return value;
}

export function cleanupExpired(unit: CombatUnit, now: number): void {
  unit.timedEffects = unit.timedEffects.filter((e) => e.expiresAt > now);
  if (unit.modifiers.length) unit.modifiers = unit.modifiers.filter((m) => m.expiresAt > now);
  if (unit.shields.length) unit.shields = unit.shields.filter((s) => s.expiresAt > now && s.amount > 0.01);
  if (unit.statuses.length) unit.statuses = unit.statuses.filter((s) => s.expiresAt > now);
}

/** Effect signature used to gate `oncePerCombat`. */
export const effectKey = (source: string, effect: EffectDef, index: number): string =>
  `${source}:${effect.kind}:${effect.stat ?? ''}:${index}`;
