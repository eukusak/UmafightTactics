/**
 * Everything the offer engine reads about a player, computed once per decision.
 *
 * None of it is recomputed on render or on a battle tick: an offer is built at
 * four moments in a match and nowhere else.
 */
import { getItem } from '../items/item-defs';
import { getUnitDef } from '../roster';
import { activeTraitCounts } from '../ai';
import { starSkillMultiplier } from '../constants';
import type { BattleStats, Cost, EffectKind, Role, RunStyle, Star } from '../types';
import type { MatchState, PlayerState, UnitInstance } from '../state';
import { getRacingProfile } from './profiles';
import type {
  CarryCandidate, EconomyArchetype, ItemProfile, RecentCombatProfile,
} from './types';

export type RacePlanContext = {
  playerId: string;
  level: number;
  gold: number;
  hp: number;
  streak: number;
  lobbyLevelAverage: number;
  boardSize: number;
  meleeRatio: number;
  roleCounts: Record<Role, number>;
  styleCounts: Record<RunStyle, number>;
  distanceCounts: Record<string, number>;
  surfaceCounts: { turf: number; dirt: number };
  activeTraits: Map<string, number>;
  itemProfile: ItemProfile;
  economy: EconomyArchetype;
  carries: CarryCandidate[];
  recentCombat: RecentCombatProfile;
  augments: string[];
};

const ZERO_ITEMS: ItemProfile = {
  ad: 0, ap: 0, attackSpeed: 0, crit: 0, mana: 0,
  tank: 0, sustain: 0, utility: 0, burnWound: 0, penetration: 0,
};

const AXIS_FROM_STAT: Partial<Record<keyof BattleStats, keyof ItemProfile>> = {
  attackDamage: 'ad', abilityPower: 'ap', attackSpeed: 'attackSpeed',
  critChance: 'crit', critMultiplier: 'crit',
  armor: 'tank', magicResist: 'tank', hp: 'tank',
  startMana: 'mana', maxMana: 'mana',
};

const AXIS_FROM_EFFECT: Partial<Record<EffectKind, keyof ItemProfile>> = {
  BURN: 'burnWound', WOUND: 'burnWound',
  SUNDER_ARMOR_PCT: 'penetration', SHRED_MR_PCT: 'penetration',
  OMNIVAMP: 'sustain', HEAL: 'sustain', HEAL_MAXHP_PCT: 'sustain', HEAL_MISSING_PCT: 'sustain',
  SHIELD_MAXHP_PCT: 'tank', SHIELD_FLAT: 'tank', DAMAGE_REDUCTION: 'tank',
  MANA_ADD: 'mana', ON_HIT_MANA: 'mana', MANA_MAX_ADD: 'mana',
  CRIT_CHANCE_ADD: 'crit', CRIT_DAMAGE_ADD: 'crit', SKILLS_CAN_CRIT: 'crit',
  TAUNT: 'utility', APPLY_STATUS: 'utility', CLEANSE: 'utility', MANA_DRAIN: 'utility',
};

/** Item axes, read off the real item definitions rather than a hand-kept table. */
export function buildItemProfile(player: PlayerState): ItemProfile {
  const raw: ItemProfile = { ...ZERO_ITEMS };
  const bump = (axis: keyof ItemProfile, amount: number): void => { raw[axis] += amount; };

  const account = (itemId: string, weight: number): void => {
    const def = getItem(itemId);
    for (const key of Object.keys(def.stats ?? {}) as Array<keyof BattleStats>) {
      const axis = AXIS_FROM_STAT[key];
      if (axis) bump(axis, weight);
    }
    for (const key of Object.keys(def.pctStats ?? {}) as Array<keyof BattleStats>) {
      const axis = AXIS_FROM_STAT[key];
      if (axis) bump(axis, weight);
    }
    for (const effect of def.effects) {
      const axis = AXIS_FROM_EFFECT[effect.kind];
      if (axis) bump(axis, weight);
    }
  };

  for (const unit of player.board) for (const itemId of unit.items) account(itemId, 1);
  for (const unit of player.bench) for (const itemId of unit.items) account(itemId, 0.5);
  for (const stored of player.items) account(stored.itemId, 0.5);

  const out = { ...ZERO_ITEMS };
  for (const key of Object.keys(raw) as Array<keyof ItemProfile>) {
    out[key] = Math.min(1, raw[key] / 3);
  }
  return out;
}

