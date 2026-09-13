/** Race Plan / GⅠ entry domain types (docs/RACE_PLAN_CODEX_SPEC_v2.md). */
import type { BattleStats, Cost, DistanceTrait, EffectDef, Role, RunStyle, Star } from '../types';

// ------------------------------------------------------------------- phases

export type RaceCombatPhase = 'START' | 'POSITIONING' | 'LATE' | 'LAST_3F' | 'OVERTIME';

/** Progress at which each phase opens, on the 0..1 race-progress scale. */
export const RACE_PHASE_AT: Record<Exclude<RaceCombatPhase, 'OVERTIME'>, number> = {
  START: 0,
  POSITIONING: 1 / 6,
  LATE: 2 / 3,
  LAST_3F: 5 / 6,
};

export const RACE_PHASE_LABEL: Record<RaceCombatPhase, string> = {
  START: '템',
  POSITIONING: '도중',
  LATE: '승부처',
  LAST_3F: '라스트 3F',
  OVERTIME: '극한 승부',
};

// ----------------------------------------------------------------- catalogue

export type RacePlanCategory =
  | 'HIGH_PACE' | 'LEAD_CONTROL' | 'MIDDLE_PACE' | 'SLOW_PACE'
  | 'PASSING' | 'LAST_3F' | 'GUTS' | 'TRACK';

/**
 * Finishing-move roles, one per move. An offer never repeats a category, which
 * is what stops three cards that all say "more damage in the last five seconds".
 */
export type FinishingCategory =
  | 'FRONTRUN' | 'SUSTAIN' | 'BURST' | 'SPELL' | 'TEMPO'
  | 'AMPLIFY' | 'PASSING' | 'SUPPORT' | 'CRIT';

export type EvolutionTag =
  | 'MORE_EARLY' | 'MORE_LATE' | 'SURVIVAL' | 'CAST' | 'BASIC_ATTACK'
  | 'EXECUTE' | 'POSITION' | 'STACK' | 'RESET' | 'PENETRATION'
  | 'SUSTAIN' | 'TEAM_SUPPORT';

/**
 * Which units a node is allowed to reach.
 *
 * A move that says "dash out and re-target" is a gift to a ranged carry and a
 * death sentence for a melee one. Guards are a hard filter at the finishing-move
 * offer, not a weight, so a player can never be handed a card that hurts them.
 */
export type NodeGuard = {
  appliesTo: 'MELEE' | 'RANGED' | 'ANY';
  roles?: Role[];
  /** Needs a neighbour to buff or hide behind; dropped on a two-unit board. */
  needsAdjacentAlly?: boolean;
  /** Pays out on takedowns, so it is worth less on a pure tank. */
  needsTakedown?: boolean;
};

export type NodeFit = {
  roles?: Role[];
  /** Item profile axes this node wants; see ItemProfile. */
  itemAxes?: Array<keyof ItemProfile>;
  economy?: EconomyArchetype[];
  styles?: RunStyle[];
  distances?: DistanceTrait[];
  surfaces?: Array<'turf' | 'dirt'>;
  /** Percentile axes read from HorseRacingProfile, e.g. 'stylePct.oikomi'. */
  aptitudeAxes?: string[];
  /** Where the node's power lands. Drives slot B ("a different race").  */
  phases: RaceCombatPhase[];
};

/** A resource a node accrues during combat and spends at a phase. */
export type NodeResource = {
  kind: 'LEG' | 'STAMINA';
  max: number;
  gainPerSeconds?: number;
  gainOnAttack?: number;
  gainOnCast?: number;
  gainOnHitTaken?: number;
  /** Omit to pay out continuously, one stack's worth per gain. */
  payoutPhase?: RaceCombatPhase;
  /** Applied once per stack held. */
  perStack: EffectDef[];
  /** Spend the stacks at payout, so the gauge empties on screen. */
  consume?: boolean;
  label: string;
};

export type RacePlanNodeKind = 'PLAN' | 'EVOLUTION' | 'FINISHING';

export type RacePlanNode = {
  id: string;
  kind: RacePlanNodeKind;
  nameKo: string;
  descriptionKo: string;
  /** One tag per node; three cards are never all the same one. */
  majorTag: EvolutionTag;
  tags: EvolutionTag[];
  baseWeight: number;
  guard: NodeGuard;
  fit: NodeFit;
  effects: EffectDef[];
  resource?: NodeResource;
  /** PLAN only. */
  category?: RacePlanCategory;
  /** EVOLUTION only: plan tags it can attach to. */
  requires?: EvolutionTag[];
  /** FINISHING only. */
  finishingCategory?: FinishingCategory;
  /** FINISHING only: a signature move, offered to this unit before the generic pool. */
  signatureUnitId?: string;
  /** Presentation. */
  vfx?: { color: string; accent?: string };
};

// ------------------------------------------------------------------ profiles

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
export type AffinityRating = 'FAVORITE' | 'GOOD' | 'NEUTRAL' | 'WEAK';
export type Affinity = { id: string; rating: AffinityRating; sample: number; delta: number };

