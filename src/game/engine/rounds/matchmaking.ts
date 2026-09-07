/** PvP pairing and ghost boards (spec §22). */
import type { Rng } from '../rng';
import type { MatchState, PlayerState } from '../state';
import { isAlive } from '../state';

export type Pairing = {
  attackerId: string;
  defenderId: string;
  /** True when the defender is a snapshot rather than a live opponent. */
  isGhost: boolean;
};

/**
 * Pairs the living players, avoiding an immediate rematch where possible.
 * With an odd number of survivors one player fights a ghost board.
 */
export function makePairings(state: MatchState, rng: Rng): Pairing[] {
  const living = state.players.filter(isAlive);
  if (living.length <= 1) return [];

  const shuffled = rng.shuffle(living.map((p) => p.id));
  const pairs: Pairing[] = [];
  const unpaired = [...shuffled];

  while (unpaired.length >= 2) {
    const a = unpaired.shift()!;
    const playerA = state.players.find((p) => p.id === a)!;
    // Prefer someone the player did not just fight.
    let idx = unpaired.findIndex((b) => playerA.recentOpponents[0] !== b);
    if (idx < 0) idx = 0;
    const b = unpaired.splice(idx, 1)[0];
    pairs.push({ attackerId: a, defenderId: b, isGhost: false });
  }

  if (unpaired.length === 1) {
    const lonely = unpaired[0];
    const ghostCandidates = state.players
      .filter((p) => p.id !== lonely && (p.board.length > 0))
      .map((p) => p.id);
    if (ghostCandidates.length) {
      const player = state.players.find((p) => p.id === lonely)!;
      const preferred = ghostCandidates.filter((id) => player.recentOpponents[0] !== id);
      const ghost = rng.pick(preferred.length ? preferred : ghostCandidates);
      pairs.push({ attackerId: lonely, defenderId: ghost, isGhost: true });
    }
  }

  return pairs;
}

export function recordOpponent(player: PlayerState, opponentId: string): void {
  player.recentOpponents = [opponentId, ...player.recentOpponents].slice(0, 3);
}
