/**
 * The single generic interpreter for every EffectDef in the game.
 *
 * Traits, items, augments and skills all express themselves as EffectDefs, so
 * the battle engine holds no per-item or per-skill branching (spec §23.4, §42).
 */
import { OVERTIME_HEAL_MULT } from '../constants';
import type { BattleStats, EffectDef, TargetRule, TriggerDef } from '../types';
import {
  addModifier, addShield, heal, hasStatus, isTargetable, stat, type CombatUnit,
} from './combat-unit';
import { hexDistance, isBackRow, isFrontRow, neighbours, hexKey } from './hex';

/** Everything an effect may need from the battle it runs inside. */
export type EffectContext = {
  supportSkillApplied?: (source: CombatUnit, target: CombatUnit, amount: number) => void;
  shieldCreated?: (source: CombatUnit, target: CombatUnit, amount: number) => void;
  now: number;
  overtime: boolean;
  units: CombatUnit[];
  /** Applies damage through the full mitigation pipeline. */
  dealDamage: (source: CombatUnit, target: CombatUnit, amount: number, type: EffectDef['damageType'], isSkill: boolean) => number;
  applyStatus: (source: CombatUnit, target: CombatUnit, effect: EffectDef) => void;
  /** Moves a unit toward a hex, respecting occupancy. */
  dash: (unit: CombatUnit, target: CombatUnit, maxDistance: number) => void;
  summon: (owner: CombatUnit, power: number, duration: number) => void;
};

export type EffectSource = 'TRAIT' | 'ITEM' | 'AUGMENT' | 'SKILL';

const allies = (ctx: EffectContext, unit: CombatUnit): CombatUnit[] =>
  ctx.units.filter((u) => u.team === unit.team && u.alive);
const enemies = (ctx: EffectContext, unit: CombatUnit): CombatUnit[] =>
  ctx.units.filter((u) => u.team !== unit.team && u.alive);

/** Resolves a target rule into concrete units, deterministically. */
export function resolveTargets(
  ctx: EffectContext, self: CombatUnit, rule: TargetRule | undefined, radius: number | undefined,
  currentTarget: CombatUnit | null,
): CombatUnit[] {
  const byId = (a: CombatUnit, b: CombatUnit) => a.id.localeCompare(b.id);
  const foes = enemies(ctx, self).filter((u) => isTargetable(u, ctx.now));

  const expand = (centre: CombatUnit | null, pool: CombatUnit[]): CombatUnit[] => {
    if (!centre || !centre.alive || (centre.team !== self.team && !isTargetable(centre, ctx.now))) return [];
    if (!radius || radius <= 0) return [centre];
    return pool.filter((u) => hexDistance(u.cell, centre.cell) <= radius)
      .sort((a, b) => Number(b.id === centre.id) - Number(a.id === centre.id) || byId(a, b));
  };

  switch (rule) {
    case 'SELF': return [self];
    case 'ALL_ALLIES': return radius ? expand(self, allies(ctx, self)) : allies(ctx, self);
    case 'ALL_ENEMIES': return radius ? expand(self, foes) : foes;
    case 'NEAREST_ENEMY': {
      const sorted = foes.slice().sort(
        (a, b) => hexDistance(self.cell, a.cell) - hexDistance(self.cell, b.cell) || byId(a, b),
      );
      return expand(sorted[0] ?? null, foes);
    }
    case 'FARTHEST_ENEMY': {
      const sorted = foes.slice().sort(
        (a, b) => hexDistance(self.cell, b.cell) - hexDistance(self.cell, a.cell) || byId(a, b),
      );
      return expand(sorted[0] ?? null, foes);
    }
    case 'LOWEST_HP_ENEMY': {
      const sorted = foes.slice().sort((a, b) => a.hp - b.hp || byId(a, b));
      return expand(sorted[0] ?? null, foes);
    }
    case 'LOWEST_HP_PCT_ENEMY': {
      const sorted = foes.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || byId(a, b));
      return expand(sorted[0] ?? null, foes);
    }
    case 'HIGHEST_HP_ENEMY': {
      const sorted = foes.slice().sort((a, b) => b.hp - a.hp || byId(a, b));
      return expand(sorted[0] ?? null, foes);
    }
    case 'LARGEST_ENEMY_CLUSTER': {
      let best: CombatUnit | null = null;
      let bestCount = -1;
      const r = radius ?? 1;
      for (const candidate of foes.slice().sort(byId)) {
        const count = foes.filter((u) => hexDistance(u.cell, candidate.cell) <= r).length;
        if (count > bestCount) { bestCount = count; best = candidate; }
      }
      return expand(best, foes);
    }
    case 'HIGHEST_AD_ENEMY':
      return expand(foes.slice().sort((a, b) => stat(b, 'attackDamage', ctx.now) - stat(a, 'attackDamage', ctx.now) || byId(a, b))[0] ?? null, foes);
    case 'HIGHEST_AD_ALLY':
      return expand(allies(ctx, self).sort((a, b) => stat(b, 'attackDamage', ctx.now) - stat(a, 'attackDamage', ctx.now) || byId(a, b))[0] ?? null, allies(ctx, self));
    case 'LOWEST_HP_ALLIES': return allies(ctx, self).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || byId(a, b));
    case 'LOWEST_HP_ALLY': {
      const pool = allies(ctx, self);
      const sorted = pool.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || byId(a, b));
      return sorted.length ? [sorted[0]] : [];
    }
    case 'CURRENT_TARGET':
    default:
      return expand(currentTarget, foes);
  }
}

