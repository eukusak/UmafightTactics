/**
 * Match-level Race Plan operations.
 *
 * RoundDirector owns every state transition in this game, so these are pure
 * functions over MatchState that it calls — the same shape the augment system
 * uses. Nothing here reads the clock or the network.
 */
import {
  RACE_ENTRY_DEADLINE, RACE_ENTRY_EARLY_HP, RACE_ENTRY_EARLY_ROUND, RACE_ENTRY_RECHECK_ROUND,
  RACE_TRANSFER_DEADLINE,
} from '../constants';
import { Rng } from '../rng';
import { getUnitDef } from '../roster';
import { isAlive, type MatchState, type PlayerState } from '../state';
import { racePlanKindBefore, type RacePlanRoundKind } from '../rounds/schedule';
import { createDefaultRacePlanState, type RacePlanOfferPhase, type RecentCombatProfile } from './types';
import { createRacePlanOffer, recommendedOption, rerollRacePlanSlot } from './offers';
import { entryCandidates, reconcileEntryUnit, recommendedEntry } from './entry';
import { findRacePlanNode } from './defs';
import { rollG1Theme, rollTrackState } from './profiles';

const roundKey = (stage: number, round: number): number => stage * 100 + round;

/** Backfills state written before this system existed, and on every load. */
export function ensureRacePlanState(state: MatchState): void {
  state.g1ThemeId ??= rollG1Theme(state.seed);
  state.racePlanTrack ??= 'STANDARD';
  for (const player of state.players) {
    player.racePlan ??= createDefaultRacePlanState();
    reconcileEntryUnit(player);
  }
}

/** One going per round, shared by every fight in it. */
export function rollRoundTrackState(state: MatchState, rng: Rng): void {
  state.racePlanTrack = rollTrackState(rng);
}

export function racePlanOpensFor(state: MatchState, player: PlayerState): RacePlanRoundKind | null {
  const scheduled = racePlanKindBefore(state.stage, state.round);
  if (scheduled) {
    // Already past this step (a reconnect, or an early entry) — do not reopen.
    if (scheduled === 'PLAN' && player.racePlan?.planId) return null;
    if (scheduled === 'EVOLUTION' && player.racePlan?.evolutionId) return null;
    if (scheduled === 'ENTRY' && player.racePlan?.entryUnitDefId) return null;
    if (scheduled === 'EVOLUTION' && !player.racePlan?.planId) return 'PLAN';
    return scheduled;
  }
  const early = [RACE_ENTRY_EARLY_ROUND, RACE_ENTRY_RECHECK_ROUND].some(r => roundKey(state.stage, state.round) === roundKey(r.stage, r.round));
  if (early
    && player.hp <= RACE_ENTRY_EARLY_HP
    && player.racePlan?.planId
    && !player.racePlan.entryUnitDefId && !player.racePlan.entryDeferred) {
    return 'ENTRY';
  }
  return null;
}

const OFFER_PHASE: Record<RacePlanRoundKind, 'PLAN' | 'EVOLUTION' | 'ENTRY'> = {
  PLAN: 'PLAN', EVOLUTION: 'EVOLUTION', ENTRY: 'ENTRY',
};

/** Opens this round's decision for everyone still in the match. Returns true if any opened. */
export function openRacePlanOffers(state: MatchState): boolean {
  ensureRacePlanState(state);
  let opened = false;
  for (const player of state.players) {
    if (!isAlive(player)) continue;
    const kind = racePlanOpensFor(state, player);
    if (!kind) continue;
    const rp = player.racePlan!;
    rp.offerPhase = OFFER_PHASE[kind];
    if (kind === 'ENTRY') {
      rp.entryDeferred = false;
      rp.currentOffer = undefined;
    } else {
      rp.currentOffer = createRacePlanOffer({
        state, player, phase: kind as RacePlanOfferPhase, rerollIndex: 0,
      });
    }
    opened = true;
  }
  return opened;
}

export function racePlanPending(state: MatchState): boolean {
  return state.players.some((p) => isAlive(p) && racePlanPendingFor(p));
}

