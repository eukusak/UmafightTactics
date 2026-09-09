/** Augment offers and the non-combat half of augment effects (spec §25). */
import { AUGMENTS_BY_GRADE, getAugment } from './augment-defs';
import { getSeasonUnits, getUnitDef } from '../roster';
import { addXp } from '../economy';
import { newInstance, applyCombines, benchCapacity, itemStorageCapacity } from '../shop';
import { take } from '../pool';
import { EMBLEM_ITEM_IDS, COMPLETED_ITEM_DEFS } from '../items/item-defs';
import type { Rng } from '../rng';
import type { AugmentGrade, TraitId } from '../types';
import type { AugmentOffer, MatchState, PlayerState } from '../state';

/** Silver at 2-1, Gold at 3-2, Prism at 4-2. */
export function gradeForAugmentRound(stage: number): AugmentGrade {
  if (stage <= 2) return 'S';
  if (stage === 3) return 'G';
  return 'P';
}

/** Three distinct options of the round's grade, never repeating a taken augment. */
export function rollAugmentOptions(player: PlayerState, grade: AugmentGrade, rng: Rng): string[] {
  const taken = new Set(player.augments);
  const pool = AUGMENTS_BY_GRADE[grade].filter((a) => !taken.has(a.id));
  if (pool.length >= 3) return rng.sample(pool, 3).map((a) => a.id);

  // Not enough left in this grade: top up from other grades, still without repeats.
  const fallback = [...AUGMENTS_BY_GRADE.S, ...AUGMENTS_BY_GRADE.G, ...AUGMENTS_BY_GRADE.P]
    .filter((a) => !taken.has(a.id) && !pool.some((p) => p.id === a.id));
  const combined = [...pool, ...rng.sample(fallback, Math.max(0, 3 - pool.length))];
  return combined.slice(0, 3).map((a) => a.id);
}

export function createAugmentOffers(state: MatchState, rng: Rng): AugmentOffer[] {
  const grade = gradeForAugmentRound(state.stage);
  return state.players
    .filter((p) => p.eliminatedAtRound === null)
    .map((p) => ({
      playerId: p.id,
      grade,
      options: rollAugmentOptions(p, grade, rng),
      chosen: null,
    }));
}

/**
 * Applies an augment: records it, then resolves its immediate economy effects
 * and one-shot grants. Combat effects are read straight off the def at battle
 * setup, so nothing needs to be applied here for those.
 */
export function applyAugment(
  state: MatchState, player: PlayerState, augmentId: string, rng: Rng,
): void {
  if (player.augments.includes(augmentId)) return;
  player.augments.push(augmentId);
  const def = getAugment(augmentId);

  if (def.economy?.instantGold) player.gold += def.economy.instantGold;
  if (def.economy?.instantXp) addXp(player, def.economy.instantXp);

  const grants = def.grants;
  if (!grants) return;

  if (grants.componentChoice) player.pendingGrants.push({ kind: 'COMPONENT_CHOICE', count: grants.componentChoice });
  if (grants.completedChoice) player.pendingGrants.push({ kind: 'COMPLETED_CHOICE', count: grants.completedChoice });
  if (grants.radiantChoice) player.pendingGrants.push({ kind: 'RADIANT_CHOICE', count: grants.radiantChoice });
  if (grants.emblemChoice) player.pendingGrants.push({ kind: 'EMBLEM_CHOICE', count: grants.emblemChoice });
  if (grants.removers) player.pendingGrants.push({ kind: 'REMOVER', count: grants.removers });
  if (grants.reforgers) player.pendingGrants.push({ kind: 'REFORGER', count: grants.reforgers });
  if (grants.secondaryTraitPick) player.pendingGrants.push({ kind: 'SECONDARY_TRAIT', count: 1 });
  if (grants.cloneMaxCost) {
    player.pendingGrants.push({ kind: 'CLONE', maxCost: grants.cloneMaxCost, count: 1 });
  }

  if (grants.tacticianCrown) {
    for (let i = 0; i < grants.tacticianCrown; i += 1) player.tacticianItems.push('trainer_crown');
  }

  if (grants.randomLegacyEmblem) {
    const legacy = ['emblem_golden_generation', 'emblem_famous_house', 'emblem_international', 'emblem_triple_crown'];
    grantItem(state, player, rng.pick(legacy));
  }

  if (grants.traitPlusOne) {
    const emblem = bestTraitEmblem(player, grants.traitPlusOne);
    if (emblem) grantItem(state, player, emblem);
  }

  if (grants.unitOfTrait) {
    grantUnitWithTrait(state, player, grants.unitOfTrait, rng);
  }
}

function grantItem(state: MatchState, player: PlayerState, itemId: string): void {
  if (player.items.length >= itemStorageCapacity(player)) return;
  state.instanceCounter += 1;
  player.items.push({ instanceId: `i${state.instanceCounter}`, itemId });
}

/** Emblem for whichever distance/surface trait the player already leans into. */
function bestTraitEmblem(player: PlayerState, mode: 'DISTANCE_BEST' | 'SURFACE_BEST'): string | null {
  const candidates: TraitId[] = mode === 'DISTANCE_BEST'
    ? ['sprinter', 'miler', 'middle', 'stayer']
    : ['dirt_champion', 'all_rounder'];

  const counts = new Map<TraitId, number>();
  const seen = new Set<string>();
  for (const u of player.board.concat(player.bench)) {
    if (seen.has(u.unitDefId)) continue;
    seen.add(u.unitDefId);
    for (const t of getUnitDef(u.unitDefId).traits) {
      if (candidates.includes(t)) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  const best = candidates
    .slice()
    .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b))[0];
  const emblem = COMPLETED_ITEM_DEFS.find((i) => i.grantsTrait === best);
  return emblem && EMBLEM_ITEM_IDS.includes(emblem.id) ? emblem.id : null;
}

function grantUnitWithTrait(state: MatchState, player: PlayerState, trait: TraitId, rng: Rng): void {
  const candidates = getSeasonUnits(state.seasonId).filter(
    (u) => u.traits.includes(trait) && u.cost <= 2 && (state.pool.remaining[u.id] ?? 0) > 0,
  );
  if (!candidates.length) return;
  if (player.bench.length >= benchCapacity(player)) return;
  const chosen = rng.pick(candidates);
  if (!take(state.pool, chosen.id, 1)) return;
  player.bench.push(newInstance(state, chosen.id, 1));
  applyCombines(state, player);
}