/** Item fit of one unit for one node's axes, 0..1. */
export function unitItemFit(unit: UnitInstance, axes: Array<keyof ItemProfile> | undefined): number {
  if (!axes?.length || !unit.items.length) return 0;
  let hits = 0;
  for (const itemId of unit.items) {
    const def = getItem(itemId);
    const unitAxes = new Set<keyof ItemProfile>();
    for (const key of Object.keys({ ...def.stats, ...def.pctStats }) as Array<keyof BattleStats>) {
      const axis = AXIS_FROM_STAT[key];
      if (axis) unitAxes.add(axis);
    }
    for (const effect of def.effects) {
      const axis = AXIS_FROM_EFFECT[effect.kind];
      if (axis) unitAxes.add(axis);
    }
    if (axes.some((a) => unitAxes.has(a))) hits += 1;
  }
  return Math.min(1, hits / Math.max(1, axes.length));
}

const STAR_NORM: Record<Star, number> = { 1: 0.25, 2: 0.6, 3: 1 };

/**
 * How much this unit looks like the board's carry.
 *
 * Cost is one input among eight on purpose. The balance simulator finishes
 * ~0.00 four- and five-cost three-stars per match, so a finished reroll board
 * has to be able to out-score a two-star legendary here, and it does: nine
 * copies pay through StarNorm plus the items that were funnelled into them.
 */
export function carryScore(
  player: PlayerState, unit: UnitInstance, activeTraits: Map<string, number>,
): number {
  const def = getUnitDef(unit.unitDefId);
  const onBench = player.bench.includes(unit);
  const traitSupport = Math.min(1, def.traits.filter((t) => (activeTraits.get(t) ?? 0) > 0).length / 3);
  const profile = getRacingProfile(def.id);
  const confidence = profile
    ? { HIGH: 1, MEDIUM: 0.6, LOW: 0.3, VERY_LOW: 0.1 }[profile.confidence]
    : 0.1;

  const score =
    0.22 * (def.cost / 5) +
    0.16 * STAR_NORM[unit.star] +
    0.2 * Math.min(1, unit.items.length / 3) +
    0.12 * traitSupport +
    0.1 * Math.min(1, unit.items.filter((i: string) => !getItem(i).isComponent).length / 3) +
    0.08 * Math.min(1, starSkillMultiplier(unit.star, def.cost) / 6) +
    0.07 * (def.role === 'AD_CARRY' || def.role === 'AP_CARRY' ? 1 : def.role === 'BRUISER' ? 0.6 : 0.25) +
    0.05 * confidence;

  return score * (onBench ? 0.9 : 1);
}

export function buildCarryCandidates(
  player: PlayerState, activeTraits: Map<string, number>,
): CarryCandidate[] {
  const all = [
    ...player.board.map((u) => ({ u, bench: false })),
    ...player.bench.map((u) => ({ u, bench: true })),
  ];
  return all
    .map(({ u, bench }) => {
      const def = getUnitDef(u.unitDefId);
      return {
        instanceId: u.instanceId,
        unitDefId: u.unitDefId,
        cost: def.cost as Cost,
        star: u.star,
        role: def.role,
        attackRange: def.attackRange,
        onBench: bench,
        items: [...u.items],
        score: carryScore(player, u, activeTraits),
      };
    })
    .sort((a, b) => b.score - a.score || a.instanceId.localeCompare(b.instanceId));
}

/**
 * Economy shape. Never a single condition, and never a power multiplier — it
 * only changes which *kinds* of plan show up, so a rich player does not get a
 * stronger card than a broke one.
 */
