import { combine } from '../engine/items/item-defs';
import { useGameStore } from '../../store/gameStore';
import { useInteractionStore } from '../../store/interactionStore';

export const ITEM_COMBINE_HOLD_MS = 700;

/** One hold per gesture, shared by native mouse dragging and touch hit testing. */
export function createItemCombineHold() {
  let source: string | null = null, target: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let completed = false;
  const clear = () => {
    clearTimeout(timer); timer = undefined; target = null;
    useInteractionStore.getState().previewCombine(null);
  };
  const recipe = (targetId: string | null) => {
    const game = useGameStore.getState(), player = game.human();
    if (!source || !targetId || source === targetId || !player || game.battleRunning || game.match?.phase !== 'ROUND_PREP' || (game.onlinePlayerId && !game.networkConnected)) return null;
    const a = player.items.find(i => i.instanceId === source), b = player.items.find(i => i.instanceId === targetId);
    return a && b ? combine(a.itemId, b.itemId) : null;
  };
  return {
    get completed() { return completed; },
    start(id: string) { clear(); source = id; completed = false; },
    over(id: string | null) {
      if (completed) return;
      const resultId = recipe(id);
      if (!resultId || !id) { clear(); return; }
      if (target === id) return;
      clear(); target = id;
      useInteractionStore.getState().previewCombine({ source: source!, target: id, resultId });
      timer = setTimeout(() => {
        const a = source, b = target;
        const valid = recipe(b) === resultId;
        clear();
        if (!valid || !a || !b) return;
        completed = true;
        useGameStore.getState().combineItems(a, b);
      }, ITEM_COMBINE_HOLD_MS);
    },
    cancel() { clear(); },
    stop() { clear(); source = null; completed = false; },
  };
}

export function bindMouseItemCombine(): () => void {
  const hold = createItemCombineHold();
  let active = false;
  const start = (e: DragEvent) => {
    if (e.defaultPrevented) return;
    const source = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-touch-item]') : null;
    if (!source?.dataset.touchItem || source.closest('.overlay')) return;
    active = true; hold.start(source.dataset.touchItem);
  };
  const over = (e: DragEvent) => {
    if (!active) return;
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-drop-item]');
    hold.over(target?.dataset.dropItem ?? null);
    if (target) { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'; }
  };
  const leave = (e: DragEvent) => {
    if (!active) return;
    const next = e.relatedTarget instanceof Element ? e.relatedTarget.closest<HTMLElement>('[data-drop-item]') : null;
    hold.over(next?.dataset.dropItem ?? null);
  };
  const stop = () => { active = false; hold.stop(); };
  const drop = (e: DragEvent) => {
    if (active && hold.completed) { e.preventDefault(); e.stopImmediatePropagation(); }
    stop();
  };
  const key = (e: KeyboardEvent) => { if (e.key === 'Escape') stop(); };
  const visibility = () => { if (document.hidden) stop(); };
  document.addEventListener('dragstart', start);
  document.addEventListener('dragover', over, true);
  document.addEventListener('dragleave', leave, true);
  document.addEventListener('drop', drop, true);
  document.addEventListener('dragend', stop);
  document.addEventListener('keydown', key, true);
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('blur', stop);
  const unsubscribe = useGameStore.subscribe((s, previous) => {
    if (s.battleRunning !== previous.battleRunning || s.spectating !== previous.spectating || s.screen !== previous.screen || s.match?.phase !== 'ROUND_PREP') stop();
  });
  return () => {
    unsubscribe();
    stop();
    document.removeEventListener('dragstart', start);
    document.removeEventListener('dragover', over, true);
    document.removeEventListener('dragleave', leave, true);
    document.removeEventListener('drop', drop, true);
    document.removeEventListener('dragend', stop);
    document.removeEventListener('keydown', key, true);
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('blur', stop);
  };
}
