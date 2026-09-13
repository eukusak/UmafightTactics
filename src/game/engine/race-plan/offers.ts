/**
 * Deterministic, personalised offer generation.
 *
 * Three rules hold at every phase:
 *   1. Eight players never receive the same three cards.
 *   2. The same match state produces the same three cards, in the same order,
 *      on the server, on a reconnect and in a replay.
 *   3. The top three scores are never dealt straight: a weighted draw from the
 *      top ten keeps the same board from seeing one fixed answer every game.
 */
import { Rng } from '../rng';
import { getUnitDef } from '../roster';
import type { MatchState, PlayerState } from '../state';
import { buildRacePlanContext, type RacePlanContext } from './context';
import {
  ALL_FINISHING_DEFS, FINISHING_MOVE_DEFS, RACE_EVOLUTION_DEFS, RACE_PLAN_DEFS,
  SIGNATURE_BY_UNIT, evolutionFitsPlan, findRacePlanNode, getRacePlanNode, guardPasses,
} from './defs';
import { getRacingProfile } from './profiles';
import { buildReasons, scoreNode } from './score';
import type {
  FinishingCategory, OfferSlot, RacePlanNode, RacePlanOffer, RacePlanOfferPhase,
} from './types';

/** Candidates kept before the weighted draw. Below ten the system stops feeling personal. */
const TOP_K = 10;

export type OfferInputs = {
  state: MatchState;
  player: PlayerState;
  phase: RacePlanOfferPhase;
  /** Bumped per reroll so the stream never repeats. */
  rerollIndex: number;
  /** Finishing offers only. */
  entryUnitDefId?: string;
};

function offerRng(state: MatchState, player: PlayerState, phase: string, rerollIndex: number): Rng {
  return Rng.forStream(
    state.seed,
    `race-plan:${player.id}:${phase}:${state.stage}-${state.round}:${rerollIndex}`,
  );
}

/** How many players have already been shown each node at this decision point. */
export function lobbyExposure(state: MatchState): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of state.players) {
    for (const id of p.racePlan?.currentOffer?.options ?? []) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
}

export function candidatePool(inputs: OfferInputs): RacePlanNode[] {
  const { player, phase } = inputs;
  if (phase === 'PLAN') return RACE_PLAN_DEFS;
  if (phase === 'EVOLUTION') {
    const plan = player.racePlan?.planId ? findRacePlanNode(player.racePlan.planId) : undefined;
    if (!plan) return RACE_EVOLUTION_DEFS;
    const fitting = RACE_EVOLUTION_DEFS.filter((e) => evolutionFitsPlan(e, plan));
    return fitting.length >= 3 ? fitting : RACE_EVOLUTION_DEFS;
  }

  // FINISHING: the unit is known, so guards become a hard filter.
  const unitDefId = inputs.entryUnitDefId ?? player.racePlan?.entryUnitDefId;
  if (!unitDefId) return FINISHING_MOVE_DEFS;
  const unit = getUnitDef(unitDefId);
  const boardSize = player.board.length;
  const signature = SIGNATURE_BY_UNIT.get(unitDefId);
  const generic = FINISHING_MOVE_DEFS.filter((n) => guardPasses(n, unit, boardSize));
  const pool = signature && guardPasses(signature, unit, boardSize) ? [signature, ...generic] : generic;
  // The eight unguarded moves span five categories, so this can never run dry.
  return pool.length >= 3 ? pool : ALL_FINISHING_DEFS.filter((n) => !n.signatureUnitId);
}

type Scored = { node: RacePlanNode; score: number };

function scoreAll(inputs: OfferInputs, ctx: RacePlanContext, seen: ReadonlySet<string>): Scored[] {
  const { state, player, phase, rerollIndex } = inputs;
  const rng = offerRng(state, player, phase, rerollIndex);
  const exposure = lobbyExposure(state);
  const unitDefId = inputs.entryUnitDefId ?? player.racePlan?.entryUnitDefId;
  const profile = unitDefId ? getRacingProfile(unitDefId) : undefined;

  return candidatePool(inputs)
    .map((node) => ({
      node,
      score: scoreNode(node, ctx, {
        themeId: state.g1ThemeId,
        seenIds: seen,
        lobbyExposure: exposure,
        profile,
        jitter: 0.94 + rng.next() * 0.12,
      }).score,
    }))
    .sort((a, b) => b.score - a.score || a.node.id.localeCompare(b.node.id));
}

/** Weighted draw without replacement. Deterministic for a given Rng state. */
function draw(pool: Scored[], rng: Rng, accept: (node: RacePlanNode) => boolean): RacePlanNode | null {
  const eligible = pool.filter((c) => accept(c.node));
  if (!eligible.length) return null;
  const total = eligible.reduce((n, c) => n + c.score, 0);
  let roll = rng.next() * total;
  for (const candidate of eligible) {
    roll -= candidate.score;
    if (roll < 0) return candidate.node;
  }
  return eligible[eligible.length - 1].node;
}

/**
 * Slot roles.
 *   A — leans into what this board already does well.
 *   B — a different part of the race, or shores up what keeps going wrong.
 *   C — the racing pick: aptitude, course, a pivot worth trying.
 * Finishing offers additionally never repeat a category.
 */