/** Actual spatial hit list shared by the simulation and its emitted visual events. */
export function resolveEffectTargets(ctx: EffectContext, self: CombatUnit, effect: EffectDef, primary: CombatUnit | null, lockPrimary = false): CombatUnit[] {
  const filtered = effect.excludeSelf ? { ...ctx, units: ctx.units.filter(u => u.id !== self.id) } : ctx;
  let targets = resolveTargets(filtered, self, lockPrimary ? 'CURRENT_TARGET' : effect.target, effect.radius, primary);
  const centre = targets[0];
  const cap = effect.maxTargets ?? Infinity;
  const byId = (a: CombatUnit, b: CombatUnit) => a.id.localeCompare(b.id);
  if (effect.shape === 'CHAIN' && centre) {
    const pool = filtered.units.filter(u => u.alive && u.team === centre.team && (u.team === self.team || isTargetable(u, ctx.now)));
    targets = [centre];
    while (targets.length < cap) {
      const last = targets[targets.length - 1];
      const next = pool.filter(u => !targets.includes(u) && hexDistance(u.cell, last.cell) <= (effect.range ?? 3))
        .sort((a, b) => hexDistance(last.cell, a.cell) - hexDistance(last.cell, b.cell) || byId(a, b))[0];
      if (!next) break;
      targets.push(next);
    }
  } else if ((effect.shape === 'LINE' || effect.shape === 'CONE') && centre) {
    const point = (u: CombatUnit) => ({ x: u.cell.q + (u.cell.r & 1) * .5, y: u.cell.r * Math.sqrt(3) / 2 });
    const a = point(self), b = point(centre), dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
    if (length < .001) return [];
    targets = filtered.units.filter(u => {
      if (u.team === self.team || !u.alive || !isTargetable(u, ctx.now)) return false;
      const p = point(u), vx = p.x - a.x, vy = p.y - a.y;
      const along = (vx * dx + vy * dy) / length, cross = Math.abs(vx * dy - vy * dx) / length;
      if (along < -.001 || hexDistance(self.cell, u.cell) > (effect.range ?? 3)) return false;
      return effect.shape === 'LINE' ? cross <= .51 : along / Math.max(.001, Math.hypot(vx, vy)) >= .5 - 1e-8;
    }).sort((a, b) => hexDistance(self.cell, a.cell) - hexDistance(self.cell, b.cell) || byId(a, b));
  }
  return targets.filter(t => !effect.excludeSelf || t.id !== self.id).slice(0, cap);
}

