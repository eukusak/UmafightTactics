import { create } from 'zustand';
import { getSeasonUnits } from '../game/engine/roster';
import { SEASON_IDS, type SeasonId } from '../game/engine/seasons/catalog';

const STORAGE_KEY = 'uft-wishlist-v1';
type Wishlist = Partial<Record<SeasonId, string[]>>;
function readWishlist(): Wishlist {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return Object.fromEntries(SEASON_IDS.map(season => {
      const valid = new Set(getSeasonUnits(season).map(u => u.id));
      return [season, Array.isArray(raw?.[season]) ? [...new Set(raw[season].filter((id: unknown) => typeof id === 'string' && valid.has(id)))] : []];
    }));
  } catch { return {}; }
}
function save(wishlist: Wishlist): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(wishlist)); } catch { /* Keep usable in memory when storage is unavailable. */ }
}

/** Personal, per-season shop markers; never change rolls or expose picks online. */
export const useWishlistStore = create<{
  wishlist: Wishlist;
  toggle: (season: SeasonId, id: string) => void;
  clear: (season: SeasonId) => void;
}>((set, get) => ({
  wishlist: readWishlist(),
  toggle: (season, id) => {
    if (!getSeasonUnits(season).some(u => u.id === id)) return;
    const current = get().wishlist[season] ?? [];
    const wishlist = { ...get().wishlist, [season]: current.includes(id) ? current.filter(x => x !== id) : [...current, id] };
    save(wishlist); set({ wishlist });
  },
  clear: (season) => {
    const wishlist = { ...get().wishlist, [season]: [] };
    save(wishlist); set({ wishlist });
  },
}));
