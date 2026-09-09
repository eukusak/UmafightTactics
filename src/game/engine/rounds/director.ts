/**
 * The single owner of match state transitions (spec §32).
 *
 * Everything that advances a match goes through RoundDirector, so the UI, the
 * AI and the headless simulator all drive an identical, deterministic match.
 */
import {
  PLAYER_COUNT, STARTING_GOLD, STARTING_HP, baseStageDamage, survivorDamage,
} from '../constants';
import { Rng, RngRegistry } from '../rng';
import { ROSTER_HASH, getUnitDef, getSeason, getSeasonUnitTraits } from '../roster';
import { createPool, returnInstance } from '../pool';
import { emptyShop, rollShop, applyCombines, teamSizeLimit } from '../shop';
import { grantRoundXp, resetRoundEconomy, roundIncome, reducePlayerDamage } from '../economy';
import { addItemToStorage, resolveTrickGloves } from '../items/inventory';
import { runAiPrep, ensureInitialBoard, finalizeAiFormation } from '../ai';
import { AI_PROFILE_IDS } from '../ai/profiles';
import { BattleEngine, simulateBattle, type BattleFrame, type BattleSideInput } from '../battle/engine';
import { PVE_UNIT_IDS } from '../battle/pve-units';
import { applyAugment, createAugmentOffers } from '../augments/offers';
import type {
  BattleOutcome, MatchState, PlayerState, RoundResolution, UnitInstance,
} from '../state';
import { getPlayer, isAlive, livingPlayers } from '../state';
import { PVE_ENEMIES, pveEnemyFor, pveScale, rollPveLoot } from './pve';
import { createDraft, draftComplete, pickDraftOption, currentPickers } from './draft';
import { makePairings, recordOpponent } from './matchmaking';
import {
  absoluteRound, hasAugmentBefore, hasStartSelection, nextRound, roundInfo, roundsInStage,
} from './schedule';

export type CreateMatchOptions = {
  seasonId?: import('../seasons/catalog').SeasonId;
  seed: number;
  humanName?: string;
  /** Skips the human seat; used by the headless balance simulator. */
  allAi?: boolean;
};

export function createMatch(options: CreateMatchOptions): MatchState {
  const seasonId = getSeason(options.seasonId).id;
  const rng = Rng.forStream(options.seed, 'match');
  const profiles = rng.shuffle(AI_PROFILE_IDS);

  const players: PlayerState[] = [];
  for (let i = 0; i < PLAYER_COUNT; i += 1) {
    const isHuman = !options.allAi && i === 0;
    players.push({
      seasonId,
      id: `p${i + 1}`,
      name: isHuman ? (options.humanName ?? '트레이너') : `AI ${i}`,
      isHuman,
      hp: STARTING_HP,
      gold: STARTING_GOLD,
      level: 1,
      xp: 0,
      streak: 0,
      board: [],
      bench: [],
      items: [],
      tacticianItems: [],
      augments: [],
      shop: emptyShop(),
      shopLocked: false,
      freeRerolls: 0,
      cheapRerollsUsed: 0,
      eliminatedAtRound: null,
      placement: null,
      // 7 AI seats take the 7 distinct profiles. The all-AI simulator has 8
      // seats, so one profile is deliberately used twice.
      aiProfile: isHuman ? null : profiles[(options.allAi ? i : i - 1) % AI_PROFILE_IDS.length],
      recentOpponents: [],
      hpChangedAtRound: 0,
      pendingGrants: [],
      bonusTraits: [],
    });
  }

  return {
    version: 1,
    seasonId,
    seed: options.seed,
    rngStates: {},
    phase: 'ROUND_PREP',
    stage: 1,
    round: 1,
    players,
    pool: createPool(seasonId),
    activeRosterHash: ROSTER_HASH,
    instanceCounter: 0,
    augmentOffers: [],
    draft: null,
    lastResolution: null,
    history: [],
    finalStandings: null,
  };
}

