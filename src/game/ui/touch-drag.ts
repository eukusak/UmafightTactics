import { useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useInteractionStore } from '../../store/interactionStore';
import { bindMouseItemCombine, createItemCombineHold } from './item-combine-drag';

/** Use viewport hit testing so touch drops also work on a scaled/scrolling board. */
export function bindTouchDrag(): () => void {
  const combineHold = createItemCombineHold();
  let pending: { pointer: number; unit?: string; item?: string; x: number; y: number; source: HTMLElement } | null = null;
  let active = false, suppressUntil = 0, x = 0, y = 0, raf = 0;
  let ghost: HTMLElement | null = null, target: HTMLElement | null = null;
  const hit = () => {
    target?.removeAttribute('data-touch-over');
    target = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop]') ?? null;
    target?.setAttribute('data-touch-over', 'true');
    if (pending?.item) combineHold.over(target?.dataset.dropItem ?? null);
  };
  const stop = () => {
    combineHold.stop();
    cancelAnimationFrame(raf); ghost?.remove(); ghost = null;
    target?.removeAttribute('data-touch-over'); target = null;
    pending = null; active = false; useInteractionStore.getState().drag(null);
  };
  const scroll = () => {
    if (!active) return;
    const stage = document.querySelector<HTMLElement>('.stage.mobile');
    if (stage) {
      const box = stage.getBoundingClientRect();
      const delta = y < box.top + 55 ? -9 : y > box.bottom - 55 ? 9 : 0;
      if (delta) { stage.scrollTop += delta; hit(); }
    }
    raf = requestAnimationFrame(scroll);
  };
  const down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' || !e.isPrimary || pending) return;
    const source = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-touch-unit], [data-touch-item]') : null;
    if (!source || source.closest('.overlay')) return;
    pending = { pointer: e.pointerId, unit: source.dataset.touchUnit, item: source.dataset.touchItem, x: e.clientX, y: e.clientY, source };
  };
  const move = (e: PointerEvent) => {
    if (!pending || e.pointerId !== pending.pointer) return;
    x = e.clientX; y = e.clientY;
    if (!active && Math.hypot(x - pending.x, y - pending.y) < 8) return;
    e.preventDefault();
    if (!active) {
      active = true;
      if (pending.item) combineHold.start(pending.item);
      useInteractionStore.getState().drag(pending.unit ?? null);
      ghost = document.createElement('div'); ghost.className = 'touch-drag-ghost';
      ghost.textContent = pending.source.getAttribute('aria-label') ?? (pending.item ? '아이템 장착' : '기물 이동');
      document.body.append(ghost); raf = requestAnimationFrame(scroll);
    }
    ghost!.style.transform = `translate(${x + 12}px, ${y - 40}px)`; hit();
  };
  const up = (e: PointerEvent) => {
    if (!pending || e.pointerId !== pending.pointer) return;
    if (active) {
      e.preventDefault(); suppressUntil = Date.now() + 500;
      x = e.clientX; y = e.clientY; hit();
      const game = useGameStore.getState(), drop = target?.dataset;
      if (pending.item && drop?.dropUnit && !combineHold.completed) game.equip(drop.dropUnit, pending.item);
      else if (pending.unit && drop) {
        if (drop.drop === 'sell') game.sell(pending.unit);
        else if (drop.drop === 'bench') game.moveUnit(pending.unit, null);
        else if (drop.drop === 'board') game.moveUnit(pending.unit, { q: Number(drop.q), r: Number(drop.r) });
      }
    }
    stop();
  };
  const cancel = (e: PointerEvent) => { if (pending?.pointer === e.pointerId) stop(); };
  const key = (e: KeyboardEvent) => { if (e.key === 'Escape') stop(); };
  const visibility = () => { if (document.hidden) stop(); };
  const click = (e: MouseEvent) => { if (Date.now() < suppressUntil) { e.preventDefault(); e.stopImmediatePropagation(); } };
  const nativeDrag = (e: DragEvent) => { if (pending) e.preventDefault(); };
  const context = (e: Event) => { if (pending) e.preventDefault(); };
  document.addEventListener('pointerdown', down, true);
  document.addEventListener('pointermove', move, { capture: true, passive: false });
  document.addEventListener('pointerup', up, true);
  document.addEventListener('pointercancel', cancel, true);
  document.addEventListener('click', click, true);
  document.addEventListener('dragstart', nativeDrag, true);
  document.addEventListener('contextmenu', context, true);
  window.addEventListener('blur', stop);
  document.addEventListener('keydown', key, true);
  document.addEventListener('visibilitychange', visibility);
  return () => {
    stop();
    document.removeEventListener('pointerdown', down, true);
    document.removeEventListener('pointermove', move, true);
    document.removeEventListener('pointerup', up, true);
    document.removeEventListener('pointercancel', cancel, true);
    document.removeEventListener('click', click, true);
    document.removeEventListener('dragstart', nativeDrag, true);
    document.removeEventListener('contextmenu', context, true);
    window.removeEventListener('blur', stop);
    document.removeEventListener('keydown', key, true);
    document.removeEventListener('visibilitychange', visibility);
  };
}
export function useTouchDrag(): void { useEffect(bindTouchDrag, []); useEffect(bindMouseItemCombine, []); }
