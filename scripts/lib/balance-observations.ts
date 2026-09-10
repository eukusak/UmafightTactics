import { getUnitTraits } from '../../src/game/engine/roster';
import { getItem } from '../../src/game/engine/items/item-defs';
import type { MatchState } from '../../src/game/engine/state';
import type { TraitId } from '../../src/game/engine/types';
/** Copy the field before settlement returns eliminated units to the pool. */
export function boardTraitCounts(state: MatchState, playerId: string): Map<TraitId, number> {
  const player = state.players.find((p) => p.id === playerId)!;
  const seen = new Map<TraitId, Set<string>>();
  for (const unit of player.board) {
    if (!unit.position) continue;
    const traits = [
      ...getUnitTraits(unit.unitDefId, state.seasonId),
      ...player.bonusTraits.filter((b) => b.instanceId === unit.instanceId).map((b) => b.trait),
      ...unit.items.map((id) => getItem(id).grantsTrait).filter((t): t is TraitId => !!t),
    ];
    for (const trait of traits) {
      const kinds = seen.get(trait) ?? new Set<string>();
      kinds.add(unit.unitDefId);
      seen.set(trait, kinds);
    }
  }
  return new Map([...seen].map(([trait, kinds]) => [trait, kinds.size]));
}