export type PendingSettlement = {
  resolution: RoundResolution;
  afterStreaks: Record<string, number>;
  pvpWinners: string[];
  isPve: boolean;
};

export class RoundDirector {
  readonly rngs: RngRegistry;
  /**
   * Frames of the human player's own fight from the most recent resolveRound.
   *
   * They are recorded during the real resolution rather than replayed from a
   * separate preview run: a preview would consume a different RNG stream and
   * could show the player an outcome that disagrees with the actual result.
   */
  lastHumanFrames: BattleFrame[] | null = null;
  readonly playerFrames = new Map<string, BattleFrame[]>();
  /** Whether the human's fight was against PvE, for the battle banner. */
  lastHumanBattleWasPve = false;
  private pendingSettlement: PendingSettlement | null = null;

  get hasPendingSettlement(): boolean { return this.pendingSettlement !== null; }

  /** Internal persistence data; never include this in a client state. */
  exportPendingSettlement(): PendingSettlement | null {
    return structuredClone(this.pendingSettlement);
  }

  restorePendingSettlement(pending: PendingSettlement | null): void {
    if ((this.state.phase === 'BATTLE') !== (pending !== null)) {
      throw new Error('Battle settlement does not match saved phase');
    }
    this.pendingSettlement = structuredClone(pending);
  }

  constructor(readonly state: MatchState) {
    this.rngs = new RngRegistry(state.seed);
    if (Object.keys(state.rngStates).length) this.rngs.restore(state.rngStates);
  }

  /** Persists live RNG states back onto the match so a save replays exactly. */
  syncRng(): void {
    this.state.rngStates = this.rngs.serialize();
  }

  get info() {
    return roundInfo(this.state.stage, this.state.round);
  }

  // ------------------------------------------------------------------- prep
  /** Opens a round: refresh shops, hand out XP, offer augments or a draft. */
  beginPrep(): void {
    const s = this.state;
    s.phase = 'ROUND_PREP';
    const roundKey = absoluteRound(s.stage, s.round);

    for (const p of s.players) {
      if (!isAlive(p)) continue;
      resetRoundEconomy(p);
      if (!p.shopLocked) {
        p.shop = rollShop(p, s.pool, this.rngs.get('shop'));
      } else {
        p.shopLocked = false;
      }
      applyCombines(s, p);
    }

    if (hasAugmentBefore(s.stage, s.round)) {
      s.augmentOffers = createAugmentOffers(s, this.rngs.get('augment'));
      s.phase = 'AUGMENT_SELECT';
      this.resolveAiAugments();
    }

    // 1-1 opens with the Twinkle Start selection; later x-4 rounds are drafts.
    const startSelection = hasStartSelection(s.stage, s.round);
    if (startSelection || this.info.kind === 'DRAFT') {
      const isFirst = startSelection || !s.history.some((h) => h.kind === 'DRAFT');
      s.draft = createDraft(s, this.rngs.get('draft'), isFirst, startSelection);
      s.phase = 'DRAFT';
      this.resolveAiDraftPicks();
    }

    // The AI plans its board once the round's special phase is settled.
    for (const p of s.players) {
      if (!isAlive(p) || p.aiProfile === null) continue;
      if (roundKey === 1) ensureInitialBoard(s, p, this.rngs.get(`ai-${p.id}`));
      runAiPrep(s, p, this.rngs.get(`ai-${p.id}`));
    }
    this.syncRng();
  }

  private resolveAiAugments(): void {
    const rng = this.rngs.get('augment');
    for (const offer of this.state.augmentOffers) {
      const player = getPlayer(this.state, offer.playerId);
      if (player.aiProfile === null) continue;
      // The AI takes the first option that is not purely a shop-odds tweak.
      const choice = offer.options[rng.int(0, offer.options.length)];
      offer.chosen = choice;
      applyAugment(this.state, player, choice, rng);
    }
    if (this.state.augmentOffers.every((o) => o.chosen !== null)) {
      this.state.augmentOffers = [];
      this.state.phase = 'ROUND_PREP';
    }
  }

