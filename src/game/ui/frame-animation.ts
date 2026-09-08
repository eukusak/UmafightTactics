import sheetsRaw from '../../data/manual/frame-sheets.json';
import type { AnimationName } from './art';

export type FrameSheet = { file: string; frameWidth: number; frameHeight: number; columns: number; rows: number; source: string; skillId: string; skillSignature: string; skillReview: string };
export const FRAME_SHEETS: Record<string, FrameSheet> = sheetsRaw;
export const FRAME_CLIPS = {
  idle: { start: 0, count: 4, fps: 4, loop: true },
  run: { start: 4, count: 4, fps: 8, loop: true },
  basic_attack: { start: 8, count: 4, fps: 8, loop: false },
  skill_cast: { start: 12, count: 4, fps: 6, loop: false },
  ko: { start: 16, count: 4, fps: 6, loop: false },
  victory: { start: 20, count: 4, fps: 5, loop: true },
} as const;

export function frameSheetUrl(id: string): string | null {
  return FRAME_SHEETS[id] ? `/assets/${FRAME_SHEETS[id].file}` : null;
}

/** Attack frame 2 is the strike; align it with the recorded release event. */
export function motionFrame(action: AnimationName, elapsed: number, releaseDelay = .24, skillAlreadyReleased = false): number {
  const clip = FRAME_CLIPS[action], time = Math.max(0, elapsed);
  if (action === 'basic_attack') {
    const release = Math.max(.001, releaseDelay);
    const index = time < release ? Math.min(1, Math.floor(time / release * 2)) : time < release + .12 ? 2 : 3;
    return clip.start + index;
  }
  // CAST effects are immediate in this engine; never show a windup after damage.
  if (action === 'skill_cast' && skillAlreadyReleased) return clip.start + (time < 1 / clip.fps ? 2 : 3);
  const index = Math.floor(time * clip.fps);
  return clip.start + (clip.loop ? index % clip.count : Math.min(index, clip.count - 1));
}
