/**
 * Generated racing profiles and the GⅠ calendar.
 *
 * Loaded once into Maps at module scope — the offer engine runs on the server
 * for eight players at four decision points, and re-parsing 145 profiles each
 * time would show up in the room tick.
 */
import profileData from '../../../data/generated/race-plan/horse-racing-profiles.json';
import themeData from '../../../data/generated/race-plan/g1-themes.json';
import { Rng } from '../rng';
import type { G1Theme, HorseRacingProfile, TrackState } from './types';

const profiles = profileData as unknown as {
  version: number;
  sourceSnapshot: string;
  rosterSize: number;
  profiles: Record<string, HorseRacingProfile>;
};

export const RACING_PROFILES = new Map<string, HorseRacingProfile>(
  Object.entries(profiles.profiles),
);

export const getRacingProfile = (unitId: string): HorseRacingProfile | undefined =>
  RACING_PROFILES.get(unitId);

export const G1_THEMES = (themeData as unknown as { themes: G1Theme[] }).themes;
export const G1_THEME_IDS = G1_THEMES.map((t) => t.id);
const THEME_BY_ID = new Map(G1_THEMES.map((t) => [t.id, t]));

export function getG1Theme(id: string | undefined): G1Theme {
  return (id && THEME_BY_ID.get(id)) || G1_THEMES[0];
}

/** One theme per match, shared by the whole lobby: everyone enters the same race. */
export function rollG1Theme(matchSeed: number): string {
  return Rng.forStream(matchSeed, 'g1-theme').pick(G1_THEME_IDS);
}

const TRACK_WEIGHTS: Array<[TrackState, number]> = [
  ['FAST', 25], ['STANDARD', 55], ['HEAVY', 20],
];

/** One going per round, shared by every fight in it. */
export function rollTrackState(rng: Rng): TrackState {
  const total = TRACK_WEIGHTS.reduce((n, [, w]) => n + w, 0);
  let roll = rng.next() * total;
  for (const [state, weight] of TRACK_WEIGHTS) {
    roll -= weight;
    if (roll < 0) return state;
  }
  return 'STANDARD';
}

/** Reads a dotted percentile path such as `stylePct.oikomi`. */
export function readPct(profile: HorseRacingProfile, axis: string): number {
  const [group, key] = axis.split('.') as [keyof HorseRacingProfile, string];
  const bucket = profile[group] as unknown as Record<string, number> | undefined;
  const value = bucket?.[key];
  return typeof value === 'number' ? value : 0.5;
}
