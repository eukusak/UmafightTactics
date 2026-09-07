/** Round calendar (spec §19). */
import { AUGMENT_ROUNDS, PREP_SECONDS } from '../constants';
import type { RoundKind } from '../state';

export type RoundInfo = {
  stage: number;
  round: number;
  kind: RoundKind;
  label: string;
  prepSeconds: number;
  hasAugment: boolean;
};

export function roundsInStage(stage: number): number {
  return stage === 1 ? 3 : 7;
}

/** Spec §19 — stage 1 is three PvE rounds; later stages run PvP×3, draft, PvP×2, PvE. */
export function roundKind(stage: number, round: number): RoundKind {
  if (stage === 1) return 'PVE';
  if (round === 4) return 'DRAFT';
  if (round === 7) return 'PVE';
  return 'PVP';
}

/**
 * Spec §16.1 / §19.1 — 1-1 opens with the Twinkle Start selection, which is
 * what gives every player their first unit. Without it both the human and the
 * AI would enter 1-1 with an empty board and no gold to fix it.
 */
export function hasStartSelection(stage: number, round: number): boolean {
  return stage === 1 && round === 1;
}

export function hasAugmentBefore(stage: number, round: number): boolean {
  return AUGMENT_ROUNDS.some((a) => a.stage === stage && a.round === round);
}

export function roundInfo(stage: number, round: number): RoundInfo {
  const kind = roundKind(stage, round);
  const hasAugment = hasAugmentBefore(stage, round);
  const prepSeconds = hasAugment
    ? PREP_SECONDS.AUGMENT
    : kind === 'DRAFT'
      ? PREP_SECONDS.DRAFT
      : kind === 'PVE'
        ? PREP_SECONDS.PVE
        : PREP_SECONDS.PVP;
  return { stage, round, kind, label: `${stage}-${round}`, prepSeconds, hasAugment };
}

export function nextRound(stage: number, round: number): { stage: number; round: number } {
  if (round >= roundsInStage(stage)) return { stage: stage + 1, round: 1 };
  return { stage, round: round + 1 };
}

/** Rounds elapsed since 1-1, used for damage curves and logging. */
export function absoluteRound(stage: number, round: number): number {
  if (stage <= 1) return round;
  return 3 + (stage - 2) * 7 + round;
}
