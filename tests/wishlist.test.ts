import { afterEach, expect, it, vi } from 'vitest';
import { useWishlistStore } from '../src/store/wishlistStore';
import { getSeasonUnits } from '../src/game/engine/roster';

afterEach(() => { useWishlistStore.setState({ wishlist: {} }); vi.unstubAllGlobals(); });
it('keeps personal selections separate per season and supports deselect and clear', () => {
  const setItem = vi.fn(); vi.stubGlobal('localStorage', { setItem });
  const s1 = getSeasonUnits('s1')[0].id, s2 = getSeasonUnits('s2')[0].id;
  const store = useWishlistStore.getState();
  store.toggle('s1', s1); store.toggle('s2', s2);
  expect(useWishlistStore.getState().wishlist).toEqual({ s1: [s1], s2: [s2] });
  store.toggle('s1', s1); expect(useWishlistStore.getState().wishlist.s1).toEqual([]);
  expect(useWishlistStore.getState().wishlist.s2).toEqual([s2]);
  store.clear('s2'); expect(JSON.parse(setItem.mock.calls.at(-1)![1])).toEqual({ s1: [], s2: [] });
});
it('rejects invalid or out-of-season IDs and survives disabled browser storage', () => {
  vi.stubGlobal('localStorage', { setItem: () => { throw new Error('blocked'); } });
  const store = useWishlistStore.getState();
  store.toggle('s1', 'not-a-unit'); expect(useWishlistStore.getState().wishlist).toEqual({});
  const outside = getSeasonUnits('s2').find(u => !getSeasonUnits('s1').some(s => s.id === u.id))!;
  store.toggle('s1', outside.id); expect(useWishlistStore.getState().wishlist).toEqual({});
  const id = getSeasonUnits('s1')[0].id; store.toggle('s1', id);
  expect(useWishlistStore.getState().wishlist.s1).toEqual([id]);
});
