/** Public board evaluation shared by formation, shopping and item planning. */
import { getUnitDef, getUnitTraits } from '../roster';
import { getItem } from '../items/item-defs';
import { activeTierIndex, getTrait } from '../traits/trait-defs';
import type { PlayerState, UnitInstance } from '../state';
import type { TraitId } from '../types';
export function unitTraits(player: PlayerState, unit: UnitInstance): TraitId[] {
  return [...new Set([...getUnitTraits(unit.unitDefId, player.seasonId), ...player.bonusTraits.filter(b => b.instanceId === unit.instanceId).map(b => b.trait), ...unit.items.flatMap(id => getItem(id).grantsTrait ? [getItem(id).grantsTrait!] : [])])];
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
  for (const [id, count] of counts) {
    const tier = activeTierIndex(getTrait(id), count);
    if (tier >= 0) score += (tier + 1) * (1.8 + count * .32);
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
export function itemFit(unit: UnitInstance, itemId: string): number {
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
  if (unit.items.includes(itemId)) score -= 2;
  return score;
}
