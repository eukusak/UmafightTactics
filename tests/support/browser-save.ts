/** Production-browser fixtures use the ordinary save/load path, without a dev UI. */
import { createMatch, RoundDirector } from '../../src/game/engine/rounds/director';
import { serializeMatch } from '../../src/game/engine/save';
import { getSeasonUnits } from '../../src/game/engine/roster';
import { newInstance, rollShop } from '../../src/game/engine/shop';
import { take } from '../../src/game/engine/pool';
import { COMPONENT_IDS } from '../../src/game/engine/items/item-defs';
import { createAugmentOffers } from '../../src/game/engine/augments/offers';
import { resultSave } from './result-save';
import { Rng } from '../../src/game/engine/rng';
const mode = process.argv[2];
const state = createMatch({ seed: 2209 });
const director = new RoundDirector(state);
director.beginPrep();
state.draft = null; state.augmentOffers = []; state.phase = 'ROUND_PREP';
const p = state.players.find(p => p.isHuman)!;
p.gold = 100; p.level = mode === 'recap' ? 8 : 1;
const units = getSeasonUnits(state.seasonId).filter(d => mode === 'frame-scale' ? ['fuji_kiseki', 'air_groove', 'agnes_tachyon', 'sweep_tosho'].includes(d.id) : d.cost === 2);
const count = mode === 'recap' ? 8 : 1;
for (let i = 0; i < count; i++) {
  const d = units[i]; if (!take(state.pool, d.id, 1)) throw new Error('fixture pool');
  const u = newInstance(state, d.id, 1);
  if (mode === 'recap') { u.position = { q: i % 7, r: i < 7 ? 0 : 3 }; p.board.push(u); }
  else p.bench.push(u);
}
if (mode === 'components') p.items = COMPONENT_IDS.map((id, i) => ({ instanceId: `fixture-item-${i}`, itemId: id }));
if (mode === 'patch-tools') {
  p.level = 3;
  p.pendingGrants = [{ kind: 'REMOVER', count: 2 }, { kind: 'REFORGER', count: 2 }];
  p.items = [{ instanceId: 'tool-component', itemId: 'training_belt' }];
  p.bench[0].items = ['winner_ribbon', 'iron_stable'];
  const extra = newInstance(state, units[1].id, 1);
  if (!take(state.pool, extra.unitDefId, 1)) throw new Error('fixture pool');
  p.bench.push(extra);
}
if (mode === 'item-rewards') { p.items = []; p.pendingGrants = [{ kind: 'RADIANT_CHOICE', count: 1 }, { kind: 'ARTIFACT_CHOICE', count: 1 }]; }
if (mode === 'arena-day') { state.stage = 5; state.round = 6; p.bench[0].position = { q: 3, r: 0 }; p.board.push(p.bench.shift()!); }
if (mode === 'augment-inspect') { p.augments = ['hero_haru_urara', 'cast_memory', 'spell_jewel']; p.augmentProgress = { hero_haru_urara: 6, cast_memory: 3 }; }
if (mode === 'six-shop') p.augments.push('shop_extra_slot');
if (mode === 'trait-chase') {
  p.level = 9;
  const natural = getSeasonUnits(state.seasonId).filter(u => u.traits.includes('sprinter'));
  const donors = getSeasonUnits(state.seasonId).filter(u => !u.traits.includes('sprinter') && u.id !== p.bench[0].unitDefId).slice(0, 9 - natural.length);
  for (const [i, def] of [...natural, ...donors].entries()) {
    if (!take(state.pool, def.id, 1)) throw new Error('trait fixture pool');
    const u = newInstance(state, def.id, 1);
    u.position = { q: i % 7, r: Math.floor(i / 7) };
    if (i >= natural.length) u.items.push('emblem_sprinter');
    p.board.push(u);
  }
}
if (mode === 'cutin-hud') {
  state.stage = 2; state.round = 2; p.level = 8;
  const roster = getSeasonUnits(state.seasonId);
  for (const player of state.players) {
    player.aiProfile = null; player.level = 8;
    const defs = player.isHuman ? roster.filter(d=>d.cost===5).slice(0,2) : roster.filter(d=>d.cost===3 && ['TANK','BRUISER'].includes(d.role)).slice(0,3);
    defs.forEach((d,i)=> {
      if (!take(state.pool,d.id,1)) throw new Error('cutin fixture pool');
      const u=newInstance(state,d.id,1);u.position={q:2+i,r:0};
      if(player.isHuman) u.items=['blue_focus','iron_stable'];
      player.board.push(u);
    });
  }
}
if (mode === 'shop-upgrades') {
  p.level=8;
  for(const [i,d] of units.slice(1,3).entries()) {
    const stars = i === 0 ? [1,1] as const : [2,2,1,1] as const;
    for(const [j,star] of stars.entries()) {
      const u=newInstance(state,d.id,star);
      if(!take(state.pool,d.id,u.sourceCopies)) throw new Error('upgrade fixture pool');
      if(j===0){u.position={q:i+2,r:0};p.board.push(u);}else p.bench.push(u);
    }
  }
}
if (mode === 'bench-tools' || mode === 'bench-odds-augment') {
  p.level=3;
  p.pendingGrants=[{kind:'CLONE',maxCost:3,count:1},{kind:'CLONE',maxCost:5,count:1}];
  for(const def of [units[1],getSeasonUnits(state.seasonId).find(d=>d.cost===5)!,units[0]]) {
    if(!take(state.pool,def.id,1)) throw new Error('bench fixture pool');
    p.bench.push(newInstance(state,def.id,1));
  }
  if(mode === 'bench-odds-augment') p.augments.push('shop_high_cost');
}
p.shop = rollShop(p, state.pool, new Rng(9001));
if (mode === 'shop-upgrades') p.shop=[units[1],units[2],units[1],units[2],units[0]].map(d=>({unitDefId:d.id,sold:false}));
if (mode === 'augment') { state.stage = 2; state.round = 1; state.augmentOffers = createAugmentOffers(state, new Rng(91)); state.phase = 'AUGMENT_SELECT'; }
console.log(JSON.stringify(mode.startsWith('result-') ? resultSave(mode === 'result-eliminated') : serializeMatch(director)));