/** True when the effect's trigger gate is currently satisfied. */
export function triggerHolds(
  unit: CombatUnit, trigger: TriggerDef | undefined, ctx: EffectContext,
  event: TriggerEvent, currentTarget: CombatUnit | null,
): boolean {
  if (!trigger || trigger.when === 'ALWAYS') return event === 'PASSIVE' || event === 'RECOMPUTE';
  const t = trigger.threshold ?? 0;

  switch (trigger.when) {
    case 'COMBAT_START': return event === 'COMBAT_START';
    case 'ON_ATTACK': return event === 'ON_ATTACK';
    case 'ON_NTH_ATTACK': return event === 'ON_ATTACK' && t > 0 && unit.attackCount % t === 0;
    case 'ON_SAME_TARGET_NTH_ATTACK': return event === 'ON_ATTACK' && t > 0 && unit.attacksOnCurrentTarget % t === 0;
    case 'ON_BASIC_HIT_TAKEN': return event === 'ON_BASIC_HIT_TAKEN';
    case 'ON_SKILL_HIT': return event === 'ON_SKILL_HIT';
    case 'ON_CC_APPLIED': return event === 'ON_CC_APPLIED';
    case 'ON_SUPPORT_SKILL': return event === 'ON_SUPPORT_SKILL';
    case 'ON_HIT_TAKEN': return event === 'ON_HIT_TAKEN';
    case 'ON_CAST': return event === 'ON_CAST';
    case 'ON_KILL': return event === 'ON_KILL';
    case 'ON_TAKEDOWN_ASSIST': return event === 'ON_KILL' || event === 'ON_ASSIST';
    case 'ON_DEATH': return event === 'ON_DEATH';
    case 'EVERY_SECONDS': return event === 'TICK';
    case 'AFTER_SECONDS': return (event === 'PASSIVE' || event === 'RECOMPUTE') && ctx.now >= t;
    case 'HP_BELOW': return unit.hp / unit.maxHp < t;
    case 'HP_ABOVE': return unit.hp / unit.maxHp >= t;
    case 'TARGET_HP_BELOW': return !!currentTarget && currentTarget.hp / currentTarget.maxHp <= t;
    case 'IN_FRONT_ROWS': return isFrontRow(unit.cell, unit.team);
    case 'IN_BACK_ROWS': return isBackRow(unit.cell, unit.team);
    case 'ADJACENT_ALLIES_AT_LEAST': {
      const keys = new Set(neighbours(unit.cell).map(hexKey));
      const n = ctx.units.filter(
        (u) => u.alive && u.team === unit.team && u.id !== unit.id && keys.has(hexKey(u.cell)),
      ).length;
      return n >= t;
    }
    case 'NO_ADJACENT_ALLIES': {
      const keys = new Set(neighbours(unit.cell).map(hexKey));
      return !ctx.units.some(
        (u) => u.alive && u.team === unit.team && u.id !== unit.id && keys.has(hexKey(u.cell)),
      );
    }
    default:
      return false;
  }
}

export type TriggerEvent =
  | 'ON_BASIC_HIT_TAKEN' | 'ON_SKILL_HIT' | 'ON_CC_APPLIED' | 'ON_SUPPORT_SKILL'
  | 'PASSIVE' | 'RECOMPUTE' | 'COMBAT_START' | 'ON_ATTACK' | 'ON_HIT_TAKEN' | 'ON_CAST'
  | 'ON_KILL' | 'ON_ASSIST' | 'ON_DEATH' | 'TICK';

/**
 * Aura-shaped effects are recomputed from scratch each tick rather than applied
 * once, so conditional gates (HP thresholds, adjacency, elapsed time) turn on
 * and off cleanly without leaking stacks.
 */
