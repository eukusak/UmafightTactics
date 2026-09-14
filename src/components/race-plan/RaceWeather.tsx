
import { useGameStore } from '../../store/gameStore';
import { RaceSprite } from './RaceArt';

/** One half-resolution atlas, behind units; frozen when the battle clock stops. */
export function RaceWeather(): JSX.Element | null {
  const running = useGameStore(s => s.battleRunning);
  const frames = useGameStore(s => s.viewedBattleFrames());
  const time = useGameStore(s => s.battleTime);
  const weather = frames?.[0]?.conditions?.weather;
  if (!running || !weather) return null;
  return <div className="race-weather"><RaceSprite name={'weather_' + weather.toLowerCase()} seconds={time} loop /></div>;
}
