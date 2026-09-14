import { starSkillMultiplier } from '../constants';
import type { Cost, EffectDef, SkillDef, Star } from '../types';

/** 100 AP is the authored baseline. Item procs and attacks never use this path. */
export const skillAbilityPowerMultiplier = (abilityPower: number): number => Math.max(0, abilityPower) / 100;

/**
 * The same idea for a physical cast, measured against the caster's own baseline.
 *
 * Every unit is authored at 100 ability power, so a magic skill grows exactly as
 * far as its holder's AP has been pushed above that. Physical casts had no
 * equivalent path at all: skill damage read ability power whatever its damage
 * type, so attack damage fed auto-attacks and nothing else, and an AD item
 * improved roughly half of a physical carry's output while an AP item improved
 * all of a magic one's. Thirty-two of the roster's authored damage effects are
 * physical, and none of them could be built into.
 *
 * Baseline is the unit's own starting attack damage rather than a constant,
 * because unlike ability power that number already varies by cost and star. At
 * baseline this returns 1, so nothing shifts until an item, trait or buff moves
 * the stat — which is precisely how the ability-power path behaves.
 */
export const skillAttackDamageMultiplier = (attackDamage: number, baseline: number): number =>
  Math.max(0, attackDamage) / Math.max(1, baseline);
export function skillUtilityMultiplier(star: Star, cost: Cost): number {
  return star === 1 ? 1 : star === 2 ? 1.2 : cost === 5 ? 2.2 : cost === 4 ? 1.8 : 1.5;
}

/** Resolve only a cast's support values. Damage is scaled once in resolveDamage.
 * Percentage support already benefits from the recipient's HP; it uses the
 * smaller utility curve without AP to avoid multiplying health growth twice.
 * Control duration, target count, geometry, and animation timing stay authored.
 */
export function scaleSkillSupport(effect: EffectDef, star: Star, cost: Cost, abilityPower: number): EffectDef {
  const value = effect.value;
  if (value === undefined) return effect;
  const utility = skillUtilityMultiplier(star, cost);
  let scaled = value;
  switch (effect.kind) {
    case 'HEAL': case 'SHIELD_FLAT': case 'SUMMON':
      scaled *= starSkillMultiplier(star, cost) * skillAbilityPowerMultiplier(abilityPower); break;
    case 'STAT_ADD': case 'STACKING_STAT':
      if (value > 0) scaled *= utility;
      break;
    case 'STAT_MUL':
      // Positive buffs grow; slows retain their authored strength.
      if (value > 0) scaled = Math.min(Math.max(value, 1.5), value * utility);
      break;
    case 'HEAL_MAXHP_PCT': case 'HEAL_MISSING_PCT':
      scaled = Math.min(Math.max(value, .75), value * utility); break;
    case 'SHIELD_MAXHP_PCT':
      scaled = Math.min(Math.max(value, 1), value * utility); break;
    case 'DAMAGE_REDUCTION': case 'SUNDER_ARMOR_PCT': case 'SHRED_MR_PCT':
      scaled = Math.min(Math.max(value, .5), value * utility); break;
    case 'MANA_ADD': case 'MANA_DRAIN':
      scaled = Math.min(Math.max(value, effect.tag === 'MAX_MANA_FRACTION' ? .3 : 30), value * utility); break;
  }
  return scaled === value ? effect : { ...effect, value: scaled };
}

/** Unmitigated per-target/per-hit values for inspection and balance audits. */
export function skillEffectValue(effect: EffectDef, star: Star, cost: Cost, abilityPower = 100): number | undefined {
  if (effect.value === undefined) return undefined;
  return effect.kind === 'DAMAGE' || effect.kind === 'DAMAGE_MAXHP_PCT'
    ? effect.value * starSkillMultiplier(star, cost) * skillAbilityPowerMultiplier(abilityPower)
    : scaleSkillSupport(effect, star, cost, abilityPower).value;
}

/** Keep hero augment modifications identical in combat and inspection. */
export function upgradeSkill(skill: SkillDef, upgrade: { damageMultiplier?: number; append?: EffectDef[] }): SkillDef {
  return { ...skill, effects: [
    ...skill.effects.map(e => (e.kind === 'DAMAGE' || e.kind === 'DAMAGE_MAXHP_PCT') && upgrade.damageMultiplier
      ? { ...e, value: (e.value ?? 0) * upgrade.damageMultiplier } : e),
    ...structuredClone(upgrade.append ?? []),
  ] };
}
