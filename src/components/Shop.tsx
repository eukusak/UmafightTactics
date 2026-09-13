import { matchSkillDescription } from '../game/ui/match-descriptions';
/** Shop row, bench row and the footer controls. */
import { useState } from 'react';
import { useInteractionStore } from '../store/interactionStore';
import { useGameStore } from '../store/gameStore';
import { getUnitDef, getUnitTraits } from '../game/engine/roster';
import { getTrait } from '../game/engine/traits/trait-defs';
import { rerollCost } from '../game/engine/economy';
import { benchCapacity, sellPrice, purchaseUpgradeStar, shopOddsFor } from '../game/engine/shop';
import { XP_PURCHASE_COST } from '../game/engine/constants';
import { Portrait, UnitToken, costVar } from './common';
import type { Cost } from '../game/engine/types';
import type { UnitInstance } from '../game/engine/state';
import { useWishlistStore } from '../store/wishlistStore';

export function ShopRow(): JSX.Element | null {
  const wishlist = useWishlistStore(s => s.wishlist);
  const player = useGameStore((s) => s.human());
  const buy = useGameStore((s) => s.buy);
  const dragged = useInteractionStore(s => s.draggedUnit);
  const [over, setOver] = useState(false);
  useGameStore((s) => s.revision);
  if (!player) return null;

  const unit = [...player.board, ...player.bench].find(u => u.instanceId === dragged);
  return (
    <div className={`shop-row sell-drop-zone${unit ? ' selling' : ''}${over ? ' over' : ''}`} aria-label="상점 판매 영역" data-drop="sell"
      style={{ gridTemplateColumns: `repeat(${Math.max(1, player.shop.length)}, minmax(0, 1fr))` }}
      onDragOver={e => { if (e.dataTransfer.types.includes('application/x-unit')) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(true); } }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false); }}
      onDrop={e => { e.preventDefault(); setOver(false); const id = e.dataTransfer.getData('application/x-unit'); if (id) useGameStore.getState().sell(id); useInteractionStore.getState().drag(null); }}>
      {unit && <div className="sell-overlay"><strong>{getUnitDef(unit.unitDefId).nameKo} 판매 · {sellPrice(player, unit)}G</strong><span>상점 위에 놓으면 판매 · 장착 아이템은 보관함으로 반환</span></div>}
      {player.shop.map((slot, i) => {
        if (!slot.unitDefId) {
          return <div key={i} className="shop-card sold" style={{ borderColor: '#2b3d4f' }} />;
        }
        const def = getUnitDef(slot.unitDefId);
        const affordable = player.gold >= def.cost;
        const effective = matchSkillDescription(def, player);
        const upgrade = purchaseUpgradeStar(player, def.id);
        const wanted = wishlist[player.seasonId ?? 's1']?.includes(def.id) ?? false;
        return (
          <button
            key={i}
            className={`shop-card${wanted ? ' wanted' : ''}${upgrade ? ' upgradable' : ''}`}
            data-unit-def={def.id}
            style={{ borderColor: costVar(def.cost), opacity: affordable ? 1 : 0.55 }}
            onClick={() => buy(i)}
            disabled={!affordable}
            title={`${def.nameKo} — ${def.skill.displayName}\n${effective.description}\n${effective.changes.join('\n')}`}
          >
            <span className="cost">{def.cost}G</span>
            {upgrade && <span className={`shop-upgrade-badge star-${upgrade}`} aria-label={`구입 시 ${upgrade}성 합성`} title={`필드와 대기석 기물 포함 · 구입 시 ${upgrade}성 합성`}>{'★'.repeat(upgrade)} {upgrade}성 가능</span>}
            {wanted && <span className="wishlist-marker" aria-label="희망 기물" title="희망 기물">★<span className="wishlist-marker-label"> 희망 기물</span></span>}
            <div
              className="token"
              style={{ width: 52, height: 52, fontSize: 20, border: `3px solid ${costVar(def.cost)}` }}
            >
              <Portrait id={def.id} name={def.nameKo} size={74} />
            </div>
            <span className="name">{def.nameKo}</span>
            <div className="traits">
              {getUnitTraits(def.id, player.seasonId).map((t) => (
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
  useGameStore((s) => s.revision);
  if (!player) return null;

  const odds = shopOddsFor(player);
  const capacity = benchCapacity(player);
  const slots = Array.from({ length: capacity }, (_, i) => player.bench[i] ?? null);

  return (
    <div className="panel-dark bench-row">
      <div className="bench-units">
      {slots.map((unit, i) => (
        <div
          key={unit?.instanceId ?? `empty-${i}`}
          className={`bench-slot${unit ? ' filled' : ''}`}
          data-unit-id={unit?.instanceId} data-touch-unit={unit?.instanceId} data-drop="bench" data-bench-index={i} data-drop-unit={unit?.instanceId}
          role="button" tabIndex={0} aria-label={unit ? `${getUnitDef(unit.unitDefId).nameKo} 대기석 정보` : '빈 대기석'}
          onMouseEnter={() => useInteractionStore.getState().hover(unit?.instanceId ?? null)}
          onMouseLeave={() => useInteractionStore.getState().hover(null)}
          onKeyDown={e => { if (unit && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); selectUnit(unit.instanceId); useInteractionStore.getState().inspect({ kind: 'unit', id: unit.instanceId, playerId: player.id }); } }}
          draggable={!!unit}
          onDragStart={(e) => {
            if (!unit) return;
            useInteractionStore.getState().drag(unit.instanceId);
            e.dataTransfer.setData('application/x-unit', unit.instanceId);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
          onDrop={(e) => {
            e.preventDefault();
            const unitId = e.dataTransfer.getData('application/x-unit');
            const itemId = e.dataTransfer.getData('application/x-item');
            if (itemId && unit) equip(unit.instanceId, itemId);
            else if (unitId) moveUnit(unitId, null, i);
          }}
          onContextMenu={(e) => { if (unit) { e.preventDefault(); onUnitContext(e, unit); } }}
          onClick={() => {
            if (unit) { selectUnit(unit.instanceId); useInteractionStore.getState().inspect({ kind: 'unit', id: unit.instanceId, playerId: player.id }); }
            else if (selectedUnitId) moveUnit(selectedUnitId, null, i);
          }}
          style={selectedUnitId === unit?.instanceId
            ? { boxShadow: '0 0 0 2px var(--gold)' } : undefined}
        >
          {unit && <UnitToken unit={unit} size={58} />}
        </div>
      ))}
      </div>
      <div className="bench-odds" aria-label="코스트별 상점 등장 확률" title="현재 레벨과 증강 보정이 반영된 코스트 추첨 확률입니다. 개별 기물의 확률은 공유 풀 재고에 따라 달라집니다.">
        <span>Lv.{player.level} · 상점 확률</span>
        <div>{([1,2,3,4,5] as Cost[]).map(cost => <span key={cost} style={{color:costVar(cost)}} data-cost={cost}><small>{cost}코</small><b>{Number(odds[cost].toFixed(2))}%</b></span>)}</div>
      </div>
    </div>
  );
}

export function ShopControls(): JSX.Element | null {
  const player = useGameStore((s) => s.human());
  const reroll = useGameStore((s) => s.reroll);
  const buyXp = useGameStore((s) => s.buyExperience);
  const toggleLock = useGameStore((s) => s.toggleLock);
  const keybinds = useGameStore((s) => s.settings.keybinds);
  useGameStore((s) => s.revision);
  if (!player) return null;

  const cost = rerollCost(player);
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <button data-sound="xp" onClick={buyXp} disabled={player.gold < XP_PURCHASE_COST || player.level >= 10}>
        경험치 구매 ({XP_PURCHASE_COST}G) <span className="muted">{keybinds.buyXp.toUpperCase()}</span>
      </button>
      <button onClick={reroll} disabled={player.gold < cost}>
        새로고침 ({cost}G) <span className="muted">{keybinds.reroll.toUpperCase()}</span>
      </button>
      <button className={player.shopLocked ? 'btn-primary' : 'btn-ghost'} onClick={toggleLock}>
        {player.shopLocked ? '잠금 해제' : '상점 잠금'}
      </button>
    </div>
  );
}