function pickThree(pool: Scored[], rng: Rng, phase: RacePlanOfferPhase): RacePlanNode[] {
  const top = pool.slice(0, TOP_K);
  const chosen: RacePlanNode[] = [];
  const usedCategories = new Set<FinishingCategory>();
  const usedTags = new Set<string>();

  const take = (node: RacePlanNode | null): boolean => {
    if (!node || chosen.some((c) => c.id === node.id)) return false;
    chosen.push(node);
    usedTags.add(node.majorTag);
    if (node.finishingCategory) usedCategories.add(node.finishingCategory);
    return true;
  };
  const categoryFree = (node: RacePlanNode): boolean =>
    phase !== 'FINISHING' || !node.finishingCategory || !usedCategories.has(node.finishingCategory);

  // A: highest-scoring card that fits the board.
  take(draw(top, rng, categoryFree) ?? top[0]?.node ?? null);

  // B: a different phase band from A, and a different major tag.
  const aPhases = new Set(chosen[0]?.fit.phases ?? []);
  take(draw(top, rng, (n) =>
    categoryFree(n) && !usedTags.has(n.majorTag) && n.fit.phases.some((p) => !aPhases.has(p))));
  if (chosen.length < 2) take(draw(top, rng, (n) => categoryFree(n) && !usedTags.has(n.majorTag)));
  if (chosen.length < 2) take(draw(top, rng, categoryFree));

  // C: the flavour slot — aptitude, surface or course shaped where possible.
  const flavourFirst = (n: RacePlanNode): boolean =>
    categoryFree(n) && !usedTags.has(n.majorTag) &&
    Boolean(n.fit.aptitudeAxes?.length || n.fit.surfaces?.length || n.fit.distances?.length);
  take(draw(top, rng, flavourFirst));
  if (chosen.length < 3) take(draw(top, rng, (n) => categoryFree(n) && !usedTags.has(n.majorTag)));
  if (chosen.length < 3) take(draw(top, rng, categoryFree));
  // Last resort: ignore the category rule rather than deal fewer than three.
  for (const candidate of pool) {
    if (chosen.length >= 3) break;
    take(candidate.node);
  }
  return chosen.slice(0, 3);
}

export function createRacePlanOffer(inputs: OfferInputs): RacePlanOffer {
  const { state, player, phase, rerollIndex } = inputs;
  const ctx = buildRacePlanContext(state, player);
  const seen = new Set(player.racePlan?.offerHistory ?? []);
  const pool = scoreAll(inputs, ctx, seen);
  const rng = offerRng(state, player, `${phase}:draw`, rerollIndex);
  const nodes = pickThree(pool, rng, phase);
  const unitDefId = inputs.entryUnitDefId ?? player.racePlan?.entryUnitDefId;

  return {
    phase,
    options: nodes.map((n) => n.id),
    slots: ['A', 'B', 'C'].slice(0, nodes.length) as OfferSlot[],
    reasons: nodes.map((n) => buildReasons(n, ctx, state.g1ThemeId, unitDefId)),
    rerolled: nodes.map(() => false),
    seen: nodes.map((n) => n.id),
    chosen: null,
  };
}

/**
 * Replaces one card, keeping its slot role. Matches the augment UX exactly:
 * one free reroll per slot, and a card already seen never comes back.
 */
export function rerollRacePlanSlot(state: MatchState, player: PlayerState, slot: number): boolean {
  const offer = player.racePlan?.currentOffer;
  if (!offer || offer.chosen !== null) return false;
  if (!Number.isInteger(slot) || slot < 0 || slot >= offer.options.length) return false;
  if (offer.rerolled[slot]) return false;

  const ctx = buildRacePlanContext(state, player);
  const seen = new Set<string>([...(player.racePlan?.offerHistory ?? []), ...offer.seen, ...offer.options]);
  const inputs: OfferInputs = {
    state, player, phase: offer.phase,
    rerollIndex: offer.rerolled.filter(Boolean).length + 1,
  };
  const pool = scoreAll(inputs, ctx, seen).filter((c) => !seen.has(c.node.id));
  if (!pool.length) return false;

  const usedCategories = new Set(
    offer.options
      .filter((_: string, i: number) => i !== slot)
      .map((id: string) => findRacePlanNode(id)?.finishingCategory)
      .filter(Boolean) as FinishingCategory[],
  );
  const rng = offerRng(state, player, `${offer.phase}:reroll:${slot}`, inputs.rerollIndex);
  const replacement =
    draw(pool.slice(0, TOP_K), rng, (n) => offer.phase !== 'FINISHING' || !n.finishingCategory || !usedCategories.has(n.finishingCategory))
    ?? pool[0].node;

  offer.options[slot] = replacement.id;
  offer.reasons[slot] = buildReasons(
    replacement, ctx, state.g1ThemeId,
    player.racePlan?.entryUnitDefId,
  );
  offer.seen.push(replacement.id);
  offer.rerolled[slot] = true;
  return true;
}

/** Highest-scoring option on the current offer; used for timeouts and AI. */
export function recommendedOption(state: MatchState, player: PlayerState): string | null {
  const offer = player.racePlan?.currentOffer;
  if (!offer?.options.length) return null;
  const ctx = buildRacePlanContext(state, player);
  const unitDefId = player.racePlan?.entryUnitDefId;
  const profile = unitDefId ? getRacingProfile(unitDefId) : undefined;
  let best = offer.options[0];
  let bestScore = -Infinity;
  for (const id of offer.options) {
    const node = getRacePlanNode(id);
    const score = scoreNode(node, ctx, {
      themeId: state.g1ThemeId,
      seenIds: new Set(),
      lobbyExposure: new Map(),
      profile,
      jitter: 1,
    }).score;
    if (score > bestScore) { best = id; bestScore = score; }
  }
  return best;
}