const AURA_KINDS = new Set([
  'DAMAGE_AMP', 'DAMAGE_REDUCTION', 'OMNIVAMP', 'CRIT_DAMAGE_ADD', 'CRIT_CHANCE_ADD',
  'SKILL_DAMAGE_AMP', 'SHIELD_DAMAGE_AMP', 'HEAL_SHIELD_AMP', 'CC_RESIST',
  'EXECUTE_THRESHOLD', 'ATTACK_SPEED_CAP_ADD', 'SKILLS_CAN_CRIT',
]);

/** Gates that remain conditions throughout an aura's lifetime. */
export const isContinuousAura = (effect: EffectDef): boolean => !effect.trigger ||
  ['ALWAYS', 'HP_BELOW', 'HP_ABOVE', 'TARGET_HP_BELOW', 'AFTER_SECONDS', 'IN_FRONT_ROWS', 'IN_BACK_ROWS', 'ADJACENT_ALLIES_AT_LEAST', 'NO_ADJACENT_ALLIES'].includes(effect.trigger.when);

export const isAuraKind = (kind: string): boolean => AURA_KINDS.has(kind);

/** Folds one aura effect into the unit's aggregate totals. */
export function accumulateAura(unit: CombatUnit, effect: EffectDef): void {
  const v = effect.value ?? 0;
  switch (effect.kind) {
    case 'DAMAGE_AMP': unit.aura.damageAmp += v; break;
    case 'DAMAGE_REDUCTION': unit.aura.damageReduction += v; break;
    case 'OMNIVAMP': unit.aura.omnivamp += v; break;
    case 'CRIT_DAMAGE_ADD': unit.aura.critDamage += v; break;
    case 'CRIT_CHANCE_ADD': unit.aura.critChance += v; break;
    case 'SKILL_DAMAGE_AMP': unit.aura.skillDamageAmp += v; break;
    case 'SHIELD_DAMAGE_AMP': unit.aura.shieldDamageAmp += v; break;
    case 'HEAL_SHIELD_AMP': unit.aura.healShieldAmp += v; break;
    case 'CC_RESIST': unit.aura.ccResist += v; break;
    case 'EXECUTE_THRESHOLD': unit.aura.executeThreshold = Math.max(unit.aura.executeThreshold, v); break;
    case 'ATTACK_SPEED_CAP_ADD': unit.aura.attackSpeedCapBonus += v; break;
    case 'SKILLS_CAN_CRIT': unit.aura.skillsCanCrit = true; break;
    default: break;
  }
}

export type ApplyOptions = {
  /** Star scaling for skill effects. */
  power: number;
  /** Stable key prefix used by oncePerCombat gating. */
  sourceKey: string;
  currentTarget: CombatUnit | null;
  event: TriggerEvent;
  targets?: CombatUnit[];
};

/** Item proc damage is bounded before mitigation and is independent of skill/star scaling. */
export function procDamage(self: CombatUnit, target: CombatUnit, effect: EffectDef, now: number): number {
  const s = effect.scaling ?? {};
  const amount = (effect.value ?? 0) + (s.attackDamage ?? 0) * stat(self, 'attackDamage', now)
    + (s.abilityPower ?? 0) * stat(self, 'abilityPower', now) + (s.armor ?? 0) * stat(self, 'armor', now)
    + (s.selfMaxHp ?? 0) * self.maxHp + (s.targetCurrentHp ?? 0) * Math.max(0, target.hp)
    + (s.targetMissingHp ?? 0) * Math.max(0, target.maxHp - target.hp);
  return Math.max(0, Math.min(s.cap ?? Infinity, amount));
}

/**
 * Applies one non-aura effect. Returns the number of units it touched, which
 * the caller uses only for logging.
 */
