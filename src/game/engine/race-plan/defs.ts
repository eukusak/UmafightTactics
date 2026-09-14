/** Catalogue registry and the guard rules that decide who may be offered what. */
import type { UnitDef } from '../types';
import { RACE_PLAN_DEFS } from './plan-defs';
import { RACE_EVOLUTION_DEFS } from './evolution-defs';
import { ALL_FINISHING_DEFS, FINISHING_MOVE_DEFS, SIGNATURE_MOVE_DEFS } from './finishing-defs';
import type { RacePlanNode } from './types';

export { RACE_PLAN_DEFS, RACE_EVOLUTION_DEFS, FINISHING_MOVE_DEFS, SIGNATURE_MOVE_DEFS, ALL_FINISHING_DEFS };

export const ALL_RACE_PLAN_NODES: RacePlanNode[] = [
  ...RACE_PLAN_DEFS,
  ...RACE_EVOLUTION_DEFS,
  ...ALL_FINISHING_DEFS,
];

const BY_ID = new Map(ALL_RACE_PLAN_NODES.map((n) => [n.id, n]));

export function getRacePlanNode(id: string): RacePlanNode {
  const node = BY_ID.get(id);
  if (!node) throw new Error(`Unknown race plan node: ${id}`);
  return node;
}

export const findRacePlanNode = (id: string): RacePlanNode | undefined => BY_ID.get(id);

/** Signature moves indexed by the unit they belong to. */
export const SIGNATURE_BY_UNIT = new Map(
  SIGNATURE_MOVE_DEFS.map((n) => [n.signatureUnitId!, n]),
);

/**
 * Hard eligibility, applied at the finishing-move offer where the unit is known.
 *
 * This is the TFT "눈알 광선" lesson: a laser that only fires in a straight line
 * is a disaster on a ranged champion. A card the player would regret taking is
 * not a choice, so it is never dealt in the first place.
 */
export function guardPasses(node: RacePlanNode, unit: UnitDef, boardSize: number): boolean {
  const ranged = unit.attackRange >= 2;
  if (node.guard.appliesTo === 'MELEE' && ranged) return false;
  if (node.guard.appliesTo === 'RANGED' && !ranged) return false;
  if (node.guard.roles && !node.guard.roles.includes(unit.role)) return false;
  if (node.guard.needsAdjacentAlly && boardSize < 3) return false;
  return true;
}

/**
 * Soft guard for the plan and evolution offers, where no unit is chosen yet.
 * A board of archers should see fewer melee-shaped plans, but never zero.
 */
export function guardAffinity(node: RacePlanNode, meleeRatio: number): number {
  if (node.guard.appliesTo === 'MELEE') return 0.85 + 0.3 * meleeRatio;
  if (node.guard.appliesTo === 'RANGED') return 0.85 + 0.3 * (1 - meleeRatio);
  return 1;
}

/** Evolutions attach to a plan through shared tags. */
export function evolutionFitsPlan(evolution: RacePlanNode, plan: RacePlanNode): boolean {
  return (evolution.requires ?? []).some((tag) => plan.tags.includes(tag));
}
