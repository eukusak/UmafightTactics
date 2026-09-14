import { hexDistance, type Hex } from './hex';
import type { Role } from '../types';

/** The preparation hint and combat's one-time placement read share this rule. */
export function isExposedCarry(unit: { role: Role; cell: Hex }, allies: ReadonlyArray<{ role: Role; cell: Hex }>): boolean {
  return ['AD_CARRY', 'AP_CARRY', 'SUPPORT'].includes(unit.role)
    && !allies.some(a => (a.role === 'TANK' || a.role === 'BRUISER') && hexDistance(a.cell, unit.cell) <= 1);
}
