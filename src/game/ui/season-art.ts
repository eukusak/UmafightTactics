import type { CSSProperties } from 'react';
import type { SeasonId } from '../engine/seasons/catalog';

/** Presentation assets stay outside the gameplay roster/save compatibility hash. */
export const SEASON_ART: Record<SeasonId, string> = {
  s1: '/assets/seasons/s1.webp',
  s2: '/assets/seasons/s2.webp',
  s3: '/assets/seasons/s3.webp',
  s4: '/assets/seasons/s4.webp',
  s5: '/assets/seasons/s5.webp',
};

export function seasonBackdrop(id: SeasonId): CSSProperties {
  return { '--season-background': `url("${SEASON_ART[id]}")` } as CSSProperties;
}
