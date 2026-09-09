import { describe, expect, it } from 'vitest';
import { createMatch, RoundDirector } from '../src/game/engine/rounds/director';
import { advanceCarousel, CAROUSEL, carouselPosition, setCarouselTarget } from '../src/game/engine/rounds/carousel';
import { serializeMatch, restoreDirector } from '../src/game/engine/save';
import { remainingOf } from '../src/game/engine/pool';
import { itemStorageCapacity } from '../src/game/engine/shop';
import { clientMessageSchema } from '../src/game/network/protocol';

function fixture(later = false) {
  const state = createMatch({ seed: 901 });
  state.players.forEach((p, i) => { p.aiProfile = null; if (later) p.hp = 10 + i * 10; });
  if (later) { state.stage = 2; state.round = 4; }
  const director = new RoundDirector(state, true); director.beginPrep();
  return { state, director, draft: state.draft!, c: state.draft!.carousel! };
}

describe('physical shared carousel', () => {
  it('rotates continuously but gates movement and prevents click-to-claim or teleporting', () => {
    const { state, director, draft, c } = fixture();
    const a = c.avatars[0], option = draft.options[0], home = { x: a.x, y: a.y };
    expect(setCarouselTarget(state, a.playerId, { x: 99999, y: -99999 }, option.index)).toBe(true);
    expect({ x: a.x, y: a.y }).toEqual(home);
    expect(a.target.x).toBeLessThanOrEqual(CAROUSEL.width);
    expect(director.pickDraft(a.playerId, option.index)).toBe(false);
    advanceCarousel(state, CAROUSEL.countdown - 50);
    expect(c.angle).toBeGreaterThan(0); expect({ x: a.x, y: a.y }).toEqual(home);
    advanceCarousel(state, 50);
    expect(Math.hypot(a.x - home.x, a.y - home.y)).toBeCloseTo(CAROUSEL.speed * .05);
    expect(option.takenBy).toBeNull();
    expect(setCarouselTarget(state, a.playerId, { x: NaN, y: 2 })).toBe(false);
  });

  it('uses low HP from the first later carousel and releases pairs on one shared clock', () => {
    const { state, c } = fixture(true);
    expect(c.avatars.map(a => a.playerId)).toEqual(state.players.map(p => p.id));
    expect(c.avatars.map(a => a.releaseAt)).toEqual([2500,2500,7000,7000,11500,11500,16000,16000]);
    for (const a of c.avatars) setCarouselTarget(state, a.playerId, { x: 550, y: 325 });
    advanceCarousel(state, 2550);
    expect(c.avatars.slice(2).every(a => a.x === a.home.x && a.y === a.home.y)).toBe(true);
    expect(c.avatars.slice(0, 2).every(a => a.x !== a.home.x || a.y !== a.home.y)).toBe(true);
  });

  it('awards a contested unit once on contact, conserves the pool and grants its material', () => {
    const { state, draft, c } = fixture();
    c.elapsed = 2500;
    const option = draft.options[0], position = carouselPosition(0, draft.options.length, 2.55 * CAROUSEL.rotation);
    const first = c.avatars[0], second = c.avatars[1];
    for (const a of [first, second]) { Object.assign(a, position); a.target = { ...position }; }
    const before = remainingOf(state.pool, option.unitDefId);
    advanceCarousel(state, 50);
    expect(option.takenBy).toBe(first.playerId);
    expect(first.picked).toBe(0); expect(second.picked).toBeNull();
    const player = state.players.find(p => p.id === first.playerId)!;
    expect(player.bench.map(u => u.unitDefId)).toEqual([option.unitDefId]);
    expect(player.items.map(i => i.itemId)).toEqual([option.itemId]);
    expect(remainingOf(state.pool, option.unitDefId)).toBe(before - 1);
    expect(setCarouselTarget(state, first.playerId, position, 1)).toBe(false);
    expect(setCarouselTarget(state, second.playerId, position, 0)).toBe(false);
    advanceCarousel(state, 1000);
    expect(player.bench).toHaveLength(1);
  });

  it('retains the component on the acquired unit when storage is full', () => {
    const { state, draft, c } = fixture();
    const a = c.avatars[0], player = state.players.find(p => p.id === a.playerId)!, option = draft.options[0];
    player.items = Array.from({ length: itemStorageCapacity(player) }, (_, i) => ({ instanceId: `test-${i}`, itemId: option.itemId }));
    c.elapsed = 2500;
    const pos = carouselPosition(0, draft.options.length, 2.55 * CAROUSEL.rotation);
    Object.assign(a, pos); a.target = pos;
    advanceCarousel(state, 50);
    expect(player.bench[0].items).toEqual([option.itemId]);
    expect(player.items).toHaveLength(itemStorageCapacity(player));
  });

  it('replays identical contacts across frame rates and a partial-tick save', () => {
    const { director, state, c } = fixture();
    setCarouselTarget(state, c.avatars[0].playerId, { x: 500, y: 300 }, 0);
    director.advanceCarousel(2773);
    const restored = restoreDirector(serializeMatch(director), true);
    director.advanceCarousel(1527);
    for (let i = 0; i < 1527; i++) restored.advanceCarousel(1);
    expect(restored.state).toEqual(director.state);
    director.advanceCarousel(45000); restored.advanceCarousel(45000);
    expect(restored.state).toEqual(director.state);
    expect(state.draft).toBeNull();
    expect(state.players.every(p => p.bench.length === 1 && p.items.length === 1)).toBe(true);
  });

  it('finishes later drafts without input instead of stalling disconnected seats', () => {
    const { director, state } = fixture(true);
    director.advanceCarousel(45000);
    expect(state.phase).toBe('ROUND_PREP'); expect(state.draft).toBeNull();
    expect(state.players.every(p => p.bench.length === 1)).toBe(true);
  });

  it('rejects forged positions and claims in movement messages', () => {
    const base = { type: 'command', seq: 1, round: '1-1', command: { action: 'carouselMove', target: { x: 550, y: 325 }, option: null } };
    expect(clientMessageSchema.safeParse(base).success).toBe(true);
    expect(clientMessageSchema.safeParse({ ...base, command: { ...base.command, playerId: 'p2' } }).success).toBe(false);
    expect(clientMessageSchema.safeParse({ ...base, command: { ...base.command, target: { x: Infinity, y: 325 } } }).success).toBe(false);
    expect(clientMessageSchema.safeParse({ ...base, command: { ...base.command, picked: 0 } }).success).toBe(false);
  });
});
