import type { EffectDef, SkillDef } from '../types';
import { BATTLE_TICK_MS } from '../constants';

const tick = BATTLE_TICK_MS / 1000;
const onTick = (seconds: number): number => Number((Math.ceil(seconds / tick - 1e-8) * tick).toFixed(6));
export const skillWindup = (skill: SkillDef): number => onTick(skill.choreography?.windup ?? 0);

/** Seconds relative to CAST; repeated hits have their own simulation tick. */
export function skillTimeline(skill: SkillDef): Array<{ at: number; effect: EffectDef; index: number }> {
  const windup = skill.choreography?.windup ?? 0;
  const interval = skill.choreography?.pulseInterval ?? 1 / 6;
  return skill.effects.flatMap((effect, index) => {
    const repeat = effect.tag?.startsWith('REPEAT:') ? Math.max(1, Number(effect.tag.slice(7)) || 1) : 1;
    return Array.from({ length: repeat }, (_, hit) => ({
      at: onTick(windup + (effect.delay ?? 0) + hit * interval), index,
      effect: repeat > 1 ? { ...effect, tag: undefined } : effect,
    }));
  }).sort((a, b) => a.at - b.at || a.index - b.index);
}

export function skillDuration(skill: SkillDef): number {
  return Math.max(skill.choreography?.windup ?? 0, ...skillTimeline(skill).map((e) => e.at))
    + (skill.choreography?.recovery ?? .34);
}