export function economyArchetype(player: PlayerState, lobbyLevelAverage: number): EconomyArchetype {
  const pairs = new Map<string, number>();
  for (const u of [...player.board, ...player.bench]) {
    pairs.set(u.unitDefId, (pairs.get(u.unitDefId) ?? 0) + 1);
  }
  const pairCount = [...pairs.values()].filter((n) => n >= 2).length;
  const threeStars = [...player.board, ...player.bench].filter((u) => u.star === 3).length;
  const highCostOnBench = player.bench.some((u) => getUnitDef(u.unitDefId).cost >= 4);
  const boardStars = player.board.length
    ? player.board.reduce((n, u) => n + u.star, 0) / player.board.length
    : 0;

  const scores: Record<EconomyArchetype, number> = {
    REROLL: (player.level <= lobbyLevelAverage - 1 ? 3 : 0) + (pairCount >= 3 ? 3 : 0) +
      (threeStars >= 1 ? 2 : 0) + (player.gold < 20 ? 1 : 0),
    FAST_8: (player.gold >= 40 ? 3 : 0) + (player.level >= lobbyLevelAverage ? 2 : 0) +
      (threeStars === 0 ? 2 : 0) + (highCostOnBench ? 2 : 0),
    FAST_9: (player.gold >= 40 ? 3 : 0) + (player.level >= 8 ? 3 : 0) + (threeStars === 0 ? 2 : 0),
    TEMPO: (player.streak >= 3 ? 3 : 0) + (player.gold < 15 ? 2 : 0) + (boardStars >= 2 ? 2 : 0),
    RECOVERY: (player.hp <= 35 ? 4 : 0) + (player.streak <= -3 ? 2 : 0),
    FLEX: 0,
  };
  let best: EconomyArchetype = 'FLEX';
  let bestScore = 4;
  for (const key of Object.keys(scores) as EconomyArchetype[]) {
    if (scores[key] > bestScore) { best = key; bestScore = scores[key]; }
  }
  return best;
}

export function buildRacePlanContext(state: MatchState, player: PlayerState): RacePlanContext {
  const living = state.players.filter((p) => p.eliminatedAtRound === null);
  const lobbyLevelAverage = living.length
    ? living.reduce((n, p) => n + p.level, 0) / living.length
    : player.level;

  const activeTraits = activeTraitCounts(player, player.board);
  const roleCounts = { TANK: 0, BRUISER: 0, AD_CARRY: 0, AP_CARRY: 0, SUPPORT: 0 } as Record<Role, number>;
  const styleCounts = { nige: 0, senko: 0, sashi: 0, oikomi: 0 } as Record<RunStyle, number>;
  const distanceCounts: Record<string, number> = { sprinter: 0, miler: 0, middle: 0, stayer: 0 };
  const surfaceCounts = { turf: 0, dirt: 0 };
  let melee = 0;

  for (const unit of player.board) {
    const def = getUnitDef(unit.unitDefId);
    roleCounts[def.role] += 1;
    if (def.attackRange <= 1) melee += 1;
    styleCounts[def.source.primaryStyle] += 1;
    distanceCounts[def.source.bestDistance] = (distanceCounts[def.source.bestDistance] ?? 0) + 1;
    const profile = getRacingProfile(def.id);
    if (profile) {
      if (profile.surfacePct.dirt >= 0.75) surfaceCounts.dirt += 1;
      if (profile.surfacePct.turf >= 0.75) surfaceCounts.turf += 1;
    }
  }

  return {
    playerId: player.id,
    level: player.level,
    gold: player.gold,
    hp: player.hp,
    streak: player.streak,
    lobbyLevelAverage,
    boardSize: player.board.length,
    meleeRatio: player.board.length ? melee / player.board.length : 0.5,
    roleCounts,
    styleCounts,
    distanceCounts,
    surfaceCounts,
    activeTraits,
    itemProfile: buildItemProfile(player),
    economy: economyArchetype(player, lobbyLevelAverage),
    carries: buildCarryCandidates(player, activeTraits),
    recentCombat: player.racePlan?.recentCombat ?? {
      sampleCount: 0, avgDuration: 0, avgEndProgress: 0, overtimeRate: 0,
      carryDamageShare: 0, frontlineLossBeforeMid: 0, castsPerCombat: 0, enemyFrontlineHpAtLate: 0,
    },
    augments: player.augments,
  };
}
