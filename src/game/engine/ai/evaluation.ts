import { effectUtility, unitAugmentValue, kitProfile } from './knowledge';
/** Public board evaluation shared by formation, shopping and item planning. */
import { getUnitDef, getUnitTraits } from '../roster';
import { getItem } from '../items/item-defs';
import { activeTierIndex, getTrait } from '../traits/trait-defs';
import { findRacePlanNode } from '../race-plan/defs';
import type { ItemDef } from '../types';
import type { PlayerState, UnitInstance } from '../state';
import type { TraitId } from '../types';

/**
 * How much this item is worth *because of the race plan*.
 *
 * Two things the generic item scorer cannot see: the GⅠ entry is the unit the
 * whole plan was chosen for, so gear belongs on it; and a plan that wants, say,
 * penetration rates a penetration item above its raw stat line.
 */
function racePlanItemBonus(unit: UnitInstance, item: ItemDef, player?: PlayerState): number {
  const rp = player?.racePlan;
  if (!rp?.entryUnitDefId || unit.unitDefId !== rp.entryUnitDefId) return 0;
  let bonus = 4;
  const axes = new Set(
    [rp.planId, rp.evolutionId, rp.finishingMoveId]
      .flatMap((id) => (id ? findRacePlanNode(id)?.fit.itemAxes ?? [] : [])),
  );
  if (axes.size) {
    const tags = new Set(item.tags);
    const wants = (axis: string): boolean => axes.has(axis as 'ad');
    if (wants('ad') && (item.stats.attackDamage || item.pctStats?.attackDamage)) bonus += 2;
    if (wants('ap') && (item.stats.abilityPower || item.pctStats?.abilityPower)) bonus += 2;
    if (wants('attackSpeed') && (item.stats.attackSpeed || item.pctStats?.attackSpeed)) bonus += 2;
    if (wants('crit') && item.stats.critChance) bonus += 2;
    if (wants('mana') && tags.has('MANA')) bonus += 2;
    if (wants('tank') && tags.has('TANK')) bonus += 2;
    if (wants('penetration') && item.effects.some((e) => e.kind === 'SUNDER_ARMOR_PCT' || e.kind === 'SHRED_MR_PCT')) bonus += 2;
    if (wants('sustain') && item.effects.some((e) => e.kind === 'OMNIVAMP' || e.kind.startsWith('HEAL'))) bonus += 2;
  }
  return bonus;
}
const traitsCache = new WeakMap<UnitInstance, { key: string; traits: TraitId[] }>();
export function unitTraits(player: PlayerState, unit: UnitInstance): TraitId[] {
  const bonus = player.bonusTraits.filter(b => b.instanceId === unit.instanceId).map(b => b.trait);
  const key = (player.seasonId ?? 's1') + ':' + unit.unitDefId + ':' + bonus.join(',') + ':' + unit.items.join(',');
  const cached = traitsCache.get(unit);
  if (cached?.key === key) return cached.traits;
  const traits = [...new Set([...getUnitTraits(unit.unitDefId, player.seasonId), ...bonus, ...unit.items.flatMap(id => getItem(id).grantsTrait ? [getItem(id).grantsTrait!] : [])])];
  traitsCache.set(unit, {key,traits}); return traits;
}
export function lineupTraits(player: PlayerState, units: UnitInstance[]): Map<TraitId, number> {
  const seen = new Map<TraitId, Set<string>>();
  for (const u of units) for (const t of unitTraits(player, u)) { const ids = seen.get(t) ?? new Set(); ids.add(u.unitDefId); seen.set(t, ids); }
  return new Map([...seen].map(([t, ids]) => [t, ids.size]));
}
export function unitPower(unit: UnitInstance): number {
  const d = getUnitDef(unit.unitDefId);
  return (1.6 + d.uftRating + d.cost * .38) * [0, 1, 1.8, 3.24][unit.star] + unit.items.reduce((n, id) => n + (getItem(id).isComponent ? .15 : .9), 0);
}
export function lineupScore(player: PlayerState, units: UnitInstance[]): number {
  let score = units.reduce((n, u) => n + unitPower(u), 0);
  const counts = lineupTraits(player, units);
  const traits=new Map(units.map(u=>[u.instanceId,unitTraits(player,u)]));
  for(const unit of units) {
    score += unitAugmentValue(player,unit,counts,traits.get(unit.instanceId)!) * .75;
    score += unit.items.reduce((n,id)=>n+Math.max(-3,itemFit(unit,id)),0)*.12;
  }
  for (const [id, count] of counts) {
    const tier = activeTierIndex(getTrait(id), count);
    if (tier >= 0) {
      const effects=getTrait(id).tiers[tier].effects;
      score += (tier + 1) * (1.3 + count * .2);
      for(const u of units) for(const e of effects) if(traits.get(u.instanceId)!.includes(id)||e.target==='ALL_ALLIES') score+=effectUtility(u,e)*.25;
    }
    else score += count * .08;
  }
  const front = units.filter(u => ['TANK', 'BRUISER'].includes(getUnitDef(u.unitDefId).role)).length;
  const carries = units.filter(u => ['AD_CARRY', 'AP_CARRY'].includes(getUnitDef(u.unitDefId).role)).length;
  score -= Math.max(0, Math.ceil(units.length * .3) - front) * 4;
  if (units.length >= 3 && !carries) score -= 4;
  score -= (units.length - new Set(units.map(u => u.unitDefId)).size) * 2.5;
  return score;
}
/** Distinguish damage types as well as broad item tags. */
export function itemFit(unit: UnitInstance, itemId: string, player?: PlayerState, fielded?: UnitInstance[], knownCounts?: Map<TraitId,number>): number {
  const d = getUnitDef(unit.unitDefId), item = getItem(itemId), tags = new Set(item.tags);
  const ad = !!(item.stats.attackDamage || item.pctStats?.attackDamage);
  const ap = !!(item.stats.abilityPower || item.pctStats?.abilityPower);
  const speed = !!(item.stats.attackSpeed || item.pctStats?.attackSpeed);
  let score = unitPower(unit) * .15;
  if (d.role === 'TANK') score += (tags.has('TANK') ? 6 : 0) + (item.effects.some(e => e.kind.startsWith('HEAL')) ? 2 : 0) - (ad || speed ? 3 : 0);
  if (d.role === 'BRUISER') score += (tags.has('TANK') ? 3 : 0) + (ad ? 3 : 0) + (item.effects.some(e => e.kind.startsWith('HEAL')) ? 2 : 0);
  if (d.role === 'AD_CARRY') score += (ad ? 5 : 0) + (speed ? 3 : 0) + (item.stats.critChance ? 2 : 0) - (ap && !ad ? 4 : 0) - (tags.has('TANK') ? 3 : 0);
  if (d.role === 'AP_CARRY') score += (ap ? 5 : 0) + (tags.has('MANA') ? 4 : 0) - (ad && !ap ? 4 : 0) - (tags.has('TANK') ? 3 : 0);
  if (d.role === 'SUPPORT') score += (tags.has('MANA') ? 4 : 0) + (ap ? 2 : 0) + (tags.has('UTILITY') ? 3 : 0);
  if (tags.has('DAMAGE') && (d.role === 'AD_CARRY' || d.role === 'AP_CARRY')) score += 1;
  if (d.role === 'AP_CARRY') score += (item.stats.abilityPower ?? 0) / 15;
  if (d.role === 'TANK') score += (item.stats.hp ?? 0) / 150 + ((item.stats.armor ?? 0) + (item.stats.magicResist ?? 0)) / 20;
  if (d.role === 'AD_CARRY') score += (item.pctStats?.attackDamage ?? 0) * 8 + (item.stats.attackDamage ?? 0) / 10;
  score += racePlanItemBonus(unit, item, player);
  const kit=kitProfile(unit);
  const existing=unit.items.flatMap(id=>getItem(id).effects);
  for(const e of item.effects) {
    const redundant=['WOUND','SUNDER_ARMOR_PCT','SHRED_MR_PCT','SKILLS_CAN_CRIT'].includes(e.kind) && existing.some(old=>old.kind===e.kind);
    score+=effectUtility(unit,e)*(redundant?.15:.45);
  }
  // Every skill uses AP in UFT, including physical spells; use the actual kit too.
  if(ap && d.role!=='AP_CARRY') score+=kit.spell*1.2;
  if(player) {
    const board=fielded??player.board,counts=knownCounts??lineupTraits(player,board),traits=unitTraits(player,unit);
    const equipped={...unit,items:[...unit.items,itemId]};
    const nextTraits=unitTraits(player,equipped);
    score+=(unitAugmentValue(player,equipped,counts,nextTraits)-unitAugmentValue(player,unit,counts,traits))*.8;
    if(item.grantsTrait) {
      const trait=item.grantsTrait,have=counts.get(trait)??0;
      const unique=!board.some(u=>u.unitDefId===unit.unitDefId && unitTraits(player,u).includes(trait));
      score+=traits.includes(trait)?-6:activeTierIndex(getTrait(trait),have+Number(unique))>activeTierIndex(getTrait(trait),have)?6:1;
    }
  }
  if (unit.items.includes(itemId)) score -= 2;
  return score;
}