  /** Human augment pick; returns false when the id was not on offer. */
  chooseAugment(playerId: string, augmentId: string): boolean {
    const offer = this.state.augmentOffers.find((o) => o.playerId === playerId);
    if (!offer || offer.chosen !== null || !offer.options.includes(augmentId)) return false;
    offer.chosen = augmentId;
    applyAugment(this.state, getPlayer(this.state, playerId), augmentId, this.rngs.get('augment'));
    if (this.state.augmentOffers.every((o) => o.chosen !== null)) {
      this.state.augmentOffers = [];
      this.state.phase = this.state.draft ? 'DRAFT' : 'ROUND_PREP';
    }
    this.syncRng();
    return true;
  }

  private resolveAiDraftPicks(): void {
    const s = this.state;
    const rng = this.rngs.get('draft');
    for (let guard = 0; guard < 32; guard += 1) {
      if (!s.draft || draftComplete(s.draft)) break;
      const pickers = currentPickers(s.draft);
      const next = pickers[0];
      if (!next) break;
      const player = getPlayer(s, next);
      if (player.aiProfile === null) break; // wait for the human
      const available = s.draft.options.filter((o) => !o.takenBy);
      if (!available.length) break;
      // Prefer the highest-value unit the AI can still use.
      const best = available
        .slice()
        .sort((a, b) => {
          const va = getUnitDef(a.unitDefId).uftRating + getUnitDef(a.unitDefId).cost * 0.1;
          const vb = getUnitDef(b.unitDefId).uftRating + getUnitDef(b.unitDefId).cost * 0.1;
          return vb - va || a.index - b.index;
        })[0];
      pickDraftOption(s, player, best.index);
      void rng;
    }
    if (s.draft && draftComplete(s.draft)) {
      s.draft = null;
      s.phase = 'ROUND_PREP';
    }
  }

  /** Human draft pick, then let the AI continue behind them. */
  pickDraft(playerId: string, optionIndex: number): boolean {
    const s = this.state;
    if (!s.draft) return false;
    const result = pickDraftOption(s, getPlayer(s, playerId), optionIndex);
    if (!result.ok) return false;
    this.resolveAiDraftPicks();
    if (!s.draft) for (const player of livingPlayers(s)) finalizeAiFormation(player);
    this.syncRng();
    return true;
  }

  // ----------------------------------------------------------------- battle
  /** Resolves the whole round: fights, damage, elimination, income. */
  resolveRound(deferSettlement = false): RoundResolution {
    if (this.pendingSettlement) throw new Error('The previous battle has not settled');
    const s = this.state;
    s.phase = 'BATTLE';
    this.lastHumanFrames = null;
    this.playerFrames.clear();
    this.lastHumanBattleWasPve = false;

    for (const p of s.players) {
      if (!isAlive(p)) continue;
      resolveTrickGloves(p, this.rngs.get(`ai-${p.id}`));
      this.trimBoard(p);
    }

    const kind = this.info.kind === 'DRAFT' ? 'PVP' : this.info.kind;
    const outcomes: BattleOutcome[] = [];
    const damage: Record<string, number> = {};
    const pvpWinners = new Set<string>();

    const beforeStreaks = new Map(s.players.map((p) => [p.id, p.streak]));
    if (kind === 'PVE') {
      this.resolvePve(outcomes, damage);
    } else {
      this.resolvePvp(outcomes, damage, pvpWinners);
    }

    const afterStreaks = new Map(s.players.map((p) => [p.id, p.streak]));
    for (const p of s.players) p.streak = beforeStreaks.get(p.id)!;
    const resolution: RoundResolution = {
      stage: s.stage, round: s.round, kind: this.info.kind, outcomes, damage, eliminated: [],
    };
    this.pendingSettlement = {
      resolution, afterStreaks: Object.fromEntries(afterStreaks),
      pvpWinners: [...pvpWinners], isPve: kind === 'PVE',
    };
    this.syncRng();
    return deferSettlement ? resolution : this.settleRound()!;
  }

