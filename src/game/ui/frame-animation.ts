import sheetsRaw from '../../data/manual/frame-sheets.json';
import type { AnimationName } from './art';
import type { SkillDef } from '../engine/types';
import { skillTimeline, skillWindup } from '../engine/battle/skill-timeline';

export type FrameSheet = { file: string; frameWidth: number; frameHeight: number; columns: number; rows: number; source: string; skillId: string; skillSignature: string; skillReview: string; skillReleaseFrame?: number; skillCompatibilityReview?: string };
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

/** Stretch the reviewed preparation/recovery poses around real release times. */
export function skillMotionFrame(skill: SkillDef, elapsed: number, releaseFrame = 2): number {
  const time = Math.max(0, elapsed), windup = skillWindup(skill);
  const first = Math.max(0, Math.min(3, releaseFrame));
  if (time < windup && first > 0) return 12 + Math.min(first - 1, Math.floor(time / windup * first));
  const interval = skill.choreography?.pulseInterval ?? 1 / 6;
  if (skill.template === 'MULTI_SHOT') {
    const shots = skillTimeline(skill).filter(e => e.effect.kind === 'DAMAGE').slice(0, 3).map(e => e.at);
    if (time >= (shots.at(-1) ?? windup) + interval) return 15;
    return 12 + Math.max(0, shots.filter(at => time + 1e-8 >= at).length - 1);
  }
  return 12 + Math.min(3, first + Math.floor(Math.max(0, time - windup) / (skill.choreography?.recovery ?? 1 / 3)));
}

/** Attack frame 2 is the strike; align it with the recorded release event. */
export function motionFrame(action: AnimationName, elapsed: number, releaseDelay = .24, skillAlreadyReleased = false, skillReleaseFrame = 2): number {
  const clip = FRAME_CLIPS[action], time = Math.max(0, elapsed);
  if (action === 'basic_attack') {
    const release = Math.max(.001, releaseDelay);
    const index = time < release ? Math.min(1, Math.floor(time / release * 2)) : time < release + .12 ? 2 : 3;
    return clip.start + index;
  }
  // CAST effects are immediate in this engine; never show a windup after damage.
  if (action === 'skill_cast' && skillAlreadyReleased) return clip.start + Math.min(3, Math.max(0, Math.min(3, Math.floor(skillReleaseFrame))) + Math.floor(time * clip.fps));
  const index = Math.floor(time * clip.fps);
  return clip.start + (clip.loop ? index % clip.count : Math.min(index, clip.count - 1));
}
