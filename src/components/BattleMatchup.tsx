import { useGameStore } from '../store/gameStore';
import { battleOpponent } from '../game/ui/battle-opponent';

export function BattleMatchup(): JSX.Element | null {
  const frames = useGameStore(s => s.viewedBattleFrames());
  const running = useGameStore(s => s.battleRunning);
  const viewed = useGameStore(s => s.viewedPlayer());
  const match = useGameStore(s => s.match);
  const spectating = useGameStore(s => s.spectating);
  useGameStore(s => s.revision);
  if (!running || !viewed || !match) return null;
  const opponent = battleOpponent(frames, viewed.id, match.players);
  if (!opponent) return null;
  const label = (spectating ? viewed.name + ' ' : '') + 'VS ' + opponent.name;
  return <div className="battle-matchup" role="status" aria-label="현재 전투 상대" title={label}>{label}</div>;
}
