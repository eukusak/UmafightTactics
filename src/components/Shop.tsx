/** Shop row, bench row and the footer controls. */
import { useGameStore } from '../store/gameStore';
import { getUnitDef } from '../game/engine/roster';
import { getTrait } from '../game/engine/traits/trait-defs';
import { rerollCost } from '../game/engine/economy';
import { benchCapacity } from '../game/engine/shop';
import { XP_PURCHASE_COST } from '../game/engine/constants';
import { Portrait, UnitToken, costVar } from './common';
import type { UnitInstance } from '../game/engine/state';

export function ShopRow(): JSX.Element | null {
  const player = useGameStore((s) => s.human());
  const buy = useGameStore((s) => s.buy);
  useGameStore((s) => s.revision);
  if (!player) return null;

  return (
    <div className="shop-row">
      {player.shop.map((slot, i) => {
        if (!slot.unitDefId) {
          return <div key={i} className="shop-card sold" style={{ borderColor: '#2b3d4f' }} />;
        }
        const def = getUnitDef(slot.unitDefId);
        const affordable = player.gold >= def.cost;
        return (
          <button
            key={i}
            className="shop-card"
            style={{ borderColor: costVar(def.cost), opacity: affordable ? 1 : 0.55 }}
            onClick={() => buy(i)}
            disabled={!affordable}
            title={`${def.nameKo} — ${def.skill.displayName}\n${def.skill.description}`}
          >
            <span className="cost">{def.cost}G</span>
            <div
              className="token"
              style={{ width: 52, height: 52, fontSize: 20, border: `3px solid ${costVar(def.cost)}` }}
            >
              <Portrait id={def.id} name={def.nameKo} size={74} />
            </div>
            <span className="name">{def.nameKo}</span>
            <div className="traits">
              {def.traits.slice(0, 3).map((t) => (
                <span key={t} className="pill" style={{ fontSize: 10, padding: '1px 6px' }}>
                  {getTrait(t).name}
                </span>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function BenchRow({
  onUnitContext,
}: {
  onUnitContext: (e: React.MouseEvent, unit: UnitInstance) => void;
}): JSX.Element | null {
  const player = useGameStore((s) => s.human());
  const moveUnit = useGameStore((s) => s.moveUnit);
  const equip = useGameStore((s) => s.equip);
  const selectedUnitId = useGameStore((s) => s.selectedUnitId);
  const selectUnit = useGameStore((s) => s.selectUnit);
  const placeSelected = useGameStore((s) => s.placeSelected);
  useGameStore((s) => s.revision);
  if (!player) return null;

  const capacity = benchCapacity(player);
  const slots = Array.from({ length: capacity }, (_, i) => player.bench[i] ?? null);

  return (
    <div className="panel-dark bench-row">
      {slots.map((unit, i) => (
        <div
          key={unit?.instanceId ?? `empty-${i}`}
          className={`bench-slot${unit ? ' filled' : ''}`}
          draggable={!!unit}
          onDragStart={(e) => {
            if (!unit) return;
            e.dataTransfer.setData('application/x-unit', unit.instanceId);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
          onDrop={(e) => {
            e.preventDefault();
            const unitId = e.dataTransfer.getData('application/x-unit');
            const itemId = e.dataTransfer.getData('application/x-item');
            if (itemId && unit) equip(unit.instanceId, itemId);
            else if (unitId) moveUnit(unitId, null);
          }}
          onContextMenu={(e) => { if (unit) { e.preventDefault(); onUnitContext(e, unit); } }}
          onClick={() => {
            if (selectedUnitId) placeSelected(null);
            else if (unit) selectUnit(unit.instanceId);
          }}
          style={selectedUnitId === unit?.instanceId
            ? { boxShadow: '0 0 0 2px var(--gold)' } : undefined}
        >
          {unit && <UnitToken unit={unit} size={58} />}
        </div>
      ))}
    </div>
  );
}

export function ShopControls(): JSX.Element | null {
  const player = useGameStore((s) => s.human());
  const reroll = useGameStore((s) => s.reroll);
  const buyXp = useGameStore((s) => s.buyExperience);
  const toggleLock = useGameStore((s) => s.toggleLock);
  useGameStore((s) => s.revision);
  if (!player) return null;

  const cost = rerollCost(player);
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <button onClick={buyXp} disabled={player.gold < XP_PURCHASE_COST || player.level >= 10}>
        경험치 구매 ({XP_PURCHASE_COST}G) <span className="muted">F</span>
      </button>
      <button onClick={reroll} disabled={player.gold < cost}>
        새로고침 ({cost}G) <span className="muted">D</span>
      </button>
      <button className={player.shopLocked ? 'btn-primary' : 'btn-ghost'} onClick={toggleLock}>
        {player.shopLocked ? '잠금 해제' : '상점 잠금'}
      </button>
    </div>
  );
}
