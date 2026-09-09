import { useGameStore } from '../../store/gameStore';
import { useInteractionStore } from '../../store/interactionStore';

import { matchesKey } from './keybindings';

export function handleBattleKey(event: KeyboardEvent): void {
  if (event.defaultPrevented || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
  const target = event.target;
  if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select, [role="textbox"]'))) return;
  const store = useGameStore.getState(), ui = useInteractionStore.getState();
  if (store.screen !== 'BATTLE' || !store.match) return;
  const action = Object.keys(store.settings.keybinds).find(key => matchesKey(event, store.settings.keybinds[key]));
  if (!action) return;
  const player = store.human();
  if (!player) return;
  const blocked = store.battleComplete || !!store.match.draft || store.match.augmentOffers.some(o => o.playerId === player.id && o.chosen === null);
  if (action === 'settings') {
    event.preventDefault();
    if (ui.draggedUnit || store.selectedUnitId) { ui.drag(null); useGameStore.setState({ selectedUnitId: null }); }
    else if (ui.inspection) ui.inspect(null);
    else store.setScreen('SETTINGS');
    return;
  }
  if (blocked || (store.onlinePlayerId && !store.networkConnected)) return;
  event.preventDefault();
  const unitId = ui.hoveredUnit ?? store.selectedUnitId;
  const unit = [...player.board, ...player.bench].find(u => u.instanceId === unitId);
  switch (action) {
    case 'reroll': store.reroll(); break;
    case 'buyXp': store.buyExperience(); break;
    case 'sellHovered': if (unit) store.sell(unit.instanceId); break;
    case 'toggleBench': {
      if (!unit) break;
      if (unit.position) store.moveUnit(unit.instanceId, null);
      else {
        const cell = Array.from({ length: 28 }, (_, i) => ({ q: i % 7, r: 3 - Math.floor(i / 7) }))
          .find(p => !player.board.some(u => u.position?.q === p.q && u.position.r === p.r));
        if (cell) store.moveUnit(unit.instanceId, cell);
      }
      break;
    }
    case 'prevPlayer': store.spectate(-1); break;
    case 'nextPlayer': store.spectate(1); break;
    case 'ownBoard': store.inspectPlayer(null); ui.inspect(null); break;
    case 'battleInfo': ui.inspect(ui.inspection?.kind === 'recap' ? null : { kind: 'recap' }); break;
  }
}
