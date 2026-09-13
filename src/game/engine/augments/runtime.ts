import type { AugmentDef, TraitId, EffectDef } from '../types';
import type { CombatUnit } from '../battle/combat-unit';
import { activeTierIndex, getTrait } from '../traits/trait-defs';
import { getAugment } from './augment-defs';
import { getItem } from '../items/item-defs';
import type { BattleEvent } from '../battle/engine';

export function augmentApplies(aug: AugmentDef, unit: Pick<CombatUnit, 'unitDefId' | 'cost' | 'items' | 'traits'>, counts: Map<TraitId, number>): boolean {
  const f = aug.filter;
  return !f || ((!f.unitIds || f.unitIds.includes(unit.unitDefId)) && (!f.itemId || unit.items.includes(f.itemId))
    && unit.cost >= (f.minCost ?? 1) && unit.cost <= (f.maxCost ?? 5)
    && unit.items.length >= (f.minItems ?? 0) && unit.items.length <= (f.maxItems ?? 3)
    && (!f.noActiveTrait || !unit.traits.some(id => activeTierIndex(getTrait(id), counts.get(id) ?? 0) >= 0)));
}
export function augmentEffects(aug: AugmentDef, progress: Record<string, number>, counts: Map<TraitId, number>): EffectDef[] {
  const multiplier = aug.activeTraitScaling ? Math.min(6, [...counts].filter(([id, count]) => activeTierIndex(getTrait(id), count) >= 0).length) : 1;
  const result = aug.teamEffects.map(e => ({ ...e, value: e.value === undefined ? undefined : e.value * multiplier }));
  if (aug.growth) result.push({ kind: 'STAT_ADD', stat: aug.growth.stat, value: Math.min(aug.growth.maxStacks, progress[aug.id] ?? 0) * aug.growth.value });
  return result;
}
/** Preload the item's real stacking counter, so future procs still obey its original cap. */
export function restoreItemMemory(unit: CombatUnit, aug: AugmentDef, progress: Record<string, number>): void {
  if (!aug.rememberItem) return;
  unit.items.forEach((id, slot) => {
    if (id !== aug.rememberItem) return;
    getItem(id).effects.forEach((effect, index) => {
      if (effect.kind !== 'STACKING_STAT') return;
      const count = Math.min(effect.maxStacks ?? 99, progress[aug.id] ?? 0);
      unit.stacks['count:item:' + id + ':' + slot + ':STACKING_STAT:' + index] = count;
      const key = (effect.tag === 'PCT' ? 'pct:' : 'flat:') + effect.stat;
      unit.stacks[key] = (unit.stacks[key] ?? 0) + count * (effect.value ?? 0);
    });
  });
}
/** Absolute next progress, staged until authoritative PvP settlement. Summons are excluded. */
export function combatProgress(augmentIds: string[], previous: Record<string, number>, units: CombatUnit[], events: BattleEvent[]): Record<string, number> {
  const next = { ...previous };
  for (const id of augmentIds) {
    const aug = getAugment(id);
    const eligible = units.filter(u => !u.id.includes('#summon') && (!aug.filter?.unitIds || aug.filter.unitIds.includes(u.unitDefId)));
    if (aug.growth) {
      const ids = new Set(eligible.map(u => u.id));
      const count = events.filter(e => aug.growth!.event === 'CAST' ? e.type === 'CAST' && ids.has(e.source) : e.type === 'DEATH' && !!e.killer && ids.has(e.killer)).length;
      next[id] = Math.min(aug.growth.maxStacks, (previous[id] ?? 0) + Math.min(aug.growth.perRoundCap, count));
    }
    if (aug.rememberItem) {
      let best = previous[id] ?? 0;
      for (const u of eligible) u.items.forEach((itemId, slot) => {
        if (itemId !== aug.rememberItem) return;
        getItem(itemId).effects.forEach((effect, index) => {
          if (effect.kind === 'STACKING_STAT') best = Math.max(best, Math.min(effect.maxStacks ?? 99, u.stacks['count:item:' + itemId + ':' + slot + ':STACKING_STAT:' + index] ?? 0));
        });
      });
      next[id] = best;
    }
  }
  return next;
}