export function applyEffect(
  ctx: EffectContext, self: CombatUnit, effect: EffectDef, index: number, opts: ApplyOptions,
): number {
  const onceKey = `${opts.sourceKey}:${effect.kind}:${index}`;
  if (effect.oncePerCombat) {
    if (self.usedOnce.has(onceKey)) return 0;
    self.usedOnce.add(onceKey);
  }

  const power = opts.power;
  const value = (effect.value ?? 0) * (effect.kind === 'DAMAGE' || effect.kind === 'HEAL' || effect.kind === 'SHIELD_FLAT' ? power : 1);
  const healScale = ctx.overtime ? OVERTIME_HEAL_MULT : 1;
  const targets = (opts.targets ?? resolveEffectTargets(ctx, self, effect, opts.currentTarget))
    .filter(t => !effect.excludeSelf || t.id !== self.id);
  const recipients = effect.target ? targets : [self];
  const support = (target: CombatUnit, amount: number) => {
    if (opts.sourceKey.startsWith('skill:') && target.id !== self.id && target.team === self.team && amount > 0) ctx.supportSkillApplied?.(self, target, amount);
  };
  if (isAuraKind(effect.kind) && effect.kind !== 'EXECUTE_THRESHOLD') {
    for (const t of effect.target ? targets : [self]) {
      // The event already fired. Keep HP/target gates, consume event gates.
      const activeEffect = isContinuousAura(effect) ? effect : { ...effect, trigger: undefined };
      const previous = t.timedEffects.find(e => e.key === onceKey && e.expiresAt > ctx.now);
      if (previous && triggerHolds(t, previous.effect.trigger, ctx, 'RECOMPUTE', opts.currentTarget)) {
        accumulateAura(t, { ...previous.effect, value: -(previous.effect.value ?? 0) });
      }
      t.timedEffects = t.timedEffects.filter((e) => e.key !== onceKey);
      t.timedEffects.push({ effect: activeEffect, key: onceKey, expiresAt: ctx.now + (effect.duration || 999) });
      if (triggerHolds(t, activeEffect.trigger, ctx, 'RECOMPUTE', opts.currentTarget)) accumulateAura(t, activeEffect);
    }
    return effect.target ? targets.length : 1;
  }

  switch (effect.kind) {
    case 'SPELLBLADE': {
      self.stacks[`armed:${onceKey}`] = ctx.now + (effect.duration ?? 5);
      return 1;
    }
    case 'PROC_DAMAGE': {
      for (const t of targets) ctx.dealDamage(self, t, procDamage(self, t, effect, ctx.now), effect.damageType ?? 'PHYSICAL', false);
      return targets.length;
    }
    case 'STAT_ADD':
    case 'STAT_MUL': {
      const list = effect.target ? targets : [self];
      for (const t of list) {
        addModifier(t, effect.stat as keyof BattleStats, value, effect.kind === 'STAT_MUL', effect.duration ?? 0, ctx.now, effect.refresh ? `${self.id}:${onceKey}` : undefined);
      }
      return list.length;
    }
    case 'STACKING_STAT': {
      const max = effect.maxStacks ?? 99;
      const key = effect.tag === 'PCT' ? `pct:${effect.stat}` : `flat:${effect.stat}`;
      const countKey = `count:${onceKey}`;
      const used = self.stacks[countKey] ?? 0;
      if (used >= max) return 0;
      self.stacks[countKey] = used + 1;
      self.stacks[key] = (self.stacks[key] ?? 0) + (effect.value ?? 0);
      if (effect.stat === 'hp') {
        const ratio = self.maxHp > 0 ? self.hp / self.maxHp : 1;
        self.maxHp = stat(self, 'hp', ctx.now);
        self.hp = Math.min(self.maxHp, self.maxHp * ratio);
      }
      return 1;
    }
    case 'DAMAGE': {
      const repeat = effect.tag?.startsWith('REPEAT:') ? Number(effect.tag.slice(7)) || 1 : 1;
      let hits = 0;
      for (let i = 0; i < repeat; i += 1) {
        for (const t of targets) {
          if (!t.alive) continue;
          const isolated = !ctx.units.some(u => u.id !== t.id && u.alive && u.team === t.team && hexDistance(u.cell, t.cell) <= 1);
          const hpBefore = t.hp;
          ctx.dealDamage(self, t, value * (isolated ? effect.isolatedMultiplier ?? 1 : 1), effect.damageType ?? 'MAGIC', true);
          if (effect.leech && self.alive) heal(self, Math.max(0, hpBefore - t.hp) * effect.leech * healScale, ctx.now);
          if (effect.onKillMana && !t.alive && self.alive) self.mana = Math.min(stat(self, 'maxMana', ctx.now), self.mana + effect.onKillMana);
          hits += 1;
        }
      }
      return hits;
    }
    case 'DAMAGE_MAXHP_PCT': {
      for (const t of targets) {
        ctx.dealDamage(self, t, t.maxHp * (effect.value ?? 0), effect.damageType ?? 'TRUE', true);
      }
      return targets.length;
    }
    case 'ON_HIT_DAMAGE': {
      const list = targets.length ? targets : opts.currentTarget ? [opts.currentTarget] : [];
      for (const t of list) ctx.dealDamage(self, t, effect.value ?? 0, effect.damageType ?? 'PHYSICAL', false);
      return list.length;
    }
    case 'SPLASH_ON_HIT': {
      const centre = opts.currentTarget;
      if (!centre) return 0;
      const splash = enemies(ctx, self).filter(
        (u) => u.id !== centre.id && hexDistance(u.cell, centre.cell) <= (effect.radius ?? 1),
      ).sort((a, b) => a.id.localeCompare(b.id));
      const victim = splash[0];
      if (!victim) return 0;
      ctx.dealDamage(self, victim, stat(self, 'attackDamage', ctx.now) * (effect.value ?? 0), 'PHYSICAL', false);
      return 1;
    }
    case 'HEAL': {
      const list = recipients;
      for (const t of list) support(t, heal(t, value * healScale, ctx.now));
      return list.length;
    }
    case 'CLEANSE': {
      for (const t of targets) t.statuses = t.statuses.filter(s => !['STUN', 'SILENCE', 'DISARM', 'SLOW', 'TAUNT'].includes(s.kind));
      return targets.length;
    }
    case 'MANA_DRAIN': {
      for (const t of targets) t.mana = Math.max(0, t.mana - (effect.value ?? 0));
      return targets.length;
    }
    case 'HEAL_MAXHP_PCT': {
      const list = recipients;
      for (const t of list) support(t, heal(t, t.maxHp * (effect.value ?? 0) * healScale, ctx.now));
      return list.length;
    }
    case 'HEAL_MISSING_PCT': {
      const list = recipients;
      for (const t of list) support(t, heal(t, (t.maxHp - t.hp) * (effect.value ?? 0) * healScale, ctx.now));
      return list.length;
    }
    case 'SHIELD_MAXHP_PCT': {
      const list = recipients;
      for (const t of list) { const before = t.shields.length; addShield(t, t.maxHp * (effect.value ?? 0) * healScale, effect.duration ?? 5, ctx.now); const amount = t.shields.slice(before).reduce((n, s) => n + s.amount, 0); ctx.shieldCreated?.(self, t, amount); support(t, amount); }
      return list.length;
    }
    case 'SHIELD_FLAT': {
      const list = recipients;
      for (const t of list) { const before = t.shields.length; addShield(t, value * healScale, effect.duration ?? 5, ctx.now); const amount = t.shields.slice(before).reduce((n, s) => n + s.amount, 0); ctx.shieldCreated?.(self, t, amount); support(t, amount); }
      return list.length;
    }
    case 'MANA_ADD': {
      const list = effect.target ? targets : [self];
      for (const t of list) {
        const amount = effect.tag === 'MAX_MANA_FRACTION'
          ? stat(t, 'maxMana', ctx.now) * (effect.value ?? 0)
          : (effect.value ?? 0);
        t.mana = Math.min(stat(t, 'maxMana', ctx.now), t.mana + amount);
      }
      return list.length;
    }
    case 'ON_HIT_MANA': {
      self.mana = Math.min(stat(self, 'maxMana', ctx.now), self.mana + (effect.value ?? 0));
      return 1;
    }
    case 'MANA_MAX_ADD': {
      const list = effect.target ? targets : [self];
      for (const t of list) {
        t.base.maxMana = Math.max(30, t.base.maxMana + (effect.value ?? 0));
        t.mana = Math.min(t.mana, t.base.maxMana);
      }
      return list.length;
    }
    case 'APPLY_STATUS':
    case 'TAUNT': {
      const list = targets.length ? targets : opts.currentTarget ? [opts.currentTarget] : [];
      for (const t of list) ctx.applyStatus(self, t, { ...effect, status: effect.status ?? 'TAUNT' });
      return list.length;
    }
    case 'BURN':
    case 'WOUND': {
      const list = targets.length ? targets : opts.currentTarget ? [opts.currentTarget] : [];
      for (const t of list) ctx.applyStatus(self, t, { ...effect, status: effect.kind });
      return list.length;
    }
    case 'SUNDER_ARMOR_PCT': {
      for (const t of targets) {
        const key = `${self.id}:${onceKey}`;
        const old = t.timedEffects.find(e => e.key === key && e.expiresAt > ctx.now);
        const stacked = effect.maxStacks ? Math.min((effect.value ?? 0) * effect.maxStacks, (old?.effect.value ?? 0) + (effect.value ?? 0)) : effect.value;
        t.timedEffects = t.timedEffects.filter(e => e.key !== key);
        t.timedEffects.push({ effect: { ...effect, value: stacked }, key, expiresAt: ctx.now + (effect.duration || 999) });
      }
      return targets.length;
    }
    case 'SHRED_MR_PCT': {
      for (const t of targets) {
        const key = `${self.id}:${onceKey}`;
        t.timedEffects = t.timedEffects.filter(e => e.key !== key);
        t.timedEffects.push({ effect, key, expiresAt: ctx.now + (effect.duration || 999) });
      }
      return targets.length;
    }
    case 'EXECUTE_THRESHOLD': {
      for (const t of targets) if (t.alive && t.hp / t.maxHp < (effect.value ?? 0)) {
        ctx.dealDamage(self, t, t.hp + t.shields.reduce((n, s) => n + s.amount, 0), 'TRUE', true);
      }
      return targets.length;
    }
    case 'CC_IMMUNE': {
      self.aura.ccImmuneUntil = Math.max(self.aura.ccImmuneUntil, ctx.now + (effect.duration ?? 0));
      return 1;
    }
    case 'UNTARGETABLE': {
      self.aura.untargetableUntil = Math.max(self.aura.untargetableUntil, ctx.now + (effect.duration ?? 0));
      return 1;
    }
    case 'MANA_LOCK': {
      const list = targets.length ? targets : opts.currentTarget ? [opts.currentTarget] : [];
      for (const t of list) t.manaLockUntil = Math.max(t.manaLockUntil, ctx.now + (effect.duration ?? 1));
      return list.length;
    }
    case 'DASH': {
      const t = opts.currentTarget ?? resolveTargets(ctx, self, effect.target as TargetRule, undefined, null)[0];
      if (t) ctx.dash(self, t, effect.value ?? 2);
      return t ? 1 : 0;
    }
    case 'SUMMON': {
      ctx.summon(self, effect.value ?? 0, effect.duration ?? 10);
      return 1;
    }
    case 'REVIVE': {
      // Handled at death time; recording the intent here is enough.
      self.stacks['revive:pct'] = effect.value ?? 0.25;
      self.stacks['revive:delay'] = effect.duration ?? 1.5;
      return 1;
    }
    case 'SURVIVE_LETHAL': {
      const list = targets.length ? targets : [self];
      for (const t of list) t.stacks['surviveLethal'] = 1;
      return list.length;
    }
    default:
      return 0;
  }
}

export const unitHasWound = (unit: CombatUnit, now: number): boolean => hasStatus(unit, 'WOUND', now);
