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
