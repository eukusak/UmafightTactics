import { getAugment } from '../augments/augment-defs';
import { augmentApplies } from '../augments/runtime';
import { getUnitDef } from '../roster';
import { getTrait, activeTierIndex } from '../traits/trait-defs';
import { lineupTraits, itemFit, unitPower, unitTraits } from './evaluation';
import type { PlayerState } from '../state';
import type { PublicBoard } from './strategy';

/** Public-information heuristic, not trained ML weights or access to hidden shops. */
export function augmentScore(player: PlayerState, id: string, stage: number, scouts: PublicBoard[] = []): number {
  const aug = getAugment(id), owned = [...player.board, ...player.bench], counts = lineupTraits(player, player.board);
  const eligible = owned.filter(u => augmentApplies(aug, { ...u, cost: getUnitDef(u.unitDefId).cost, traits: unitTraits(player, u) }, counts));
  let score = 0;
  const coverage = eligible.length / Math.max(1, owned.length);
  const combatWeight = player.hp < 35 ? 1.6 : stage >= 4 ? 1.2 : 1;
  score += aug.teamEffects.length ? combatWeight * coverage * (4 + Math.min(3, aug.teamEffects.length)) : 0;
  if (aug.activeTraitScaling) score *= Math.min(1.5, [...counts].filter(([t,n]) => activeTierIndex(getTrait(t),n) >= 0).length / 4);
  if (aug.filter?.unitIds) {
    const hero = aug.filter.unitIds[0], copies = owned.filter(u => u.unitDefId === hero).reduce((n,u)=>n+u.sourceCopies,0);
    const rivals = scouts.flatMap(p => p.board).filter(u => u.unitDefId === hero).reduce((n,u)=>n+u.sourceCopies,0);
    score += copies ? 7 + Math.min(8,copies) * 1.3 : stage <= 2 ? 2 : -8;
    score += player.aiPlan?.carryId === hero ? 5 : 0;
    // A late one-copy hero is usually weaker than upgrading the established board.
    if (stage >= 4 && getUnitDef(hero).cost <= 2 && copies < 6) score -= 8;
    score -= rivals * (copies >= 6 ? .35 : 1.2);
  }
  const econ = aug.economy;
  if (econ) {
    score += (econ.instantGold ?? 0) * .18 + (econ.instantXp ?? 0) * .14;
    score += (econ.maxInterestDelta ?? 0) * (stage < 4 && player.hp > 40 ? 3 : .6);
    score += (econ.freeRefreshPerRound ?? 0) * 2.5 + (econ.cheapRerollCount ?? 0) * 1.6;
    if (player.aiPlan?.mode.startsWith('REROLL')) score += (econ.pairHunterWeight ?? 0) * 25 + (econ.duplicateWeightLowCost ?? 0) * 25;
    score += (econ.teamSizeBonus ?? 0) * 9 + (econ.shopSlots ?? 0) * 5;
    if (player.hp < 35 && !econ.instantGold && !econ.teamSizeBonus) score -= 2;
  }
  if (aug.grants?.completedChoice || aug.grants?.radiantChoice || aug.grants?.componentChoice) score += 5 + (owned.some(u=>u.items.length<3) ? 2 : -3);
  if (aug.grants?.itemId) score += Math.max(0, ...owned.map(u=>itemFit(u, aug.grants!.itemId!))) * .6;
  if (aug.rememberItem || aug.growth) score += stage < 4 ? 4 : 1;
  if (aug.roundReward) {
    const r = aug.roundReward;
    score += r.condition === 'EMPTY_BENCH' ? (player.bench.length === 0 && !player.aiPlan?.mode.startsWith('REROLL') ? 5 : -4)
      : r.condition === 'FULL_BENCH' ? (player.bench.length >= 5 ? 5 : -3)
      : r.condition === 'LOSS' ? (player.streak <= -2 && player.hp > 40 ? 5 : 1)
      : (player.streak >= 2 ? 5 : 1);
  }
  const enemyAd = scouts.flatMap(p=>p.board).filter(u=>getUnitDef(u.unitDefId).role === 'AD_CARRY').length;
  if (id === 'combat_front_guard') score += Math.min(2,enemyAd*.2);
  if (id === 'combat_revive') score += player.board.reduce((n,u)=>n+unitPower(u),0) * .06;
  return score;
}
export function chooseAiAugment(player: PlayerState, options: string[], stage: number, scouts: PublicBoard[] = []): string {
  return options.slice().sort((a,b)=>augmentScore(player,b,stage,scouts)-augmentScore(player,a,stage,scouts) || a.localeCompare(b))[0];
}
