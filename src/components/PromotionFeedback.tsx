import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { getUnitDef } from '../game/engine/roster';
import { assetUrl } from '../game/ui/art';
import { Portrait } from './common';

/** Observe primitive snapshots: the engine upgrades instances in place. */
export function PromotionFeedback(): JSX.Element | null {
  const revision = useGameStore((s) => s.revision);
  const previous = useRef<Map<string, { id: string; star: number }> | null>(null);
  const [promotions, setPromotions] = useState<Array<{ id: string; name: string; star: number; effect: string | null }>>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const player = useGameStore.getState().human();
    const units = player ? [...player.board, ...player.bench] : [];
    const upgraded = units.filter((unit) => {
      const before = previous.current?.get(unit.instanceId);
      if (before) return unit.star > before.star;
      // The engine may retain a newly bought copy after sorting instance IDs.
      // Compare owned ranks too, so that survivor choice cannot hide a combine.
      const owned = [...(previous.current?.values() ?? [])].filter((entry) => entry.id === unit.unitDefId);
      const priorAtRank = owned.filter((entry) => entry.star === unit.star).length;
      const nowAtRank = units.filter((entry) => entry.unitDefId === unit.unitDefId && entry.star === unit.star).length;
      return unit.star > 1 && owned.some((entry) => entry.star < unit.star) && nowAtRank > priorAtRank;
    });
    previous.current = new Map(units.map((unit) => [unit.instanceId, { id: unit.unitDefId, star: unit.star }]));
    if (!upgraded.length) return;
    setPromotions(upgraded.map((unit) => {
      const def = getUnitDef(unit.unitDefId);
      const key = unit.star === 3 ? (def.cost === 5 ? 'vfx_cost5_star3' : 'vfx_star_3') : 'vfx_star_2';
      return { id: def.id, name: def.nameKo, star: unit.star, effect: assetUrl(`vfx/${key}.png`) };
    }));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setPromotions([]), 2200);
  }, [revision]);

  useEffect(() => () => clearTimeout(timer.current), []);
  if (!promotions.length) return null;
  return (
    <div className="promotion-feedback" role="status" aria-live="polite">
      {promotions.map((unit) => (
        <div className="promotion-card" key={`${unit.id}-${unit.star}`}>
          <Portrait id={unit.id} name={unit.name} size={58} />
          {unit.effect && <span aria-hidden="true" className="promotion-vfx" style={{ backgroundImage: `url(${unit.effect})` }} />}
          <div><strong>{unit.name}</strong><div className="gold-text">{'★'.repeat(unit.star)} 합성 완료</div></div>
        </div>
      ))}
    </div>
  );
}
