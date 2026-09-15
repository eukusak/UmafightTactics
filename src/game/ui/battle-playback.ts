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

export type ContributionMetric = 'dealt' | 'taken' | 'shield';
export function contributionTotals(frames: BattleFrame[], time: number, metric: ContributionMetric): Map<string, number> {
  const totals = new Map<string, number>();
  for (const frame of frames) {
    if (frame.t > time) break;
    for (const event of frame.events) {
      if (event.t > time) continue;
      const id = event.type === 'DAMAGE' && metric !== 'shield' ? (metric === 'dealt' ? event.source : event.target) : event.type === 'SHIELD' && metric === 'shield' ? event.source : null;
      const amount = event.type === 'DAMAGE' ? event.damage + event.absorbed : event.type === 'SHIELD' ? event.amount : 0;
      if (id) totals.set(id, (totals.get(id) ?? 0) + amount);
    }
  }
  return totals;
}

/**
 * How long the race phase call-out stays up.
 *
 * It used to be a flat 0.6s of *battle* time, which is the wrong clock:
 * playback runs battle time at the speed multiplier, so the same 0.6s is 0.6
 * real seconds at 1x and 0.06 at 10x — the announcement was gone before it
 * could be read at any speed a player actually watches at. The window is
 * therefore expressed in real seconds and converted, with a ceiling so a 10x
 * run does not leave 발주 still on screen at 4코너.
 */
const BANNER_REAL_SECONDS = 1.5;
const BANNER_MAX_BATTLE_SECONDS = 4;
/** Fraction of the window spent fading, so it leaves rather than vanishes. */
const BANNER_FADE = 0.3;

export function bannerWindow(speed: number): number {
  return Math.min(BANNER_MAX_BATTLE_SECONDS, BANNER_REAL_SECONDS * Math.max(1, speed));
}

/** 1 while the call-out is fully up, ramping to 0 across the tail. */
export function bannerOpacity(age: number, window: number): number {
  if (age < 0 || age >= window) return 0;
  const fadeFrom = window * (1 - BANNER_FADE);
  if (age <= fadeFrom) return 1;
  return Math.max(0, 1 - (age - fadeFrom) / (window - fadeFrom));
}