export function racePlanPendingFor(player: PlayerState): boolean {
  const rp = player.racePlan;
  if (!rp) return false;
  if (rp.offerPhase === 'ENTRY') return !rp.entryUnitDefId && !rp.entryDeferred;
  if (rp.offerPhase === 'PLAN' || rp.offerPhase === 'EVOLUTION' || rp.offerPhase === 'FINISHING') {
    return Boolean(rp.currentOffer && rp.currentOffer.chosen === null);
  }
  return false;
}

/** True while at least one player is choosing a finishing move. */
export function finishingPending(state: MatchState): boolean {
  return state.players.some(
    (p) => isAlive(p) && p.racePlan?.offerPhase === 'FINISHING' && p.racePlan.currentOffer?.chosen === null,
  );
}

function closeOffer(player: PlayerState, chosenId: string): void {
  const rp = player.racePlan!;
  rp.currentOffer!.chosen = chosenId;
  rp.offerHistory.push(...rp.currentOffer!.seen);
}

export function chooseRacePlanOption(state: MatchState, player: PlayerState, id: string): boolean {
  const rp = player.racePlan;
  const offer = rp?.currentOffer;
  if (!rp || !offer || offer.chosen !== null || !offer.options.includes(id)) return false;

  closeOffer(player, id);
  if (offer.phase === 'PLAN') {
    rp.planId = id;
    // A save resumed after 2-5 gets its plan and its branch back to back.
    rp.offerPhase = state.stage >= 3 && racePlanKindBefore(state.stage, state.round) === 'EVOLUTION'
      ? 'EVOLUTION' : 'NONE';
    if (rp.offerPhase === 'EVOLUTION') {
      rp.currentOffer = createRacePlanOffer({ state, player, phase: 'EVOLUTION', rerollIndex: 0 });
      return true;
    }
  } else if (offer.phase === 'EVOLUTION') {
    rp.evolutionId = id;
    rp.offerPhase = 'NONE';
  } else {
    rp.finishingMoveId = id;
    rp.offerPhase = 'COMPLETE';
  }
  rp.currentOffer = undefined;
  return true;
}

export function rerollRacePlanOption(state: MatchState, player: PlayerState, slot: number): boolean {
  if (!player.racePlan) return false;
  return rerollRacePlanSlot(state, player, slot);
}

export function chooseRaceEntry(state: MatchState, player: PlayerState, instanceId: string): boolean {
  const rp = player.racePlan;
  if (!rp || rp.offerPhase !== 'ENTRY' || rp.entryUnitDefId) return false;
  const unit = [...player.board, ...player.bench].find((u) => u.instanceId === instanceId);
  if (!unit) return false;

  rp.entryUnitDefId = unit.unitDefId;
  rp.entryUnitInstanceId = unit.instanceId;
  rp.entryDeferred = false;
  rp.entryDetached = false;
  openFinishingOffer(state, player);
  return true;
}

export function openFinishingOffer(state: MatchState, player: PlayerState): void {
  const rp = player.racePlan!;
  rp.offerPhase = 'FINISHING';
  rp.currentOffer = createRacePlanOffer({
    state, player, phase: 'FINISHING', rerollIndex: 0, entryUnitDefId: rp.entryUnitDefId,
  });
}

export function deferRaceEntry(_state: MatchState, player: PlayerState): boolean {
  const rp = player.racePlan;
  if (!rp || rp.offerPhase !== 'ENTRY' || rp.entryUnitDefId) return false;
  rp.entryDeferred = true;
  rp.offerPhase = 'NONE';
  return true;
}

/** Deferring is free, but 5-2 is the end of it. */
export function enforceRaceEntryDeadline(state: MatchState): void {
  if (roundKey(state.stage, state.round) < roundKey(RACE_ENTRY_DEADLINE.stage, RACE_ENTRY_DEADLINE.round)) return;
  for (const player of state.players) {
    const rp = player.racePlan;
    if (!rp || !isAlive(player) || rp.entryUnitDefId) continue;
    const best = recommendedEntry(state, player);
    if (!best) continue;
    rp.offerPhase = 'ENTRY';
    chooseRaceEntry(state, player, best.instanceId);
    const recommended = recommendedOption(state, player);
    if (recommended) chooseRacePlanOption(state, player, recommended);
  }
}

