/**
 * Race progress and the five combat phases.
 *
 * The phases cannot key off the wall clock alone. The 500-match balance run
 * records 17.4% of fights reaching overtime, which means ~82% end before 30s and
 * a large share end before 20s — every "at 25 seconds" bonus would simply never
 * fire. Racing already has the right idea: the final straight is measured in
 * ground left, not in seconds elapsed. Here the ground left is how much of the
 * field is still standing.
 */
import { BATTLE_NORMAL_SECONDS } from '../constants';
import { RACE_PHASE_AT, type RaceCombatPhase } from './types';

export type SideCount = {
  alive: number;
  start: number;
  /** Current and starting total health, used so small boards still progress. */
  hp?: number;
  startHp?: number;
};

/**
 * 0..1 progress through the race.
 *
 * Three measures, largest wins:
 *  - the clock, 30 seconds being a full race;
 *  - how much of a side's *field* has fallen;
 *  - how much of a side's *health* has gone.
 *
 * It has to be the worst-off side rather than the field as a whole, because a
 * fight ends when one side runs out — counting both caps a clean win at 0.5 and
 * puts the final straight permanently out of reach. And it has to include
 * health, because a level-3 board is three bodies: losing one is a third of the
 * race by headcount, while the enemy carry sitting at 15% health is plainly the
 * last furlong. Bodies alone made the straight unreachable below eight units.
 */
export function raceProgress(elapsed: number, sides: SideCount[]): number {
  const timeProgress = Math.min(1, Math.max(0, elapsed) / BATTLE_NORMAL_SECONDS);
  let fieldProgress = 0;
  for (const side of sides) {
    const bodies = side.start > 0 ? 1 - Math.max(0, side.alive) / side.start : 0;
    const health = side.startHp && side.startHp > 0
      ? 1 - Math.max(0, side.hp ?? 0) / side.startHp
      : 0;
    fieldProgress = Math.max(fieldProgress, bodies, health);
  }
  return Math.min(1, Math.max(timeProgress, fieldProgress));
}

export function getRaceCombatPhase(elapsed: number, progress: number): RaceCombatPhase {
  if (elapsed >= BATTLE_NORMAL_SECONDS) return 'OVERTIME';
  if (progress >= RACE_PHASE_AT.LAST_3F) return 'LAST_3F';
  if (progress >= RACE_PHASE_AT.LATE) return 'LATE';
  if (progress >= RACE_PHASE_AT.POSITIONING) return 'POSITIONING';
  return 'START';
}

const ORDER: RaceCombatPhase[] = ['START', 'POSITIONING', 'LATE', 'LAST_3F', 'OVERTIME'];

export function phaseIndex(phase: RaceCombatPhase): number {
  return ORDER.indexOf(phase);
}

/** Phases only ever move forward; a revive must not replay LAST_3F. */
export function laterPhase(a: RaceCombatPhase, b: RaceCombatPhase): RaceCombatPhase {
  return phaseIndex(a) >= phaseIndex(b) ? a : b;
}

/** Approximate seconds a phase opens at, for tooltips only. */
export function phaseApproxSeconds(phase: RaceCombatPhase): number {
  if (phase === 'OVERTIME') return BATTLE_NORMAL_SECONDS;
  return Math.round(RACE_PHASE_AT[phase] * BATTLE_NORMAL_SECONDS);
}
