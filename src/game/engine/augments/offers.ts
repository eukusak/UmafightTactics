/** Augment offers and the non-combat half of augment effects (spec §25). */
import { AUGMENTS_BY_GRADE, getAugment } from './augment-defs';
import { getSeasonUnits, getUnitDef } from '../roster';
import { addXp } from '../economy';
import { newInstance, applyCombines, benchCapacity, itemStorageCapacity } from '../shop';
import { take } from '../pool';
import { EMBLEM_ITEM_IDS, COMPLETED_ITEM_DEFS } from '../items/item-defs';
import { Rng } from '../rng';
import type { AugmentGrade, TraitId } from '../types';
import type { AugmentOffer, MatchState, PlayerState } from '../state';

/** Supplied set-9 normal-lobby table. These are historical reference weights, not a claim about today's live patch. */
export const AUGMENT_SEQUENCES: Array<{ grades: [AugmentGrade, AugmentGrade, AugmentGrade]; weight: number }> = [
  ['SSG',5], ['SSP',5], ['SGG',12], ['SGP',5], ['SPP',1], ['GSG',18], ['GSP',2],
  ['GGG',22], ['GGP',3], ['GPS',6], ['GPG',10], ['GPP',1], ['PSG',4], ['PSP',1], ['PGG',2], ['PGP',1], ['PPG',1], ['PPP',1],
].map(([text, weight]) => ({ grades: (text as string).split('') as [AugmentGrade, AugmentGrade, AugmentGrade], weight: weight as number }));
export function gradeForAugmentRound(stage: number, grades: readonly AugmentGrade[]): AugmentGrade {
  return grades[stage <= 2 ? 0 : stage === 3 ? 1 : 2];
}
export function matchAugmentGrades(state: MatchState): [AugmentGrade, AugmentGrade, AugmentGrade] {
  if (state.augmentGrades) return state.augmentGrades;
  // Older saves retain their already-picked grades; all players still share future grades.
  const prefix = state.players.reduce<string[]>((best,p) => p.augments.length > best.length ? p.augments.map(id => getAugment(id).grade) : best, []);
  const pool = AUGMENT_SEQUENCES.filter(row => prefix.every((g,i) => row.grades[i] === g));
  const candidates = pool.length ? pool : AUGMENT_SEQUENCES;
  let roll = Rng.forStream(state.seed, 'augment-grade-sequence').next() * candidates.reduce((n,r) => n + r.weight, 0);
  const chosen = candidates.find(row => (roll -= row.weight) < 0) ?? candidates[candidates.length - 1];
  return state.augmentGrades = [...chosen.grades];
}

/** Three distinct options of the round's grade, never repeating a taken augment. */
export function rollAugmentOptions(player: PlayerState, grade: AugmentGrade, rng: Rng, excluded: string[] = []): string[] {
  const taken = new Set([...player.augments,...excluded]);
  const roster = new Set(getSeasonUnits(player.seasonId).map(u => u.id));
  const pool = AUGMENTS_BY_GRADE[grade].filter(a => !taken.has(a.id) && (!a.filter?.unitIds || a.filter.unitIds.some(id => roster.has(id))) && !(a.filter?.noActiveTrait && player.augments.includes('team_diversity')) && !(a.id === 'team_diversity' && player.augments.includes('outsider')));
  if (pool.length >= 3) return rng.sample(pool, 3).map((a) => a.id);

  return rng.sample(pool, Math.min(3, pool.length)).map(a => a.id);

}

export function createAugmentOffers(state: MatchState, rng: Rng): AugmentOffer[] {
  const grade = gradeForAugmentRound(state.stage, matchAugmentGrades(state));
  return state.players
    .filter((p) => p.eliminatedAtRound === null)
    .map((p) => ({
      playerId: p.id,
      grade,
      options: rollAugmentOptions(p, grade, rng),
      chosen: null,
      rerolled: [false,false,false],
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
  if (grants.unitId) {
    const unit = getUnitDef(grants.unitId);
    if (player.bench.length < benchCapacity(player) && take(state.pool, unit.id, 1)) {
      player.bench.push(newInstance(state, unit.id, 1)); applyCombines(state, player);
    } else player.gold += unit.cost;
  }
  if (grants.itemId) {
    // Reward inventory can overflow; capacity limits new purchases, never deletes earned gear.
    state.instanceCounter++;
    player.items.push({ instanceId: 'i' + state.instanceCounter, itemId: grants.itemId });
  }

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

/** Replace only one card, at the same grade, without showing a previously seen option. */
export function rerollAugmentOffer(state:MatchState,player:PlayerState,slot:number,rng:Rng|(()=>Rng)):boolean {
  const offer=state.augmentOffers.find(o=>o.playerId===player.id);
  if(state.phase!=='AUGMENT_SELECT'||player.eliminatedAtRound!==null||!offer||offer.chosen!==null||!Number.isInteger(slot)||slot<0||slot>=offer.options.length||offer.rerolled?.[slot])return false;
  const seen=[...new Set([...(offer.seen??[]),...offer.options])];
  const options=rollAugmentOptions(player,offer.grade,typeof rng==='function'?rng():rng,seen);
  if(!options.length)return false;
  offer.options[slot]=options[0];offer.seen=[...seen,options[0]];
  offer.rerolled??=offer.options.map(()=>false);offer.rerolled[slot]=true;
  return true;
}