export function transferAvailable(state: MatchState, player: PlayerState): boolean {
  const rp = player.racePlan;
  if (!rp?.entryUnitDefId || rp.transferUsed) return false;
  return roundKey(state.stage, state.round)
    <= roundKey(RACE_TRANSFER_DEADLINE.stage, RACE_TRANSFER_DEADLINE.round);
}

/**
 * 승부마 변경: one free move of the entry to another unit.
 *
 * The plan and its evolution stay; the finishing move does not, because it was
 * chosen for a unit that is no longer racing. A fresh set of three is dealt for
 * the new one.
 */
export function transferRaceEntry(state: MatchState, player: PlayerState, instanceId: string): boolean {
  const rp = player.racePlan;
  if (!rp || !transferAvailable(state, player)) return false;
  const unit = [...player.board, ...player.bench].find((u) => u.instanceId === instanceId);
  if (!unit || unit.unitDefId === rp.entryUnitDefId) return false;

  rp.entryUnitDefId = unit.unitDefId;
  rp.entryUnitInstanceId = unit.instanceId;
  rp.finishingMoveId = undefined;
  rp.entryDetached = false;
  rp.entryRestoreUsed = false;
  rp.transferUsed = true;
  openFinishingOffer(state, player);
  return true;
}

/** Timeout: take the recommendation, not `options[0]` — slots are roles, not ranks. */
export function autoResolveRacePlans(state: MatchState): void {
  for (const player of state.players) {
    const rp = player.racePlan;
    if (!rp || !isAlive(player)) continue;
    if (rp.offerPhase === 'ENTRY' && !rp.entryUnitDefId) {
      const best = recommendedEntry(state, player);
      if (best) chooseRaceEntry(state, player, best.instanceId);
      else rp.offerPhase = 'NONE';
      continue;
    }
    if (rp.currentOffer && rp.currentOffer.chosen === null) {
      const id = recommendedOption(state, player) ?? rp.currentOffer.options[0];
      if (id) chooseRacePlanOption(state, player, id);
    }
  }
}

/**
 * AI choices.
 *
 * Same shape as `resolveAiAugments`: reroll the slots that score below the best
 * card, then take the best. Profiles only tilt the ranking; they never unlock a
 * different card pool.
 */
const PROFILE_BIAS: Record<string, Partial<Record<string, number>>> = {
  REROLL: { SLOW_PACE: 1.12, GUTS: 1.12, LAST_3F: 1.12 },
  FAST_LEVEL: { MIDDLE_PACE: 1.12 },
  ECONOMY: { LAST_3F: 1.1, PASSING: 1.1 },
  AD_FOCUS: { HIGH_PACE: 1.12, LEAD_CONTROL: 1.12 },
  AP_FOCUS: { MIDDLE_PACE: 1.12, LAST_3F: 1.12 },
  TRAIT_FOCUS: { TRACK: 1.15, LEAD_CONTROL: 1.15 },
  BALANCED: {},
};

function aiScore(state: MatchState, player: PlayerState, id: string, rng: Rng): number {
  const node = findRacePlanNode(id);
  if (!node) return 0;
  const bias = PROFILE_BIAS[player.aiProfile ?? 'BALANCED'] ?? {};
  const categoryBias = node.category ? bias[node.category] ?? 1 : 1;
  const recommended = recommendedOption(state, player);
  const base = recommended === id ? 1.2 : 1;
  return base * categoryBias * (0.92 + rng.next() * 0.16);
}

