/**
 * GⅠ entry: picking the unit that carries the plan, and keeping that choice
 * attached to a unit that changes star level, gets sold, or gets re-bought.
 */
import { getUnitDef } from '../roster';
import type { MatchState, PlayerState, UnitInstance } from '../state';
import { buildRacePlanContext, unitItemFit } from './context';
import { findRacePlanNode, SIGNATURE_BY_UNIT } from './defs';
import { getG1Theme, getRacingProfile, readPct } from './profiles';
import type { CarryCandidate, RacePlanNode } from './types';

export type EntryMark = '◎' | '○' | '▲' | '';

export type EntryCandidate = CarryCandidate & {
  fit: number;
  mark: EntryMark;
  hasSignature: boolean;
};

function racePlanFit(node: RacePlanNode | undefined, unitDefId: string): number {
  if (!node) return 0.5;
  const def = getUnitDef(unitDefId);
  let fit = 0.5;
  if (node.fit.roles?.includes(def.role)) fit += 0.25;
  if (node.fit.styles?.includes(def.source.primaryStyle)) fit += 0.15;
  if (node.fit.distances?.includes(def.source.bestDistance)) fit += 0.1;
  const ranged = def.attackRange >= 2;
  if (node.guard.appliesTo === 'MELEE' && ranged) fit -= 0.35;
  if (node.guard.appliesTo === 'RANGED' && !ranged) fit -= 0.35;
  return Math.min(1, Math.max(0, fit));
}

/**
 * Entry fit.
 *
 * Real racing aptitude is 10% of this on purpose. It colours the recommendation
 * and never gates it: a unit with G in every relevant grade can still be entered
 * and still receives three finishing moves.
 *
 * `bestScore` is the strongest carry on the board, and the strength term is
 * measured against it rather than against 1. Raw carry scores for the units a
 * player is actually choosing between sit in a narrow band, so an absolute
 * reading compresses the one factor that should decide this — a three-star with
 * two items is a better entry than a bare legendary — into a gap small enough
 * for aptitude flavour to overturn. Relative strength restores the full range
 * to strength and leaves flavour at the tenth it is documented to be.
 */
export function entryFit(
  state: MatchState, player: PlayerState, candidate: CarryCandidate, bestScore = 1,
): number {
  const plan = player.racePlan?.planId ? findRacePlanNode(player.racePlan.planId) : undefined;
  const evolution = player.racePlan?.evolutionId ? findRacePlanNode(player.racePlan.evolutionId) : undefined;
  const unit = [...player.board, ...player.bench].find((u) => u.instanceId === candidate.instanceId);
  const theme = getG1Theme(state.g1ThemeId);
  const profile = getRacingProfile(candidate.unitDefId);

  const planFit = (racePlanFit(plan, candidate.unitDefId) + racePlanFit(evolution, candidate.unitDefId)) / 2;
  const itemFit = unit ? unitItemFit(unit, plan?.fit.itemAxes) : 0;
  const roleFit = plan?.fit.roles?.includes(candidate.role) ? 1 : 0.5;

  let aptitude = 0.5;
  if (profile && profile.confidence !== 'VERY_LOW') {
    const axes = [...(plan?.fit.aptitudeAxes ?? []), ...(evolution?.fit.aptitudeAxes ?? [])];
    const themeSurface = theme.surface === 'TURF' ? 'surfacePct.turf' : 'surfacePct.dirt';
    const all = axes.length ? axes : [themeSurface];
    aptitude = all.reduce((n, a) => n + readPct(profile, a), 0) / all.length;
  }

  const signature = SIGNATURE_BY_UNIT.has(candidate.unitDefId) ? 1 : 0;
  const relative = Math.min(1, candidate.score / Math.max(0.01, bestScore));

  // Strength first. Aptitude and the signature move are flavour, and flavour is
  // held below the strength terms so it can reorder near-equals without ever
  // putting a bare unit ahead of a clearly better carry.
  return (
    0.3 * candidate.score +
    0.2 * planFit +
    0.15 * itemFit +
    0.15 * relative +
    0.1 * roleFit +
    0.07 * aptitude +
    0.03 * signature
  );
}