  /** Commit rewards and standings once, including after a server restart. */
  settleRound(): RoundResolution | null {
    const pending = this.pendingSettlement;
    if (!pending) return this.state.lastResolution;
    this.pendingSettlement = null;
    const s = this.state;
    const { resolution, afterStreaks, pvpWinners, isPve } = pending;
    const { outcomes, damage } = resolution;
    for (const p of s.players) p.streak = afterStreaks[p.id];
    if (isPve) this.grantPveRewards(outcomes);
    // Damage, loot, income and eliminations become visible together at END.
    const roundKey = absoluteRound(s.stage, s.round);
    for (const p of s.players) {
      if (!isAlive(p)) continue;
      const dmg = damage[p.id] ?? 0;
      if (dmg > 0) {
        p.hp = Math.max(0, p.hp - dmg);
        p.hpChangedAtRound = roundKey;
      }
    }

    // Eliminations, lowest HP resolved last so placements are stable.
    s.phase = 'ELIMINATION';
    const eliminated: string[] = [];
    // Not-yet-eliminated players whose HP has just run out. `isAlive` already
    // requires hp > 0, so it must not be part of this filter.
    const dying = s.players.filter((p) => p.eliminatedAtRound === null && p.hp <= 0);
    // Lowest HP is eliminated "first" and so takes the worst remaining place.
    dying.sort((a, b) => a.hp - b.hp || a.id.localeCompare(b.id));
    const stillInMatch = s.players.filter((p) => p.eliminatedAtRound === null).length;
    dying.forEach((p, i) => {
      p.eliminatedAtRound = roundKey;
      p.placement = stillInMatch - i;
      eliminated.push(p.id);
      // Spec §17.3 — everything they hold goes straight back to the pool.
      for (const u of [...p.board, ...p.bench]) returnInstance(s.pool, u);
      p.board = [];
      p.bench = [];
    });

    // Income for everyone still standing.
    for (const p of livingPlayers(s)) {
      p.gold += roundIncome(p, s.stage, s.round, pvpWinners.includes(p.id));
      grantRoundXp(p);
    }

    resolution.eliminated = eliminated;
    s.lastResolution = resolution;
    s.history.push(resolution);
    s.phase = 'ROUND_RESOLVE';
    this.syncRng();
    return resolution;
  }

  /** Drops board units beyond the team size limit back onto the bench. */
  private trimBoard(player: PlayerState): void {
    const limit = teamSizeLimit(player);
    if (player.board.length <= limit) return;
    const ordered = player.board.slice().sort((a, b) => {
      const va = getUnitDef(a.unitDefId).uftRating + (a.star - 1) * 0.9;
      const vb = getUnitDef(b.unitDefId).uftRating + (b.star - 1) * 0.9;
      return vb - va || a.instanceId.localeCompare(b.instanceId);
    });
    player.board = ordered.slice(0, limit);
    for (const u of ordered.slice(limit)) {
      u.position = null;
      player.bench.push(u);
    }
  }

  /**
   * Runs one battle. When `record` is set the frames are kept for playback, so
   * what the player watches is the very run that produced the result.
   */
  private runBattle(a: BattleSideInput, b: BattleSideInput, rng: Rng, record: boolean, isGhost = false) {
    if (!record) return simulateBattle(a, b, rng, { stage: this.state.stage });
    const engine = new BattleEngine(a, b, rng, { recordFrames: true, stage: this.state.stage });
    const result = engine.run();
    this.lastHumanFrames = engine.frames;
    if (this.state.players.some((p) => p.id === a.playerId && p.isHuman)) this.playerFrames.set(a.playerId, engine.frames);
    if (!isGhost && this.state.players.some((p) => p.id === b.playerId && p.isHuman)) this.playerFrames.set(b.playerId, engine.frames);
    return result;
  }

