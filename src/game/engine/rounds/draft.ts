/** Twinkle Draft (spec §20): 9 unit+component pedestals picked in HP order. */
import { getSeasonByCost } from '../roster';
import { COMPONENT_IDS } from '../items/item-defs';
import { remainingOf, take } from '../pool';
import type { Rng } from '../rng';
import type { Cost } from '../types';
import type { DraftOption, DraftState, MatchState, PlayerState } from '../state';
import { isAlive } from '../state';
import { benchCapacity, itemStorageCapacity, newInstance, applyCombines } from '../shop';

export const DRAFT_OPTION_COUNT = 9;

/** Cost mix of the pedestals, escalating with the stage. */
function draftCostWeights(stage: number, isStartSelection = false): Record<Cost, number> {
  // The 1-1 start selection hands out first units, so it stays low-cost.
  if (isStartSelection) return { 1: 60, 2: 40, 3: 0, 4: 0, 5: 0 };
  if (stage <= 2) return { 1: 20, 2: 45, 3: 30, 4: 5, 5: 0 };
  if (stage === 3) return { 1: 5, 2: 30, 3: 45, 4: 18, 5: 2 };
  if (stage === 4) return { 1: 0, 2: 15, 3: 40, 4: 37, 5: 8 };
  return { 1: 0, 2: 5, 3: 30, 4: 45, 5: 20 };
}

export function buildDraftOptions(
  state: MatchState, stage: number, rng: Rng, isStartSelection = false,
): DraftOption[] {
  const weights = draftCostWeights(stage, isStartSelection);
  const costs: Cost[] = [1, 2, 3, 4, 5];
  const options: DraftOption[] = [];
  const used = new Set<string>();

  for (let i = 0; i < DRAFT_OPTION_COUNT; i += 1) {
    let unitDefId: string | null = null;
    for (let attempt = 0; attempt < 12 && !unitDefId; attempt += 1) {
      const idx = rng.weightedIndex(costs.map((c) => weights[c]));
      if (idx < 0) break;
      const pool = getSeasonByCost(state.seasonId)[costs[idx]].filter(
        (u) => !used.has(u.id) && remainingOf(state.pool, u.id) > 0,
      );
      if (pool.length) unitDefId = rng.pick(pool).id;
    }
    if (!unitDefId) {
      // Fall back to anything still in the pool so a pedestal is never empty.
      const any = Object.entries(state.pool.remaining)
        .filter(([id, n]) => n > 0 && !used.has(id))
        .map(([id]) => id)
        .sort();
      if (!any.length) break;
      unitDefId = rng.pick(any);
    }
    used.add(unitDefId);
    options.push({
      index: i,
      unitDefId,
      itemId: rng.pick(COMPONENT_IDS as readonly string[]),
      takenBy: null,
    });
  }
  return options;
}

/**
 * Pick order (spec §20): the first draft is a seeded shuffle, later ones run
 * lowest HP first, with ties broken by who reached that HP earlier.
 */
export function draftOrder(state: MatchState, rng: Rng, isFirstDraft: boolean): string[] {
  const living = state.players.filter(isAlive);
  if (isFirstDraft) return rng.shuffle(living.map((p) => p.id));

  const shuffled = rng.shuffle(living.map((p) => p.id));
  const rank = new Map(shuffled.map((id, i) => [id, i]));
  return living
    .slice()
    .sort((a, b) =>
      a.hp - b.hp ||
      a.hpChangedAtRound - b.hpChangedAtRound ||
      rank.get(a.id)! - rank.get(b.id)!,
    )
    .map((p) => p.id);
}

export function createDraft(
  state: MatchState, rng: Rng, isFirstDraft: boolean, isStartSelection = false,
): DraftState {
  return {
    options: buildDraftOptions(state, state.stage, rng, isStartSelection),
    order: draftOrder(state, rng, isFirstDraft),
    cursor: 0,
  };
}

/** Players whose pick window is currently open — two at a time (spec §20). */
export function currentPickers(draft: DraftState): string[] {
  if (draft.carousel) return draft.carousel.avatars.filter(a => a.picked === null && draft.carousel!.elapsed >= a.releaseAt).map(a => a.playerId);
  return draft.order.slice(draft.cursor, draft.cursor + 2);
}

export type DraftPickResult = { ok: true } | { ok: false; reason: string };

export function pickDraftOption(
  state: MatchState, player: PlayerState, optionIndex: number, contact = false,
): DraftPickResult {
  if (!state.draft) return { ok: false, reason: 'NO_DRAFT' };
  if (state.draft.carousel && !contact) return { ok: false, reason: 'CONTACT_REQUIRED' };
  if (state.draft.options.some(o => o.takenBy === player.id)) return { ok: false, reason: 'ALREADY_PICKED' };
  if (!currentPickers(state.draft).includes(player.id)) return { ok: false, reason: 'NOT_YOUR_TURN' };
  const option = state.draft.options.find((o) => o.index === optionIndex);
  if (!option) return { ok: false, reason: 'NO_OPTION' };
  if (option.takenBy) return { ok: false, reason: 'ALREADY_TAKEN' };

  if (!take(state.pool, option.unitDefId, 1)) return { ok: false, reason: 'POOL_EMPTY' };
  option.takenBy = player.id;

  // Spec §20: the item splits off into storage, the unit lands on the bench.
  // A full bench is allowed one temporary slot, cleared before the next battle.
  const unit = newInstance(state, option.unitDefId, 1);
  player.bench.push(unit);
  if (player.items.length < itemStorageCapacity(player)) {
    state.instanceCounter += 1;
    player.items.push({ instanceId: `i${state.instanceCounter}`, itemId: option.itemId });
  }
  else unit.items.push(option.itemId); // A full item bench must never destroy carousel loot.
  applyCombines(state, player);

  state.draft.cursor += 1;
  return { ok: true };
}

export function draftComplete(draft: DraftState): boolean {
  return draft.cursor >= draft.order.length;
}

/** Spec §20 — a bench over capacity must be trimmed before the next battle. */
export function benchOverflow(player: PlayerState): number {
  return Math.max(0, player.bench.length - benchCapacity(player));
}
