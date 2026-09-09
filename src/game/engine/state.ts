/** The serialisable match state. Every system is a pure function over this. */
import type { AugmentGrade, Cost, Role, Star, TraitId } from './types';

export type MatchPhase =
  | 'BOOT' | 'LOBBY' | 'ROUND_PREP' | 'AUGMENT_SELECT' | 'DRAFT' | 'BATTLE'
  | 'ROUND_RESOLVE' | 'ELIMINATION' | 'GAME_OVER';

export type RoundKind = 'PVE' | 'PVP' | 'DRAFT';

export type HexPos = { q: number; r: number };

export type UnitInstance = {
  instanceId: string;
  unitDefId: string;
  star: Star;
  sourceCopies: 1 | 3 | 9;
  items: string[];
  position: HexPos | null;
};

export type ItemInstance = { instanceId: string; itemId: string };

export type ShopSlot = { unitDefId: string | null; sold: boolean };

export type AiProfileId =
  | 'BALANCED' | 'REROLL' | 'FAST_LEVEL' | 'ECONOMY' | 'AD_FOCUS' | 'AP_FOCUS' | 'TRAIT_FOCUS';

export type PlayerState = {
  seasonId?: import('./seasons/catalog').SeasonId;
  id: string;
  name: string;
  isHuman: boolean;
  hp: number;
  gold: number;
  level: number;
  xp: number;
  /** Positive on a win streak, negative on a loss streak. */
  streak: number;
  board: UnitInstance[];
  bench: UnitInstance[];
  items: ItemInstance[];
  /** Tactician items (crown/cloak/shield) held outside unit item slots. */
  tacticianItems: string[];
  augments: string[];
  shop: ShopSlot[];
  shopLocked: boolean;
  /** Free rerolls remaining this round, from augments. */
  freeRerolls: number;
  cheapRerollsUsed: number;
  eliminatedAtRound: number | null;
  placement: number | null;
  aiProfile: AiProfileId | null;
  /** Opponents faced most recently, newest first; used to avoid instant rematches. */
  recentOpponents: string[];
  /** Round index at which this player's hp last changed, for draft tie-breaks. */
  hpChangedAtRound: number;
  /** Pending one-shot grants from augments the player has not yet consumed. */
  pendingGrants: PendingGrant[];
  /** Secondary trait handed out by the 이중 적성 augment. */
  bonusTraits: Array<{ instanceId: string; trait: TraitId }>;
};

export type PendingGrant =
  | { kind: 'COMPONENT_CHOICE'; count: number }
  | { kind: 'COMPLETED_CHOICE'; count: number }
  | { kind: 'RADIANT_CHOICE'; count: number }
  | { kind: 'EMBLEM_CHOICE'; count: number }
  | { kind: 'REMOVER'; count: number }
  | { kind: 'REFORGER'; count: number }
  | { kind: 'CLONE'; maxCost: Cost; count: number }
  | { kind: 'SECONDARY_TRAIT'; count: number };

export type PoolState = {
  seasonId?: import('./seasons/catalog').SeasonId;
  /** Remaining copies keyed by unit def id. */
  remaining: Record<string, number>;
};

export type AugmentOffer = {
  playerId: string;
  grade: AugmentGrade;
  options: string[];
  chosen: string | null;
};

export type DraftOption = {
  index: number;
  unitDefId: string;
  itemId: string;
  takenBy: string | null;
};

export type DraftState = {
  options: DraftOption[];
  /** Player ids in pick order. */
  order: string[];
  cursor: number;
};

export type BattleOutcome = {
  attackerId: string;
  defenderId: string;
  /** null on a draw. */
  winnerId: string | null;
  survivorsWinner: number;
  survivorsLoser: number;
  durationSeconds: number;
  wentToOvertime: boolean;
  isGhost: boolean;
};

export type RoundResolution = {
  stage: number;
  round: number;
  kind: RoundKind;
  outcomes: BattleOutcome[];
  damage: Record<string, number>;
  eliminated: string[];
};

export type MatchState = {
  seasonId: import('./seasons/catalog').SeasonId;
  version: 1;
  seed: number;
  rngStates: Record<string, number>;
  phase: MatchPhase;
  stage: number;
  round: number;
  players: PlayerState[];
  pool: PoolState;
  activeRosterHash: string;
  /** Deterministic counter so every created instance gets a stable unique id. */
  instanceCounter: number;
  augmentOffers: AugmentOffer[];
  draft: DraftState | null;
  lastResolution: RoundResolution | null;
  history: RoundResolution[];
  /** Set once the match ends: player ids ordered 1st..8th. */
  finalStandings: string[] | null;
};

export const isAlive = (p: PlayerState): boolean => p.hp > 0 && p.eliminatedAtRound === null;

export function livingPlayers(state: MatchState): PlayerState[] {
  return state.players.filter(isAlive);
}

export function getPlayer(state: MatchState, id: string): PlayerState {
  const p = state.players.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown player: ${id}`);
  return p;
}

/** Roles are only needed for AI heuristics and UI grouping. */
export const ROLE_ORDER: Role[] = ['TANK', 'BRUISER', 'AD_CARRY', 'AP_CARRY', 'SUPPORT'];