  private sideFor(player: PlayerState): BattleSideInput {
    return {
      playerId: player.id,
      augments: player.augments,
      tacticianItems: player.tacticianItems,
      units: player.board
        .filter((u) => u.position !== null)
        .map((u) => ({
          instanceId: u.instanceId,
          unitDefId: u.unitDefId,
          star: u.star,
          items: u.items,
          position: u.position!,
          extraTraits: [...getSeasonUnitTraits(u.unitDefId, this.state.seasonId), ...player.bonusTraits
            .filter((b) => b.instanceId === u.instanceId)
            .map((b) => b.trait)],
        })),
    };
  }

  private pveSide(): BattleSideInput {
    const s = this.state;
    const enemyId = pveEnemyFor(s.stage, s.round);
    const def = PVE_ENEMIES[enemyId];
    const scale = pveScale(s.stage);
    return {
      playerId: `pve:${enemyId}`,
      augments: [],
      tacticianItems: [],
      units: def.positions.slice(0, def.count).map((position, i) => ({
        instanceId: `pve${i}`,
        unitDefId: PVE_UNIT_IDS[enemyId],
        star: 1 as const,
        items: [],
        position,
        statScale: scale,
      })),
    };
  }

  private resolvePve(outcomes: BattleOutcome[], damage: Record<string, number>): void {
    const s = this.state;
    const enemy = this.pveSide();
    for (const p of livingPlayers(s)) {
      const rng = this.rngs.get(`battle-pair-${absoluteRound(s.stage, s.round)}-${p.id}`);
      const result = this.runBattle(this.sideFor(p), enemy, rng, p.isHuman);
      if (p.isHuman) this.lastHumanBattleWasPve = true;
      const won = result.winner === 'A';
      outcomes.push({
        attackerId: p.id, defenderId: enemy.playerId,
        winnerId: won ? p.id : result.winner === 'B' ? enemy.playerId : null,
        survivorsWinner: won ? result.survivorsA : result.survivorsB,
        survivorsLoser: won ? result.survivorsB : result.survivorsA,
        durationSeconds: result.durationSeconds,
        wentToOvertime: result.wentToOvertime,
        isGhost: false,
      });
      // Spec §21 — losing PvE costs no player HP, only a reward tier.
      damage[p.id] = 0;
    }
  }

  private grantPveRewards(outcomes: BattleOutcome[]): void {
    const s = this.state;
    for (const outcome of outcomes) {
      const p = getPlayer(s, outcome.attackerId);
      const won = outcome.winnerId === p.id;
      const loot = rollPveLoot(this.rngs.get('loot'), s.stage, won);
      p.gold += loot.gold;
      for (const c of loot.components) addItemToStorage(s, p, c);
      for (let i = 0; i < loot.completedAnvil; i += 1) {
        p.pendingGrants.push({ kind: 'COMPLETED_CHOICE', count: 1 });
      }
      for (let i = 0; i < loot.cloneToken; i += 1) {
        p.pendingGrants.push({ kind: 'CLONE', maxCost: 3, count: 1 });
      }
    }
  }

