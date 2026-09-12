import type { MatchState, PlayerState, ResultLineup } from '../state';

export function captureLineup(player: PlayerState, stage: number, round: number): ResultLineup {
  return { playerId: player.id, stage, round, level: player.level, hp: player.hp,
    units: player.board.map(u => ({ ...u, items: [...u.items], position: u.position ? { ...u.position } : null })) };
}

/** Earlier losers retain their exit field; survivors freeze at the viewer's exit. */
export function resultLineups(match: MatchState, viewer: PlayerState | undefined): Map<string, ResultLineup> {
  const atExit = viewer?.eliminatedAtRound == null ? undefined : match.eliminationLineups?.[viewer.eliminatedAtRound];
  if (atExit) return new Map(atExit.map(lineup => [lineup.playerId, lineup]));
  return new Map(match.players.flatMap(player => {
    const lineup = player.finalLineup ?? (player.eliminatedAtRound === null ? captureLineup(player, match.stage, match.round) : null);
    return lineup ? [[player.id, lineup] as const] : [];
  }));
}
