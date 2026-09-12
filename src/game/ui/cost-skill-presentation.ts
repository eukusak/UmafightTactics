import type { Cost } from '../engine/types';

/** Cosmetic only: never changes body size, targeting geometry or release timing. */
export const COST_SKILL_PRESENTATION: Record<Cost, { label: string; radius: number; stroke: number; particles: number; echoes: number; duration: number }> = {
  1: { label: '기본', radius: .85, stroke: 2, particles: 0, echoes: 0, duration: .24 },
  2: { label: '강화', radius: 1, stroke: 2.5, particles: 1, echoes: 0, duration: .28 },
  3: { label: '정예', radius: 1.12, stroke: 3, particles: 2, echoes: 1, duration: .32 },
  4: { label: '영웅', radius: 1.25, stroke: 4, particles: 4, echoes: 2, duration: .38 },
  5: { label: '전설', radius: 1.4, stroke: 5, particles: 6, echoes: 3, duration: .44 },
};
