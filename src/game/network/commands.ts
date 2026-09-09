import type { OnlineCommand } from './protocol';
import type { RoundDirector } from '../engine/rounds/director';
import { buyUnit, sellUnit, rollShop, teamSizeLimit, benchCapacity, applyCombines } from '../engine/shop';
import { payReroll, buyXp } from '../engine/economy';
import { equipItem, equipTactician } from '../engine/items/inventory';
import { getItem } from '../engine/items/item-defs';
import { getUnitDef } from '../engine/roster';
import { getPlayer, isAlive } from '../engine/state';

/** Same commands are applied only by the authoritative room, never by clients. */
export function applyOnlineCommand(director: RoundDirector, playerId: string, command: OnlineCommand): string | null {
  const state = director.state, player = getPlayer(state, playerId);
  if (!isAlive(player) || state.phase === 'GAME_OVER') return '이미 종료된 경기입니다.';
  const battle = state.phase === 'BATTLE';
  const owns = (id: string) => [...player.board, ...player.bench].find((u) => u.instanceId === id);
  if (command.action === 'augment') return director.chooseAugment(playerId, command.id) ? null : '선택할 수 없는 증강입니다.';
  if (command.action === 'draft') return director.pickDraft(playerId, command.index) ? null : '지금 선택할 수 없습니다.';
  if (!['ROUND_PREP', 'BATTLE'].includes(state.phase)) return '현재는 선택 단계입니다.';
  switch (command.action) {
    case 'buy': { const r = buyUnit(state, player, command.slot); return r.ok ? null : '구매할 수 없습니다. 골드·대기석·공유 풀을 확인하세요.'; }
    case 'sell': {
      if (!owns(command.unit) || (battle && player.board.some((u) => u.instanceId === command.unit))) return '현재 판매할 수 없는 유닛입니다.';
      return sellUnit(state, player, command.unit).ok ? null : '아이템 보관함이 가득 찼습니다.';
    }
    case 'reroll': {
      if (!payReroll(player).ok) return '골드가 부족합니다.';
      player.shop = rollShop(player, state.pool, director.rngs.get('shop')); director.syncRng(); return null;
    }
    case 'xp': return buyXp(player).ok ? null : '골드가 부족하거나 최대 레벨입니다.';
    case 'lock': player.shopLocked = !player.shopLocked; return null;
    case 'move': {
      if (battle) return '전투가 끝난 뒤 배치할 수 있습니다.';
      const unit = owns(command.unit); if (!unit) return '본인 유닛만 이동할 수 있습니다.';
      const position = command.position, onBench = unit.position === null;
      if (!position) {
        if (onBench) return null;
        if (player.bench.length >= benchCapacity(player)) return '대기석이 가득 찼습니다.';
        player.board = player.board.filter((u) => u !== unit); player.bench.push(unit); unit.position = null; return null;
      }
      const occupant = player.board.find((u) => u.position?.q === position.q && u.position.r === position.r);
      if (occupant === unit) return null;
      if (onBench && !occupant && player.board.length >= teamSizeLimit(player)) return '출전 인원이 가득 찼습니다.';
      if (occupant) {
        occupant.position = unit.position;
        if (onBench) { player.board = player.board.filter((u) => u !== occupant); player.bench.push(occupant); }
      }
      if (onBench) { player.bench = player.bench.filter((u) => u !== unit); player.board.push(unit); }
      unit.position = position; return null;
    }
    case 'equip': {
      if (battle) return '전투 종료 후 장비를 변경할 수 있습니다.';
      if (!owns(command.unit)) return '본인 유닛만 장착할 수 있습니다.';
      const item = player.items.find((i) => i.instanceId === command.item);
      if (!item) return '보유하지 않은 아이템입니다.';
      if (getItem(item.itemId).tactician) { equipTactician(player, command.item); return null; }
      return equipItem(player, command.unit, command.item, false).ok ? null : '장착할 수 없는 아이템입니다.';
    }
  }
}

export function autoField(director: RoundDirector, playerId: string): void {
  const player = getPlayer(director.state, playerId);
  applyCombines(director.state, player);
  while (player.bench.length && player.board.length < teamSizeLimit(player)) {
    const unit = player.bench[0], def = getUnitDef(unit.unitDefId);
    const rows = ['TANK', 'BRUISER'].includes(def.role) ? [0, 1, 2, 3] : [3, 2, 1, 0];
    const position = rows.flatMap((r) => [3, 2, 4, 1, 5, 0, 6].map((q) => ({ q, r }))).find((p) => !player.board.some((u) => u.position?.q === p.q && u.position.r === p.r));
    if (!position) break;
    player.bench.shift(); unit.position = position; player.board.push(unit);
  }
}
