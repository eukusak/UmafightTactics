/**
 * AI turn logic (spec §26).
 *
 * The AI only reads information a human player can see: its own shop, bench,
 * board and items, plus other players' visible boards. It never inspects the
 * remaining pool counts or any RNG state.
 */
import { MAX_LEVEL } from '../constants';
import { addXp, buyXp, payReroll, rerollCost } from '../economy';
import { getItem, COMPONENT_IDS } from '../items/item-defs';
import { canEquip, equipItem, equipTactician } from '../items/inventory';
import { getUnitDef } from '../roster';
import { activeTierIndex, getTrait } from '../traits/trait-defs';
import { benchCapacity, buyUnit, rollShop, sellUnit, teamSizeLimit } from '../shop';
import type { Rng } from '../rng';
import type { Role, TraitId } from '../types';
import type { MatchState, PlayerState, UnitInstance } from '../state';
import { AI_PROFILES } from './profiles';
import { applyPlacement, chooseFieldedUnits, planPlacement } from './placement';

/** Distinct-unit trait counts for the units the player would actually field. */
export function activeTraitCounts(player: PlayerState): Map<TraitId, number> {
  const counts = new Map<TraitId, number>();
  const seenByTrait = new Map<TraitId, Set<string>>();
  const fielded = chooseFieldedUnits(player);
  for (const u of fielded) {
    const def = getUnitDef(u.unitDefId);
    const traits = [...def.traits];
    for (const itemId of u.items) {
      const granted = getItem(itemId).grantsTrait;
      if (granted && !traits.includes(granted)) traits.push(granted);
    }
    for (const t of traits) {
      const seen = seenByTrait.get(t) ?? new Set<string>();
      if (seen.has(u.unitDefId)) continue;
      seen.add(u.unitDefId);
      seenByTrait.set(t, seen);
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return counts;
}

/** Sum of reached trait tiers — the AI's proxy for "how much synergy do I have". */
export function synergyScore(counts: Map<TraitId, number>): number {
  let score = 0;
  for (const [id, n] of counts) {
    const tier = activeTierIndex(getTrait(id), n);
    if (tier >= 0) score += (tier + 1) * 2 + n * 0.25;
  }
  return score;
}

function copiesOf(player: PlayerState, unitDefId: string, star: 1 | 2 | 3): number {
  return [...player.board, ...player.bench].filter(
    (u) => u.unitDefId === unitDefId && u.star === star,
  ).length;
}

/** Spec §26.3 buy score. */
export function buyScore(player: PlayerState, unitDefId: string): number {
  const profile = AI_PROFILES[player.aiProfile ?? 'BALANCED'];
  const def = getUnitDef(unitDefId);

  const ones = copiesOf(player, unitDefId, 1);
  const twos = copiesOf(player, unitDefId, 2);
  const threes = copiesOf(player, unitDefId, 3);

  // Closing out a star upgrade is worth far more than a raw stat gain. Value is
  // driven by total copies held, not by the 1-star count alone: three 1-stars
  // combine into a 2-star, leaving ones === 0, and scoring off `ones` there
  // would make the AI abandon a unit exactly halfway to a 3-star.
  const copies = ones + twos * 3 + threes * 9;
  const pairNeed = copies === 1 ? 1 : 0;
  let upgradeNeed = 0;
  if (threes === 0) {
    if (copies === 2) upgradeNeed = 1.0;          // one copy from a 2-star
    else if (copies >= 3 && copies <= 5) upgradeNeed = 1.4;  // 3-star chain started
    else if (copies === 6 || copies === 7) upgradeNeed = 2.2;
    else if (copies === 8) upgradeNeed = 3.5;     // one copy from a 3-star
  }

  const counts = activeTraitCounts(player);
  let traitFit = 0;
  for (const t of def.traits) {
    const trait = getTrait(t);
    const have = counts.get(t) ?? 0;
    const currentTier = activeTierIndex(trait, have);
    const nextTier = activeTierIndex(trait, have + 1);
    if (nextTier > currentTier) traitFit += 1.5;
    else {
      const nextThreshold = trait.thresholds.find((v) => v > have);
      if (nextThreshold !== undefined) traitFit += 0.4 / Math.max(1, nextThreshold - have);
    }
  }
  traitFit *= profile.traitBias;

  const roleFit = (profile.roleBias[def.role] ?? 0) + roleNeed(player, def.role);

  // Spare items the AI can already use raise the value of a new carry body.
  const itemFit = player.items.length > 0 && (def.role === 'AD_CARRY' || def.role === 'AP_CARRY') ? 0.6 : 0.2;

  const rawPower = def.uftRating + def.cost * 0.12;

  // A levelled-up player has no use for a *fresh* low-cost body. Without this
  // every AI keeps buying 1-costs all game, the shared pool stays fragmented
  // and nobody can ever gather the 9 copies a 1-cost 3-star needs.
  const chasingThisUnit = copies > 0;
  // A reroll player is deliberately farming low-cost copies, so it keeps
  // buying them until it finally levels out of that plan.
  const lowCostFloor = profile.id === 'REROLL' ? 8 : 6;
  const staleLowCost = !chasingThisUnit && def.cost <= 2 && player.level >= lowCostFloor
    ? 1.2 + (player.level - lowCostFloor) * 0.7
    : 0;

  const benchPressure = player.bench.length >= benchCapacity(player) - 1 && ones === 0 && twos === 0 ? 1 : 0;

  // Buying below the interest floor costs real gold long-term.
  const afterGold = player.gold - def.cost;
  const econPenalty = afterGold < profile.econFloor && player.hp > profile.panicHp
    ? (profile.econFloor - afterGold) * 0.06
    : 0;

  return (
    pairNeed * 2.2 +
    upgradeNeed * 3.0 +
    traitFit * 1.5 +
    roleFit * 1.2 +
    itemFit * 0.8 +
    rawPower * 0.8 -
    benchPressure * 1.3 -
    staleLowCost -
    econPenalty
  );
}

/** Encourages a sane role mix rather than nine carries. */
function roleNeed(player: PlayerState, role: Role): number {
  const fielded = chooseFieldedUnits(player);
  const have = fielded.filter((u) => getUnitDef(u.unitDefId).role === role).length;
  const size = Math.max(1, fielded.length);
  const frontline = fielded.filter((u) => ['TANK', 'BRUISER'].includes(getUnitDef(u.unitDefId).role)).length;
  if ((role === 'TANK' || role === 'BRUISER') && frontline < Math.ceil(size * 0.35)) return 0.9;
  if (have >= Math.ceil(size * 0.6)) return -0.5;
  return 0;
}

function shouldBuyXp(player: PlayerState): boolean {
  const profile = AI_PROFILES[player.aiProfile ?? 'BALANCED'];
  if (player.level >= MAX_LEVEL) return false;
  if (player.level >= profile.targetLevel && player.hp > profile.panicHp) return false;

  const desperate = player.hp <= profile.panicHp;
  const spendFloor = desperate ? 0 : profile.econFloor;
  if (player.gold - 4 < spendFloor) return false;

  // Every profile levels up TO its target; `levelAggression` only decides how
  // eagerly it spends beyond passive XP. The previous `targetLevel - 1` bound
  // left low-aggression profiles stuck one level short of their own plan, and
  // so below the level at which they are allowed to start rolling.
  const eagerness = profile.levelAggression * (desperate ? 1.6 : 1);
  return eagerness >= 1 || player.level < profile.targetLevel;
}

function shouldReroll(player: PlayerState): boolean {
  const profile = AI_PROFILES[player.aiProfile ?? 'BALANCED'];
  const cost = rerollCost(player);
  if (player.gold < cost) return false;
  if (player.freeRerolls > 0) return true;

  const desperate = player.hp <= profile.panicHp;
  if (desperate) return player.gold >= cost;
  // One copy short of a star upgrade is worth rolling for even off-plan;
  // without this the AI banks gold and 3-stars essentially never complete.
  if (player.level >= 4 && oneCopyFromUpgrade(player)
    && player.gold - cost >= Math.min(20, profile.rollThreshold)) {
    return true;
  }
  if (player.level < profile.targetLevel) return false;
  return player.gold - cost >= profile.rollThreshold;
}

/** True when some owned unit needs exactly one more copy to star up. */
function oneCopyFromUpgrade(player: PlayerState): boolean {
  const byDef = new Map<string, { ones: number; twos: number }>();
  for (const u of [...player.board, ...player.bench]) {
    const e = byDef.get(u.unitDefId) ?? { ones: 0, twos: 0 };
    if (u.star === 1) e.ones += 1;
    else if (u.star === 2) e.twos += 1;
    byDef.set(u.unitDefId, e);
  }
  for (const e of byDef.values()) {
    if (e.ones === 2 || e.twos === 2) return true;
  }
  return false;
}

/** Runs one AI preparation phase: buy, level, roll, equip and place. */
export function runAiPrep(state: MatchState, player: PlayerState, rng: Rng): void {
  if (player.aiProfile === null) return;

  // Generous cap: a reroll-style plan legitimately cycles the shop many times
  // in one prep phase, and the loop exits as soon as a pass does nothing.
  for (let pass = 0; pass < 40; pass += 1) {
    let acted = false;

    // 1. Buy anything worth buying from the current shop.
    for (let i = 0; i < player.shop.length; i += 1) {
      const slot = player.shop[i];
      if (!slot.unitDefId || slot.sold) continue;
      const def = getUnitDef(slot.unitDefId);
      if (player.gold < def.cost) continue;
      const score = buyScore(player, slot.unitDefId);
      if (score < buyThreshold(player)) continue;
      const result = buyUnit(state, player, i);
      if (result.ok) acted = true;
    }

    // 2. Level up.
    if (shouldBuyXp(player) && buyXp(player).ok) acted = true;

    // 3. Reroll for more options.
    if (!acted && shouldReroll(player) && payReroll(player).ok) {
      player.shop = rollShop(player, state.pool, rng);
      acted = true;
    }

    if (!acted) break;
  }

  sellSurplus(state, player);
  finalizeAiFormation(player);
}

/** Re-evaluate a late draft reward without running a second economy turn. */
export function finalizeAiFormation(player: PlayerState): void {
  if (player.aiProfile === null) return;
  assignItems(player);
  applyPlacement(player, planPlacement(player, true));
}

/** The bar a unit must clear to be bought; rises when gold is tight. */
function buyThreshold(player: PlayerState): number {
  const profile = AI_PROFILES[player.aiProfile ?? 'BALANCED'];
  if (player.hp <= profile.panicHp) return 1.0;
  if (player.gold < profile.econFloor) return 2.4;
  return 1.6;
}

/** Sells low-value bench units when the bench is nearly full. */
function sellSurplus(state: MatchState, player: PlayerState): void {
  const cap = benchCapacity(player);
  if (player.bench.length < cap) return;

  const fielded = new Set(chooseFieldedUnits(player).map((u) => u.instanceId));
  const droppable = player.bench
    .filter((u) => !fielded.has(u.instanceId) && u.star === 1 && u.items.length === 0)
    // Never sell a copy that is part of a star-up chain.
    .filter((u) => copiesOf(player, u.unitDefId, 1) === 1 && copiesOf(player, u.unitDefId, 2) === 0)
    .sort((a, b) => {
      const va = getUnitDef(a.unitDefId).uftRating;
      const vb = getUnitDef(b.unitDefId).uftRating;
      return va - vb || a.instanceId.localeCompare(b.instanceId);
    });

  for (const unit of droppable) {
    if (player.bench.length < cap) break;
    sellUnit(state, player, unit.instanceId);
  }
}

/** Spec §26.6 — tag-based item assignment. */
function assignItems(player: PlayerState): void {
  // Tactician items go straight to the player's tactician slots.
  for (const stored of player.items.slice()) {
    if (getItem(stored.itemId).tactician) equipTactician(player, stored.instanceId);
  }

  const fielded = chooseFieldedUnits(player);
  if (!fielded.length) return;

  for (const stored of player.items.slice()) {
    const item = getItem(stored.itemId);
    const ranked = fielded
      .map((u) => ({ unit: u, score: itemFitScore(player, u, stored.itemId) }))
      .filter((e) => canEquip(e.unit, stored.itemId).ok)
      .sort((a, b) => b.score - a.score || a.unit.instanceId.localeCompare(b.unit.instanceId));
    if (!ranked.length) continue;
    // Hold onto raw components early so pairs can combine into real items.
    if (item.isComponent && player.items.length < 2 && fielded.length < 4) continue;
    equipItem(player, ranked[0].unit.instanceId, stored.instanceId);
  }
}

function itemFitScore(player: PlayerState, unit: UnitInstance, itemId: string): number {
  const item = getItem(itemId);
  const def = getUnitDef(unit.unitDefId);
  let score = def.uftRating + (unit.star - 1) * 0.6;

  const tags = new Set(item.tags);
  if (tags.has('DAMAGE') && (def.role === 'AD_CARRY' || def.role === 'BRUISER')) score += 2;
  if (tags.has('MANA') && (def.role === 'AP_CARRY' || def.role === 'SUPPORT')) score += 2;
  if (tags.has('TANK') && def.role === 'TANK') score += 2;
  if (item.pctStats?.abilityPower || item.stats.abilityPower) {
    if (def.role === 'AP_CARRY' || def.role === 'SUPPORT') score += 1.5;
  }

  // An emblem is worth the most on whichever unit unlocks the next trait tier.
  if (item.grantsTrait) {
    const counts = activeTraitCounts(player);
    const trait = getTrait(item.grantsTrait);
    const have = counts.get(item.grantsTrait) ?? 0;
    score += activeTierIndex(trait, have + 1) > activeTierIndex(trait, have) ? 4 : 0.5;
  }
  return score;
}

/** Cheap starting board for round 1-1, before the AI has any gold. */
export function ensureInitialBoard(state: MatchState, player: PlayerState, rng: Rng): void {
  if (player.board.length > 0 || player.bench.length > 0) return;
  for (let i = 0; i < player.shop.length && player.gold > 0; i += 1) {
    if (!player.shop[i].unitDefId) continue;
    buyUnit(state, player, i);
  }
  void rng;
  applyPlacement(player, planPlacement(player, true));
}

/** Keeps the AI's board within the team size limit after a level change. */
export function refreshAiBoard(player: PlayerState): void {
  if (player.aiProfile === null) return;
  if (player.board.length <= teamSizeLimit(player)) return;
  applyPlacement(player, planPlacement(player, true));
}

export { COMPONENT_IDS, addXp };