export type HorseRacingProfile = {
  unitId: string;
  horseId: string;
  confidence: 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH';
  styleConfidence: 'LOW' | 'MEDIUM' | 'HIGH';
  starts: number;
  distance: Record<'sprint' | 'mile' | 'middle' | 'long', Grade>;
  surface: Record<'turf' | 'dirt', Grade>;
  style: Record<RunStyle, Grade>;
  distancePct: Record<'sprint' | 'mile' | 'middle' | 'long', number>;
  surfacePct: Record<'turf' | 'dirt', number>;
  stylePct: Record<RunStyle, number>;
  courses: Affinity[];
  going: Affinity[];
  seasons: Affinity[];
  signatureId: string | null;
  signatureName: string | null;
  mainWin: string | null;
  gradeWins: Record<string, number>;
};

export type G1Theme = {
  id: string;
  nameJa: string;
  nameKo: string;
  racecourse: string;
  courseNameKo: string;
  surface: 'TURF' | 'DIRT';
  distanceM: number;
  distanceClass: 'SPRINT' | 'MILE' | 'MIDDLE' | 'LONG';
  direction: 'LEFT' | 'RIGHT';
  season: 'SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER';
  grade: string;
  straightM: number | null;
};

/** Shared per-round going, so both sides of every PvP fight race the same track. */
export type TrackState = 'FAST' | 'STANDARD' | 'HEAVY';

// -------------------------------------------------------------- offer inputs

export type ItemProfile = {
  ad: number; ap: number; attackSpeed: number; crit: number; mana: number;
  tank: number; sustain: number; utility: number; burnWound: number; penetration: number;
};

export type EconomyArchetype = 'REROLL' | 'TEMPO' | 'FAST_8' | 'FAST_9' | 'FLEX' | 'RECOVERY';

export type RecentCombatProfile = {
  sampleCount: number;
  avgDuration: number;
  /** Race progress reached when combat ended, averaged. Drives early/late weighting. */
  avgEndProgress: number;
  overtimeRate: number;
  carryDamageShare: number;
  frontlineLossBeforeMid: number;
  castsPerCombat: number;
  enemyFrontlineHpAtLate: number;
};

export const EMPTY_COMBAT_PROFILE: RecentCombatProfile = {
  sampleCount: 0, avgDuration: 0, avgEndProgress: 0, overtimeRate: 0,
  carryDamageShare: 0, frontlineLossBeforeMid: 0, castsPerCombat: 0,
  enemyFrontlineHpAtLate: 0,
};

export type CarryCandidate = {
  instanceId: string;
  unitDefId: string;
  cost: Cost;
  star: Star;
  role: Role;
  /** 1 == melee. */
  attackRange: number;
  onBench: boolean;
  items: string[];
  score: number;
};

export type OfferReason =
  | 'ITEM_AS_HIGH' | 'ITEM_AD_HIGH' | 'ITEM_AP_HIGH' | 'ITEM_TANK_HIGH' | 'ITEM_MANA_HIGH'
  | 'FAST_COMBAT' | 'LONG_COMBAT' | 'OVERTIME_OFTEN'
  | 'EARLY_FRONTLINE_COLLAPSE' | 'ENEMY_TANK_WALL' | 'CARRY_CAST_LATE'
  | 'LOW_LEVEL_REROLL' | 'HIGH_ECONOMY' | 'WIN_STREAK' | 'LOSS_STREAK'
  | 'STYLE_NIGE' | 'STYLE_SENKO' | 'STYLE_SASHI' | 'STYLE_OIKOMI'
  | 'DISTANCE_SPRINT' | 'DISTANCE_MILE' | 'DISTANCE_MIDDLE' | 'DISTANCE_LONG'
  | 'SURFACE_TURF' | 'SURFACE_DIRT' | 'COURSE_AFFINITY' | 'G1_THEME_MATCH'
  | 'TRAIT_ACTIVE' | 'CARRY_READY' | 'PIVOT_ROOM' | 'NODE_TIMING';

/** A reason plus the numbers the copy needs; the client never recomputes these. */
export type OfferReasonPayload = { reason: OfferReason; n?: number; text?: string };

export type OfferSlot = 'A' | 'B' | 'C';

export type RacePlanOfferPhase = 'PLAN' | 'EVOLUTION' | 'FINISHING';

export type RacePlanOffer = {
  phase: RacePlanOfferPhase;
  options: string[];
  slots: OfferSlot[];
  reasons: OfferReasonPayload[][];
  rerolled: boolean[];
  seen: string[];
  chosen: string | null;
};

export type RacePlanState = {
  offerPhase: 'NONE' | 'PLAN' | 'EVOLUTION' | 'ENTRY' | 'FINISHING' | 'COMPLETE';
  planId?: string;
  evolutionId?: string;
  /** Primary key for the entry: instance ids do not survive a star-up. */
  entryUnitDefId?: string;
  entryUnitInstanceId?: string;
  /** Set when the entry unit left the board, so one re-buy can restore it. */
  entryDetached?: boolean;
  entryRestoreUsed: boolean;
  finishingMoveId?: string;
  entryDeferred: boolean;
  transferUsed: boolean;
  currentOffer?: RacePlanOffer;
  offerHistory: string[];
  recentCombat: RecentCombatProfile;
};

export function createDefaultRacePlanState(): RacePlanState {
  return {
    offerPhase: 'NONE',
    entryRestoreUsed: false,
    entryDeferred: false,
    transferUsed: false,
    offerHistory: [],
    recentCombat: { ...EMPTY_COMBAT_PROFILE },
  };
}

/** Battle-side input: the entry unit and everything bound to it. */
export type RacePlanBattleInput = {
  entryUnitDefId: string;
  entryInstanceId: string;
  nodeIds: string[];
  trackState: TrackState;
};

export type StatKey = keyof BattleStats;
