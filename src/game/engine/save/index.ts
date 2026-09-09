/** localStorage save/load (spec §30). Saves are deterministic replay points. */
import { SAVE_KEY } from '../constants';
import { isSeasonId } from '../seasons/catalog';
import { ROSTER_HASH } from '../roster';
import type { MatchState } from '../state';
import { RoundDirector } from '../rounds/director';

export type SaveGame = {
  version: 1;
  savedAt: string;
  activeRosterHash: string;
  match: MatchState;
};

export function serializeMatch(director: RoundDirector): SaveGame {
  if (director.hasPendingSettlement) throw new Error('An unsettled battle is not a save checkpoint');
  director.syncRng();
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    activeRosterHash: ROSTER_HASH,
    // Structured clone keeps the save independent of later mutation.
    match: JSON.parse(JSON.stringify(director.state)) as MatchState,
  };
}

export type LoadResult =
  | { ok: true; save: SaveGame }
  | { ok: false; reason: 'MISSING' | 'CORRUPT' | 'ROSTER_MISMATCH' };

export function parseSave(raw: string): LoadResult {
  let parsed: SaveGame;
  try {
    parsed = JSON.parse(raw) as SaveGame;
  } catch {
    return { ok: false, reason: 'CORRUPT' };
  }
  if (!parsed || parsed.version !== 1 || !parsed.match) return { ok: false, reason: 'CORRUPT' };
  // A data rebuild changes unit ids and costs, so old saves cannot be resumed.
  if (parsed.activeRosterHash !== ROSTER_HASH) return { ok: false, reason: 'ROSTER_MISMATCH' };
  if (!isSeasonId(parsed.match.seasonId) || parsed.match.pool?.seasonId !== parsed.match.seasonId
    || !Array.isArray(parsed.match.players) || parsed.match.players.some(p => p.seasonId !== parsed.match.seasonId)) {
    return { ok: false, reason: 'CORRUPT' };
  }
  return { ok: true, save: parsed };
}

const storage = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

export function saveToStorage(director: RoundDirector): boolean {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(SAVE_KEY, JSON.stringify(serializeMatch(director)));
    return true;
  } catch {
    return false;
  }
}

export function loadFromStorage(): LoadResult {
  const store = storage();
  if (!store) return { ok: false, reason: 'MISSING' };
  const raw = store.getItem(SAVE_KEY);
  if (!raw) return { ok: false, reason: 'MISSING' };
  return parseSave(raw);
}

export function clearSave(): void {
  storage()?.removeItem(SAVE_KEY);
}

export function hasSave(): boolean {
  return !!storage()?.getItem(SAVE_KEY);
}

/** Rebuilds a director from a save, restoring every RNG stream. */
export function restoreDirector(save: SaveGame, interactiveDraft = false): RoundDirector {
  return new RoundDirector(save.match, interactiveDraft);
}
