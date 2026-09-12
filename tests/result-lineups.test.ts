import { expect, it } from 'vitest';
import { createMatch, heldUnits, RoundDirector } from '../src/game/engine/rounds/director';
import { resultLineups } from '../src/game/engine/rounds/result-lineups';
import { countInPlay, totalCopies } from '../src/game/engine/pool';
import { parseSave, serializeMatch, restoreDirector } from '../src/game/engine/save';
import { useGameStore } from '../src/store/gameStore';
import { privateMatch } from '../server/rooms';

function prepared() {
  const state = createMatch({ seed: 320, allAi: true });
  const director = new RoundDirector(state);
  director.beginPrep();
  state.players[0].isHuman = true;
  state.players[0].board[0].items = ['finish_line_strike', 'iron_stable'];
  director.resolveRound(true);
  return { state, director };
}

it('retains every final field before clearing losers and preserves shared pool copies', () => {
  const { state, director } = prepared();
  const before = state.players.map(p => structuredClone(p.board));
  state.players.slice(1).forEach(p => { p.hp = 0; });
  director.settleRound();
  const winnerLevel = state.players[0].level;
  state.players[0].level += 1; // Post-battle XP must not rewrite the final field level.
  director.advance();
  expect(state.players[0].finalLineup?.level).toBeLessThanOrEqual(winnerLevel);
  expect(state.phase).toBe('GAME_OVER');
  expect(resultLineups(state, state.players[0]).size).toBe(8);
  for (const [i, p] of state.players.entries()) {
    expect(p.finalLineup?.units).toEqual(before[i]);
    if (i) expect(p.board).toEqual([]);
  }
  expect(countInPlay(state.pool, heldUnits(state))).toBe(totalCopies());
  const saved = parseSave(JSON.stringify(serializeMatch(director)));
  expect(saved.ok).toBe(true);
  if (saved.ok) expect(restoreDirector(saved.save).state).toEqual(state);
});

it('freezes all opponents at the viewer exit, even if the match continues later', () => {
  const { state, director } = prepared();
  const human = state.players[0];
  human.hp = 0;
  director.settleRound();
  const views = structuredClone([...resultLineups(state, human)]);
  expect(views[0][1].units[0].items).toEqual(['finish_line_strike', 'iron_stable']);
  director.advance();
  const opponent = state.players[1];
  opponent.board[0].items.push('winner_ribbon');
  opponent.board[0].position!.q = 6;
  director.runToCompletion(120, false);
  expect([...resultLineups(state, human)]).toEqual(views);
  expect(countInPlay(state.pool, heldUnits(state))).toBe(totalCopies());
  const outgoing = privateMatch(state, human.id);
  for (const lineup of resultLineups(outgoing, outgoing.players[0]).values()) {
    expect(lineup).not.toHaveProperty('bench');
    expect(lineup).not.toHaveProperty('shop');
    expect(lineup).not.toHaveProperty('items');
  }
}, 30000);

it('opens results immediately on elimination without simulating future AI rounds', () => {
  const { state, director } = prepared();
  state.players[0].hp = 0;
  useGameStore.setState({ director, match: state, battleRunning: true, battleComplete: false, onlinePlayerId: null });
  useGameStore.getState().finishBattle();
  expect(useGameStore.getState().screen).toBe('RESULT');
  expect(state.history).toHaveLength(1);
  expect(state.players.filter(p => p.eliminatedAtRound === null)).toHaveLength(7);
  expect(state.players[0].finalLineup?.units.length).toBeGreaterThan(0);
});

it('marks missing old-save records unavailable instead of inventing dead players units', () => {
  const { state, director } = prepared();
  state.players[0].hp = 0;
  director.settleRound();
  delete state.eliminationLineups;
  for (const p of state.players) delete p.finalLineup;
  expect(resultLineups(state, state.players[0]).has(state.players[0].id)).toBe(false);
  expect(resultLineups(state, state.players[0]).get(state.players[1].id)?.units.length).toBeGreaterThan(0);
});