  private resolvePvp(
    outcomes: BattleOutcome[], damage: Record<string, number>, winners: Set<string>,
  ): void {
    const s = this.state;
    const pairings = makePairings(s, this.rngs.get('matchmaking'));
    const roundKey = absoluteRound(s.stage, s.round);

    for (const pair of pairings) {
      const attacker = getPlayer(s, pair.attackerId);
      const defender = getPlayer(s, pair.defenderId);
      const rng = this.rngs.get(`battle-pair-${roundKey}-${pair.attackerId}-${pair.defenderId}`);
      const humanInvolved = attacker.isHuman || (!pair.isGhost && defender.isHuman);
      const result = this.runBattle(
        this.sideFor(attacker), this.sideFor(defender), rng, humanInvolved, pair.isGhost,
      );

      recordOpponent(attacker, defender.id);
      if (!pair.isGhost) recordOpponent(defender, attacker.id);

      const winnerId = result.winner === 'A' ? attacker.id : result.winner === 'B' ? defender.id : null;
      outcomes.push({
        attackerId: attacker.id, defenderId: defender.id, winnerId,
        survivorsWinner: result.winner === 'A' ? result.survivorsA : result.survivorsB,
        survivorsLoser: result.winner === 'A' ? result.survivorsB : result.survivorsA,
        durationSeconds: result.durationSeconds,
        wentToOvertime: result.wentToOvertime,
        isGhost: pair.isGhost,
      });

      const base = baseStageDamage(s.stage);
      if (winnerId === null) {
        // Spec §15 — a draw damages both for 1 + the opponent's survivors.
        const dmgA = reducePlayerDamage(attacker, 1 + survivorDamage(result.survivorsB));
        damage[attacker.id] = (damage[attacker.id] ?? 0) + dmgA;
        attacker.streak = 0;
        if (!pair.isGhost) {
          const dmgB = reducePlayerDamage(defender, 1 + survivorDamage(result.survivorsA));
          damage[defender.id] = (damage[defender.id] ?? 0) + dmgB;
          defender.streak = 0;
        }
      } else if (winnerId === attacker.id) {
        winners.add(attacker.id);
        attacker.streak = attacker.streak >= 0 ? attacker.streak + 1 : 1;
        // Spec §22 — beating a ghost costs the original player nothing.
        if (!pair.isGhost) {
          damage[defender.id] = (damage[defender.id] ?? 0)
            + reducePlayerDamage(defender, base + survivorDamage(result.survivorsA));
          defender.streak = defender.streak <= 0 ? defender.streak - 1 : -1;
        }
      } else {
        if (!pair.isGhost) {
          winners.add(defender.id);
          defender.streak = defender.streak >= 0 ? defender.streak + 1 : 1;
        }
        // Losing to a ghost still hurts.
        damage[attacker.id] = (damage[attacker.id] ?? 0)
          + reducePlayerDamage(attacker, base + survivorDamage(result.survivorsB));
        attacker.streak = attacker.streak <= 0 ? attacker.streak - 1 : -1;
      }
    }
  }

  // ------------------------------------------------------------------ flow
  /** Advances to the next round, or ends the match. */
  advance(): void {
    if (this.pendingSettlement) throw new Error('Cannot advance during battle');
    const s = this.state;
    const living = livingPlayers(s);
    if (living.length <= 1) {
      this.finish();
      return;
    }
    const next = nextRound(s.stage, s.round);
    s.stage = next.stage;
    s.round = next.round;
    this.beginPrep();
  }

  private finish(): void {
    const s = this.state;
    // Whoever is still standing takes the best remaining places.
    const living = livingPlayers(s).sort((a, b) => b.hp - a.hp || a.id.localeCompare(b.id));
    living.forEach((p, i) => { p.placement = i + 1; });
    // Anyone still standing shares first place; eliminated players keep theirs.
    s.finalStandings = s.players
      .slice()
      .sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99) || b.hp - a.hp || a.id.localeCompare(b.id))
      .map((p) => p.id);
    s.phase = 'GAME_OVER';
    this.syncRng();
  }

  get isOver(): boolean {
    return this.state.phase === 'GAME_OVER';
  }

  /** Runs a complete match headlessly; used by tests and the balance simulator. */
  runToCompletion(maxRounds = 120, beginPrep = true): void {
    if (beginPrep) this.beginPrep();
    for (let i = 0; i < maxRounds && !this.isOver; i += 1) {
      this.resolveRound();
      this.advance();
    }
    if (!this.isOver) this.finish();
  }
}

/** Total copies a player currently holds, for the pool conservation test. */
export function heldUnits(state: MatchState): UnitInstance[] {
  return state.players.flatMap((p) => [...p.board, ...p.bench]);
}

export { roundsInStage };
