/** Delivered art is preferred. Reference thumbnails are explicitly tracked separately. */
import deliveredRaw from '../../data/manual/delivered-art.json';
import { getItem } from '../engine/items/item-defs';
const deliveredFiles = new Set<string>(deliveredRaw);
export function assetUrl(relative: string): string | null {
  return deliveredFiles.has(relative) ? `/assets/${relative}` : null;
}
export function portraitUrl(id: string): string | null {
  return assetUrl(`portraits/${id}.png`);
}
export function standeeUrl(id: string): string | null {
  return id.startsWith('pve_') ? assetUrl(`pve/standees/${id.slice(4)}.png`) : assetUrl(`characters/standees/${id}.png`);
}
/** Decorative environments only: never affect surface traits or combat rules. */
export function arenaUrl(stage = 1, pve = false): string {
  const name = pve ? 'pve_training' : stage % 3 === 0 ? 'board_dirt' : stage % 2 === 0 ? 'board_turf_night' : 'board_turf_day';
  return `/assets/boards/bg_${name}.png`;
}
export const ANIMATION_CLIPS = {
  idle: { start: 0, count: 6, fps: 8, loop: true },
  run: { start: 10, count: 8, fps: 12, loop: true },
  basic_attack: { start: 20, count: 8, fps: 14, loop: false },
  skill_cast: { start: 30, count: 10, fps: 15, loop: false },
  ko: { start: 44, count: 6, fps: 10, loop: false },
  victory: { start: 50, count: 8, fps: 10, loop: true },
} as const;
export type AnimationName = keyof typeof ANIMATION_CLIPS;
export function animationFrame(name: AnimationName, seconds: number): number {
  const clip = ANIMATION_CLIPS[name];
  const offset = Math.max(0, Math.floor(seconds * clip.fps));
  return clip.start + (clip.loop ? offset % clip.count : Math.min(offset, clip.count - 1));
}

export function itemUrl(id: string): string | null {
  id = getItem(id).iconId ?? id;
  return assetUrl(`items/components/${id}.png`) ?? assetUrl(`items/complete/${id}.png`);
}
