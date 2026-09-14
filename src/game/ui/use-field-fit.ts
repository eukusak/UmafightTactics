import { useCallback, useRef } from 'react';

/** The board's authored size; everything on it is laid out in these pixels. */
const FIELD_W = 1320;
const FIELD_H = 658;

/**
 * Scales the field surface to whatever box the layout hands it.
 *
 * `--field-scale` used to be computed once from the viewport width, which holds
 * only while the field is the full width of a column taller than it is wide. In
 * landscape on a phone that assumption inverts: 844×390 gave the board a 421px
 * height inside a 390px viewport, so the bottom two rows sat off-screen and the
 * rest of the HUD was 1900px further down.
 *
 * Measuring the container instead works in both orientations without knowing
 * which one it is — in portrait the box keeps the board's own aspect ratio and
 * the width term wins, giving exactly the old number.
 */
export function useFieldFit(): (node: HTMLDivElement | null) => void {
  const observer = useRef<ResizeObserver | null>(null);
  return useCallback((node: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const fit = (): void => {
      const { width, height } = node.getBoundingClientRect();
      if (width < 1 || height < 1) return;
      node.style.setProperty('--field-scale', String(Math.min(width / FIELD_W, height / FIELD_H)));
    };
    fit();
    observer.current = new ResizeObserver(fit);
    observer.current.observe(node);
  }, []);
}
