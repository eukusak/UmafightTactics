/** Shared unit pool (spec §17.3). Copies are only removed on purchase. */
import { POOL_COPIES } from '../constants';
import { ACTIVE_UNITS, getUnitDef } from '../roster';
import type { Cost } from '../types';
import type { PoolState, UnitInstance } from '../state';

export function createPool(): PoolState {
  const remaining: Record<string, number> = {};
  for (const u of ACTIVE_UNITS) remaining[u.id] = POOL_COPIES[u.cost];
  return { remaining };
}

export function totalCopies(): number {
  return ACTIVE_UNITS.reduce((acc, u) => acc + POOL_COPIES[u.cost], 0);
}

export function remainingOf(pool: PoolState, unitDefId: string): number {
  return pool.remaining[unitDefId] ?? 0;
}

export function take(pool: PoolState, unitDefId: string, count = 1): boolean {
  const have = pool.remaining[unitDefId] ?? 0;
  if (have < count) return false;
  pool.remaining[unitDefId] = have - count;
  return true;
}

export function give(pool: PoolState, unitDefId: string, count = 1): void {
  if (!(unitDefId in pool.remaining)) return; // inactive units never entered the pool
  pool.remaining[unitDefId] += count;
  const cap = POOL_COPIES[getUnitDef(unitDefId).cost];
  if (pool.remaining[unitDefId] > cap) pool.remaining[unitDefId] = cap;
}

/** A star-N instance occupies N-th power of 3 copies (spec §17.3). */
export const copiesForStar = (star: 1 | 2 | 3): 1 | 3 | 9 => (star === 1 ? 1 : star === 2 ? 3 : 9);

/** Returns every copy a unit instance holds back to the pool. */
export function returnInstance(pool: PoolState, unit: UnitInstance): void {
  give(pool, unit.unitDefId, unit.sourceCopies);
}

export function remainingByCost(pool: PoolState): Record<Cost, number> {
  const out: Record<Cost, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const [id, n] of Object.entries(pool.remaining)) out[getUnitDef(id).cost] += n;
  return out;
}

/** Total copies currently held by players plus the pool; used by the conservation test. */
export function countInPlay(pool: PoolState, held: UnitInstance[]): number {
  const inPool = Object.values(pool.remaining).reduce((a, b) => a + b, 0);
  const inHands = held.reduce((a, u) => a + u.sourceCopies, 0);
  return inPool + inHands;
}
