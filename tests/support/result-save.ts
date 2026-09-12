import { createMatch, RoundDirector } from '../../src/game/engine/rounds/director';
import { serializeMatch } from '../../src/game/engine/save';
import { getSeasonUnits } from '../../src/game/engine/roster';
import { newInstance } from '../../src/game/engine/shop';
import { copiesForStar, returnInstance, take } from '../../src/game/engine/pool';

/** Real settlement/save path with varied, pool-backed public fields. */
export function resultSave(eliminated: boolean) {
  const state = createMatch({ seed: 432, allAi: true });
  const director = new RoundDirector(state);
  director.beginPrep();
  state.draft = null; state.augmentOffers = []; state.phase = 'ROUND_PREP';
  const definitions = [...getSeasonUnits(state.seasonId)].sort((a, b) => a.cost - b.cost);
  for (const [row, player] of state.players.entries()) {
    for (const unit of [...player.board, ...player.bench]) returnInstance(state.pool, unit);
    player.board = []; player.bench = [];
    player.isHuman = row === 0;
    player.level = 9;
    for (let slot = 0; slot < 9; slot++) {
      const def = definitions[(row * 7 + slot) % definitions.length];
      const star = slot === 0 && row === 0 ? 3 : slot === 1 ? 2 : 1;
      if (!take(state.pool, def.id, copiesForStar(star))) throw new Error('result fixture pool');
      const unit = newInstance(state, def.id, star);
      unit.position = { q: slot % 7, r: Math.floor(slot / 7) };
      if (slot === 0) unit.items = ['finish_line_strike', 'iron_stable', 'training_belt'];
      player.board.push(unit);
    }
  }
  // Resolve PvE first so every crafted lineup survives untouched until settlement.
  director.resolveRound(true);
  state.players.forEach((p, i) => { p.hp = eliminated ? (i === 0 ? 0 : 100) : (i === 0 ? 100 : 0); });
  director.settleRound();
  if (!eliminated) director.advance();
  return serializeMatch(director);
}
