import type { Hex } from '../engine/battle/hex';
import { toBattleCell } from '../engine/battle/hex';
/** A presentation-only perspective projection, shared by DOM and Phaser. */
export function boardPoint(cell: Hex): { x: number; y: number; scale: number } {
  const scale = .82 + cell.r * .025;
  return { x: 660 + ((cell.q - 3) * 112 + ((cell.r & 1) ? 28 : -28)) * scale, y: 165 + cell.r * 38, scale };
}
export function prepPoint(cell: Hex): ReturnType<typeof boardPoint> {
  return boardPoint(toBattleCell(cell, 'A'));
}
export function boardHexPoints(cell: Hex): Array<{ x: number; y: number }> {
  const p = boardPoint(cell);
  return Array.from({ length: 6 }, (_, i) => {
    const a = (i * 60 - 90) * Math.PI / 180;
    return { x: p.x + Math.cos(a) * 57 * p.scale, y: p.y + Math.sin(a) * 32 };
  });
}
export type MovingSnapshot = { q: number; r: number; fromQ: number | null; fromR: number | null; progress: number };
export function movingPoint(u: MovingSnapshot): ReturnType<typeof boardPoint> {
  const end = boardPoint(u);
  if (u.fromQ === null || u.fromR === null) return end;
  const start = boardPoint({ q: u.fromQ, r: u.fromR });
  const t = Math.max(0, Math.min(1, u.progress));
  return { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t, scale: start.scale + (end.scale - start.scale) * t };
}