export function entryCandidates(state: MatchState, player: PlayerState): EntryCandidate[] {
  const ctx = buildRacePlanContext(state, player);
  const bestScore = ctx.carries.reduce((n, c) => Math.max(n, c.score), 0);
  const scored = ctx.carries
    .map((candidate) => ({
      ...candidate,
      fit: entryFit(state, player, candidate, bestScore),
      mark: '' as EntryMark,
      hasSignature: SIGNATURE_BY_UNIT.has(candidate.unitDefId),
    }))
    .sort((a, b) => b.fit - a.fit || a.instanceId.localeCompare(b.instanceId));

  if (!scored.length) return scored;
  const best = scored[0].fit;
  const second = scored[1]?.fit ?? 0;
  for (const candidate of scored) {
    const node = player.racePlan?.planId ? findRacePlanNode(player.racePlan.planId) : undefined;
    const flavour = Boolean(node?.fit.aptitudeAxes?.length || node?.fit.surfaces?.length);
    if (candidate === scored[0] && best - second >= 0.06) candidate.mark = '◎';
    else if (candidate.fit >= best * 0.85) candidate.mark = '○';
    else if (candidate.fit >= best * 0.6 && flavour) candidate.mark = '▲';
  }
  return scored;
}

export const recommendedEntry = (state: MatchState, player: PlayerState): EntryCandidate | undefined =>
  entryCandidates(state, player)[0];

/**
 * Re-attaches the entry after the board changed.
 *
 * `applyCombines` keeps whichever copy carries the most items and deletes the
 * rest, so the registered instance id can vanish on a star-up. The unit def id
 * is the real key; the instance id is only a cache.
 */
export function reconcileEntryUnit(player: PlayerState): void {
  const rp = player.racePlan;
  if (!rp?.entryUnitDefId) return;
  const owned: UnitInstance[] = [...player.board, ...player.bench];

  if (owned.some((u) => u.instanceId === rp.entryUnitInstanceId)) {
    rp.entryDetached = false;
    return;
  }

  const heir = owned
    .filter((u) => u.unitDefId === rp.entryUnitDefId)
    .sort((a, b) => b.star - a.star || b.items.length - a.items.length)[0];

  if (heir) {
    rp.entryUnitInstanceId = heir.instanceId;
    // Re-buying the entry restores it once; a second sale is final.
    if (rp.entryDetached) rp.entryRestoreUsed = true;
    rp.entryDetached = false;
    return;
  }

  rp.entryUnitInstanceId = undefined;
  if (rp.entryRestoreUsed) {
    // Already used the one free restore: the entry is gone for good.
    rp.entryUnitDefId = undefined;
    rp.finishingMoveId = undefined;
    rp.entryDetached = false;
  } else {
    rp.entryDetached = true;
  }
}

/** The entry only races from the board. A bench entry contributes nothing. */
export function entryIsFielded(player: PlayerState): boolean {
  const rp = player.racePlan;
  if (!rp?.entryUnitDefId || rp.entryDetached) return false;
  return player.board.some(
    (u) => u.instanceId === rp.entryUnitInstanceId || u.unitDefId === rp.entryUnitDefId,
  );
}

/** The board instance currently carrying the entry, if it is fielded. */
export function fieldedEntryInstance(player: PlayerState): UnitInstance | undefined {
  const rp = player.racePlan;
  if (!rp?.entryUnitDefId) return undefined;
  return (
    player.board.find((u) => u.instanceId === rp.entryUnitInstanceId) ??
    player.board.find((u) => u.unitDefId === rp.entryUnitDefId)
  );
}

/**
 * Before the GⅠ entry exists, the plan rides the board's best carry so the
 * rounds between 2-5 and 4-5 are not dead weight.
 */
export function provisionalEntryInstance(state: MatchState, player: PlayerState): UnitInstance | undefined {
  const fielded = fieldedEntryInstance(player);
  if (fielded) return fielded;
  if (player.racePlan?.entryUnitDefId) return undefined;
  const ctx = buildRacePlanContext(state, player);
  const best = ctx.carries.find((c) => !c.onBench);
  return best ? player.board.find((u) => u.instanceId === best.instanceId) : undefined;
}
