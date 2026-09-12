import { afterEach, expect, it, vi } from 'vitest';
import { useGameStore } from '../src/store/gameStore';
import { parseSave } from '../src/game/engine/save';
afterEach(() => vi.unstubAllGlobals());

for (const phase of ['preparation', 'battle', 'settled'] as const) {
  it('saves and returns from ' + phase + ' without duplicate settlement', () => {
    const entries = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => entries.get(k) ?? null, setItem: (k: string, v: string) => entries.set(k, v) });
    useGameStore.getState().newMatch(981);
    const game = useGameStore.getState(), match = game.match!;
    match.draft = null; match.augmentOffers = [];
    match.players[0].gold = 67;
    if (phase !== 'preparation') game.startBattle();
    if (phase === 'settled') game.completeBattle();
    const before = match.history.length;
    game.exitToMainMenu();
    expect(useGameStore.getState().screen).toBe('MAIN_MENU');
    expect(useGameStore.getState().match).toBeNull();
    const saved = parseSave([...entries.values()][0]);
    expect(saved.ok).toBe(true);
    if (saved.ok) {
      expect(saved.save.match.history.length).toBe(phase === 'battle' ? before + 1 : before);
      if (phase === 'preparation') expect(saved.save.match.players[0].gold).toBe(67);
    }
    expect(useGameStore.getState().continueMatch()).toBe(true);
    expect(useGameStore.getState().match!.history.length).toBe(phase === 'preparation' ? 0 : 1);
  });
}
