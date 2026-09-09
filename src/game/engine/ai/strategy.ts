import { hashString } from '../rng';
/** TFT-inspired decisions from own holdings and public boards; no pool/RNG/opponent-shop access. */
import { getSeasonUnits, getUnitDef, getUnitTraits } from '../roster';
import { getTrait } from '../traits/trait-defs';
import { combine, getItem } from '../items/item-defs';
import { XP_TO_LEVEL } from '../constants';
import { itemFit, lineupScore, unitPower } from './evaluation';
import type { DraftOption, MatchState, PlayerState, UnitInstance } from '../state';
import type { TraitId } from '../types';
export type AiPlan = { mode: 'REROLL_1' | 'REROLL_2' | 'REROLL_3' | 'FAST_8' | 'FAST_9'; carryId: string; trait: TraitId; decidedAt: number; pivots: number };
export type PublicBoard = { id: string; board: UnitInstance[] };
export const publicBoards = (state: MatchState, player: PlayerState): PublicBoard[] => state.players.filter(p => p.id !== player.id && p.eliminatedAtRound === null).map(p => ({ id: p.id, board: p.board }));
const copies = (p: PlayerState, id: string) => [...p.board, ...p.bench].filter(u => u.unitDefId === id).reduce((n, u) => n + u.sourceCopies, 0);
function contested(boards: PublicBoard[], id: string): number { return boards.reduce((n, p) => n + p.board.filter(u => u.unitDefId === id).reduce((m, u) => m + u.sourceCopies, 0), 0); }
export function choosePlan(player: PlayerState, stage: number, round: number, boards: PublicBoard[]): AiPlan {
  const owned = [...player.board, ...player.bench], roster = getSeasonUnits(player.seasonId);
  const roundKey = stage * 10 + round;
  const options = roster.filter(d => ['AD_CARRY', 'AP_CARRY', 'BRUISER'].includes(d.role)).map(d => {
    const count = copies(player, d.id), rivals = contested(boards, d.id);
    const traits = getUnitTraits(d.id, player.seasonId);
    const support = (t: TraitId) => new Set(owned.filter(u => getUnitTraits(u.unitDefId, player.seasonId).includes(t)).map(u => u.unitDefId)).size;
    const trait = traits.slice().sort((a, b) => support(b) - support(a) || (getTrait(b).category === 'SEASON' ? 1 : 0) - (getTrait(a).category === 'SEASON' ? 1 : 0))[0];
    const core: UnitInstance = { instanceId: 'candidate', unitDefId: d.id, sourceCopies: 1, star: 1, items: [], position: null };
    const itemScore = [...player.items.map(i => i.itemId), ...owned.flatMap(u => u.items)].reduce((n, id) => n + Math.max(-2, itemFit(core, id)), 0) * .18;
    const lowSupport = roster.filter(u => u.cost <= 2 && getUnitTraits(u.id, player.seasonId).includes(trait)).length;
    let mode: AiPlan['mode'] = d.cost === 1 ? 'REROLL_1' : d.cost === 2 ? 'REROLL_2' : d.cost === 3 ? 'REROLL_3' : player.aiProfile === 'FAST_LEVEL' || player.aiProfile === 'ECONOMY' ? 'FAST_9' : 'FAST_8';
    if (count >= 9) mode = 'FAST_8';
    let score = (hashString(`${player.id}:${d.id}`) % 100) / 100 + Math.min(8, count) * 1.8 + support(trait) * 1.7 + itemScore + d.uftRating;
    if (d.cost <= 2) score += lowSupport >= 4 ? 2 : -3;
    if (player.aiProfile === 'REROLL') score += d.cost <= 2 ? 5 : -2;
    if (player.aiProfile === 'BALANCED' || player.aiProfile === 'TRAIT_FOCUS') score += d.cost === 3 ? 3 : 0;
    if (player.aiProfile === 'FAST_LEVEL' || player.aiProfile === 'ECONOMY') score += d.cost >= 4 ? 7 : -3;
    if (player.aiProfile === 'AD_FOCUS') score += d.role === 'AD_CARRY' ? 4 : -2;
    if (player.aiProfile === 'AP_FOCUS') score += d.role === 'AP_CARRY' ? 4 : -2;
    if (stage >= 4 && d.cost <= 2 && count < 5) score -= 10;
    if (stage >= 5 && d.cost === 3 && count < 4) score -= 6;
    score -= rivals * (count >= 6 ? .5 : 1.8);
    if (player.aiPlan?.carryId === d.id) score += 5; // Investment hysteresis prevents round-by-round churn.
    return { mode, carryId: d.id, trait, decidedAt: roundKey, pivots: player.aiPlan?.pivots ?? 0, score };
  }).sort((a, b) => b.score - a.score || a.carryId.localeCompare(b.carryId));
  const best = options[0], old = player.aiPlan;
  if (old && old.carryId !== best.carryId) best.pivots++;
  return { mode: best.mode, carryId: best.carryId, trait: best.trait, decidedAt: roundKey, pivots: best.pivots };
}
export function plannedUnitValue(player: PlayerState, id: string): number {
  const plan = player.aiPlan; if (!plan) return 0;
  if (copies(player, id) >= 9) return -100;
  const carry = getUnitDef(plan.carryId);
  const shared = getUnitTraits(id, player.seasonId).filter(t => getUnitTraits(carry.id, player.seasonId).includes(t)).length;
  return (id === plan.carryId ? 4 : 0) + (getUnitTraits(id, player.seasonId).includes(plan.trait) ? 2.5 : 0) + shared * .3
    - (!getUnitTraits(id, player.seasonId).includes(plan.trait) && copies(player, id) >= 3 ? 4 : 0);
}
export function economyPlan(player: PlayerState, stage: number, round: number, boards: PublicBoard[]): { targetLevel: number; levelFloor: number; rollFloor: number; roll: boolean } {
  const plan = player.aiPlan, carry = plan ? getUnitDef(plan.carryId) : null;
  const reroll = plan?.mode.startsWith('REROLL') && copies(player, plan.carryId) < 9;
  const targetRoll = carry?.cost === 1 ? 5 : carry?.cost === 2 ? 6 : 7;
  let targetLevel = stage === 1 ? 3 : stage === 2 ? (round >= 5 ? 5 : 4) : stage === 3 ? (round >= 5 ? 7 : 6) : 8;
  if (reroll) targetLevel = Math.min(targetLevel, targetRoll);
  if (plan?.mode === 'REROLL_1' && stage <= 2) targetLevel = Math.min(player.level, 4);
  if (!reroll && stage >= 5 && (plan?.mode === 'FAST_9' || player.gold >= 65)) targetLevel = 9;
  const publicStrength = boards.length ? boards.reduce((n, b) => n + b.board.reduce((m, u) => m + unitPower(u), 0), 0) / boards.length : 0;
  const weak = player.board.reduce((n, u) => n + unitPower(u), 0) < publicStrength * .78;
  const panic = player.hp <= 30 || (stage >= 4 && player.hp < 50 && weak);
  const spike = stage >= 3 && (round === 1 || round === 2 || round === 5);
  const floor = panic ? 0 : stage === 1 ? 0 : stage === 2 ? (player.streak >= 2 ? 10 : 20) : 30;
  const stable = player.board.filter(u => u.star >= 2).length >= Math.max(2, player.level - 2);
  const ready = reroll ? player.level >= (carry?.cost === 1 ? 4 : targetRoll) : player.level >= targetLevel;
  return { targetLevel, levelFloor: floor, rollFloor: panic ? 0 : spike && (weak || !stable) ? 20 : 50, roll: stage >= 3 && ready || panic && player.level >= 4 };
}
export function xpGoldToLevel(player: PlayerState, target: number): number {
  let needed = -player.xp; for (let l = player.level + 1; l <= target; l++) needed += XP_TO_LEVEL[l] ?? 0;
  return Math.ceil(Math.max(0, needed) / 4) * 4;
}
/** The material that completes a useful item can outrank an expensive carousel body. */
export function draftValue(player: PlayerState, option: DraftOption): number {
  const held = [...player.board, ...player.bench];
  const carriers = held.length ? held : [{ instanceId: 'starter', unitDefId: option.unitDefId, star: 1 as const, sourceCopies: 1 as const, items: [], position: null }];
  let recipe = 0;
  for (const id of [...player.items.map(i => i.itemId), ...held.flatMap(u => u.items)].filter(id => getItem(id).isComponent)) {
    const result = combine(id, option.itemId); if (!result || getItem(result).tactician) continue;
    recipe = Math.max(recipe, ...carriers.map(u => itemFit(u, result)));
  }
  const count = copies(player, option.unitDefId);
  return plannedUnitValue(player, option.unitDefId) * 4 + (count === 2 || count === 8 ? 36 : count > 0 ? 12 : 0)
    + recipe * 5 + Math.max(...carriers.map(u => itemFit(u, option.itemId))) * 2 + getUnitDef(option.unitDefId).cost * 3;
}
export { lineupScore };