export function resolveAiRacePlans(state: MatchState, rng: Rng): void {
  for (const player of state.players) {
    const rp = player.racePlan;
    if (!rp || !isAlive(player) || player.aiProfile === null) continue;

    if (rp.offerPhase === 'ENTRY' && !rp.entryUnitDefId) {
      const candidates = entryCandidates(state, player);
      if (!candidates.length) { rp.offerPhase = 'NONE'; continue; }
      // A pair away from three stars is worth more than the raw fit says.
      const copies = new Map<string, number>();
      for (const u of [...player.board, ...player.bench]) {
        copies.set(u.unitDefId, (copies.get(u.unitDefId) ?? 0) + u.sourceCopies);
      }
      const best = candidates
        .map((c) => ({ c, score: c.fit + ((copies.get(c.unitDefId) ?? 0) >= 7 ? 0.08 : 0) }))
        .sort((a, b) => b.score - a.score)[0];
      chooseRaceEntry(state, player, best.c.instanceId);
    }

    const offer = rp.currentOffer;
    if (!offer || offer.chosen !== null) continue;
    const keep = [...offer.options].sort((a, b) => aiScore(state, player, b, rng) - aiScore(state, player, a, rng))[0];
    for (let slot = 0; slot < offer.options.length; slot += 1) {
      if (offer.options[slot] === keep) continue;
      if (aiScore(state, player, offer.options[slot], rng) <= aiScore(state, player, keep, rng)) {
        rerollRacePlanSlot(state, player, slot);
      }
    }
    const chosen = [...offer.options].sort((a, b) => aiScore(state, player, b, rng) - aiScore(state, player, a, rng))[0];
    chooseRacePlanOption(state, player, chosen);
  }
}

/**
 * Folds the last three PvP fights into the profile the offer engine reads.
 *
 * Derived from events the engine already records — no extra instrumentation in
 * the battle loop.
 */
export function updateRecentCombat(
  player: PlayerState,
  sample: { duration: number; endProgress: number; overtime: boolean; casts: number; frontlineLost: number; enemyFrontHp: number },
): void {
  const rp = player.racePlan;
  if (!rp) return;
  const prev = rp.recentCombat;
  const n = Math.min(3, prev.sampleCount + 1);
  const blend = (old: number, next: number): number =>
    Math.round(((old * (n - 1) + next) / n) * 1000) / 1000;

  const merged: RecentCombatProfile = {
    sampleCount: n,
    avgDuration: blend(prev.avgDuration, sample.duration),
    avgEndProgress: blend(prev.avgEndProgress, sample.endProgress),
    overtimeRate: blend(prev.overtimeRate, sample.overtime ? 1 : 0),
    carryDamageShare: prev.carryDamageShare,
    frontlineLossBeforeMid: blend(prev.frontlineLossBeforeMid, sample.frontlineLost),
    castsPerCombat: blend(prev.castsPerCombat, sample.casts),
    enemyFrontlineHpAtLate: blend(prev.enemyFrontlineHpAtLate, sample.enemyFrontHp),
  };
  rp.recentCombat = merged;
}

/** Public scouting view: plan, branch, entry and finishing move; nothing else. */
export function publicRacePlan(rp: PlayerState['racePlan']): PlayerState['racePlan'] {
  if (!rp) return rp;
  return {
    offerPhase: rp.offerPhase === 'COMPLETE' ? 'COMPLETE' : 'NONE',
    planId: rp.planId,
    evolutionId: rp.evolutionId,
    entryUnitDefId: rp.entryUnitDefId,
    finishingMoveId: rp.finishingMoveId,
    // Hidden: the live offer, its reasons, the deferral, and the transfer charge.
    entryUnitInstanceId: undefined,
    entryDetached: false,
    entryRestoreUsed: false,
    entryDeferred: false,
    transferUsed: false,
    currentOffer: undefined,
    offerHistory: [],
    recentCombat: {
      sampleCount: 0, avgDuration: 0, avgEndProgress: 0, overtimeRate: 0,
      carryDamageShare: 0, frontlineLossBeforeMid: 0, castsPerCombat: 0, enemyFrontlineHpAtLate: 0,
    },
  };
}

/** Human-readable label for the scouting row and the recap header. */
export function racePlanSummary(rp: PlayerState['racePlan']): string {
  if (!rp?.planId) return '';
  const plan = findRacePlanNode(rp.planId);
  const evolution = rp.evolutionId ? findRacePlanNode(rp.evolutionId) : undefined;
  const move = rp.finishingMoveId ? findRacePlanNode(rp.finishingMoveId) : undefined;
  const entry = rp.entryUnitDefId ? getUnitDef(rp.entryUnitDefId).nameKo : '';
  return [plan?.nameKo, evolution?.nameKo, entry, move?.nameKo].filter(Boolean).join(' · ');
}
