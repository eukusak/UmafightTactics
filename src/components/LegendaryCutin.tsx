import { useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import { getUnitDef } from '../game/engine/roster';
import { cutinUrl } from '../game/ui/art';

/** Uses the displayed match clock, and anchors to the damage panel's actual height. */
export function LegendaryCutin(): JSX.Element | null {
  const frames = useGameStore(s => s.viewedBattleFrames());
  const time = useGameStore(s => s.battleTime);
  const playerId = useGameStore(s => s.viewedPlayer()?.id);
  const complete = useGameStore(s => s.battleComplete);
  const entries = useMemo(() => {
    let last = -10;
    const result: { at: number; id: string }[] = [];
    for (const frame of frames ?? []) for (const event of frame.events) {
      if (event.type !== 'CAST' || !event.source.startsWith(playerId + '#') || event.t - last < 5) continue;
      const unit = frame.units.find(u => u.id === event.source);
      if (!unit || getUnitDef(unit.unitDefId).cost !== 5) continue;
      last = event.t; result.push({ at: event.t, id: unit.unitDefId });
    }
    return result;
  }, [frames, playerId]);
  const entry = entries.find(e => time >= e.at && time < e.at + .85);
  if (complete || !entry) return null;
  const unit = getUnitDef(entry.id), url = cutinUrl(unit.id, unit.cost);
  if (!url) return null;
  const progress = (time - entry.at) / .85;
  return <img className="battle-legendary-cutin" src={url} alt={unit.nameKo + ' 전설 컷신'} draggable={false}
    style={{ opacity: Math.min(1, progress * 8, (1 - progress) * 4), transform: 'translateX(' + (-24 * (1 - Math.min(1, progress * 6))) + 'px)' }} />;
}
