import catalog from '../../data/manual/race-art.json';
import { assetUrl } from './art';
import type { G1Theme, RacePlanNode } from '../engine/race-plan/types';
import { g1Identity, G1_SHAPES, G1_OVERRIDES } from '../engine/race-plan/g1-identity';

export type RaceArt = typeof catalog[number];
export const RACE_ART: Readonly<Record<string, RaceArt>> = Object.fromEntries(catalog.map(a => [a.key, a]));
export function raceArtUrl(key: string): string | null {
  const art = RACE_ART[key];
  return art ? assetUrl(art.file) : null;
}
export function raceArtFrame(key: string, seconds: number, loop = false, reducedMotion = false): number {
  const art = RACE_ART[key];
  if (!art) return 0;
  if (reducedMotion) return Math.floor((art.frames - 1) / 2);
  const frame = Math.max(0, Math.floor(seconds * art.fps));
  return loop ? frame % art.frames : Math.min(art.frames - 1, frame);
}
export function raceArtPosition(key: string, frame: number): string {
  const a = RACE_ART[key];
  if (!a) return '0% 0%';
  const f = Math.min(a.frames - 1, Math.max(0, Math.floor(frame)));
  return `${a.cols > 1 ? (f % a.cols) / (a.cols - 1) * 100 : 0}% ${a.rows > 1 ? Math.floor(f / a.cols) / (a.rows - 1) * 100 : 0}%`;
}
const NAMED_CREST: Record<string, string> = {
  ARIMA: 'arima', ARC: 'arc', TAKARAZUKA: 'takarazuka', TENNO_SPRING: 'tenno_spring',
  DERBY: 'derby', JAPAN_CUP: 'japan_cup', DUBAI_WORLD_CUP: 'dubai_wc', MELBOURNE_CUP: 'melbourne',
  NAKAYAMA_GRAND_JUMP: 'grand_jump', NAKAYAMA_DAISHOGAI: 'daishogai',
};
export function g1CrestKey(theme: G1Theme): string {
  if (G1_OVERRIDES[theme.id] && NAMED_CREST[theme.id]) return `g1_crest_${NAMED_CREST[theme.id]}`;
  const identity = g1Identity(theme);
  return `g1_crest_${(Object.keys(G1_SHAPES).find(k => G1_SHAPES[k] === identity) ?? 'CLASSIC').toLowerCase()}`;
}
export function courseArtKey(course: string): string | null {
  const key = `course_${course.toLowerCase()}`;
  return RACE_ART[key] ? key : null;
}
export function cardFrameKey(node: RacePlanNode): string | null {
  if (node.effects.some(e => e.kind === 'RECAST_SKILL')) return 'card_frame_encore';
  if (node.effects.some(e => e.kind === 'CONVERT_STAT')) return 'card_frame_conversion';
  if (node.category === 'PACE_READ') return 'card_frame_pace_read';
  if (node.category === 'GAMBLE') return 'card_frame_gamble';
  return null;
}
