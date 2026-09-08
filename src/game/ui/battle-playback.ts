/** Pure presentation sampling. It never advances combat or predicts damage. */
import type { BattleFrame } from '../engine/battle/engine';
import { movingPoint } from './board-projection';

export type BattleSnapshot = BattleFrame['units'][number];

/** A 180° hex-board isometry: the human remains on the preparation side. */
export function orientSnapshot(unit: BattleSnapshot, mirrored: boolean): BattleSnapshot {
  if (!mirrored) return unit;
  return {
    ...unit, team: unit.team === 'A' ? 'B' : 'A', q: 6 - unit.q, r: 7 - unit.r,
    fromQ: unit.fromQ === null ? null : 6 - unit.fromQ,
    fromR: unit.fromR === null ? null : 7 - unit.fromR,
  };
}

export function samplePosition(unit: BattleSnapshot, next: BattleSnapshot | undefined, mix: number) {
  const from = movingPoint(unit), to = next ? movingPoint(next) : from;
  const t = Math.max(0, Math.min(1, mix));
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, scale: from.scale + (to.scale - from.scale) * t };
}

export function effectProgress(time: number, start: number, duration: number): number {
  return Math.max(0, Math.min(1, (time - start) / Math.max(.001, duration)));
}

export function frameAt(frames: BattleFrame[], time: number): number {
  let lo = 0, hi = Math.max(0, frames.length - 1);
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (frames[mid].t <= time) lo = mid; else hi = mid - 1;
  }
  return lo;
}

export function damageTotals(frames: BattleFrame[], time: number): Map<string, number> {
  const totals = new Map<string, number>();
  for (const frame of frames) {
    if (frame.t > time) break;
    for (const event of frame.events) if (event.type === 'DAMAGE' && event.t <= time) {
      totals.set(event.source, (totals.get(event.source) ?? 0) + event.damage + event.absorbed);
    }
  }
  return totals;
}

/** Anticipation reaches full extension at the engine's release tick. */
export function attackExtension(time: number, start: number, release: number): number {
  const smooth = (x: number) => x * x * (3 - 2 * x);
  if (time < release) {
    const t = effectProgress(time, start, release - start);
    return t < .45 ? -.25 * smooth(t / .45) : -.25 + 1.25 * smooth((t - .45) / .55);
  }
  return 1 - smooth(effectProgress(time, release, .18));
}
