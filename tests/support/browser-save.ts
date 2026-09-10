/** Production-browser fixtures use the ordinary save/load path, without a dev UI. */
import { createMatch, RoundDirector } from '../../src/game/engine/rounds/director';
import { serializeMatch } from '../../src/game/engine/save';
import { getSeasonUnits } from '../../src/game/engine/roster';
import { newInstance, rollShop } from '../../src/game/engine/shop';
import { take } from '../../src/game/engine/pool';
import { COMPONENT_IDS } from '../../src/game/engine/items/item-defs';
import { createAugmentOffers } from '../../src/game/engine/augments/offers';
import { Rng } from '../../src/game/engine/rng';
const mode = process.argv[2];
const state = createMatch({ seed: 2209 });
const director = new RoundDirector(state);
director.beginPrep();
state.draft = null; state.augmentOffers = []; state.phase = 'ROUND_PREP';
const p = state.players.find(p => p.isHuman)!;
p.gold = 100; p.level = mode === 'recap' ? 8 : 1;
const units = getSeasonUnits(state.seasonId).filter(d => d.cost === 2);
const count = mode === 'recap' ? 8 : 1;
for (let i = 0; i < count; i++) {
  const d = units[i]; if (!take(state.pool, d.id, 1)) throw new Error('fixture pool');
  const u = newInstance(state, d.id, 1);
  if (mode === 'recap') { u.position = { q: i % 7, r: i < 7 ? 0 : 3 }; p.board.push(u); }
  else p.bench.push(u);
}
if (mode === 'components') p.items = COMPONENT_IDS.map((id, i) => ({ instanceId: `fixture-item-${i}`, itemId: id }));
if (mode === 'item-rewards') { p.items = []; p.pendingGrants = [{ kind: 'RADIANT_CHOICE', count: 1 }, { kind: 'ARTIFACT_CHOICE', count: 1 }]; }
p.shop = rollShop(p, state.pool, new Rng(9001));
if (mode === 'augment') { state.stage = 2; state.round = 1; state.augmentOffers = createAugmentOffers(state, new Rng(91)); state.phase = 'AUGMENT_SELECT'; }
console.log(JSON.stringify(serializeMatch(director)));
