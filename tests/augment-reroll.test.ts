import { describe,expect,it } from 'vitest';
import { createMatch,RoundDirector } from '../src/game/engine/rounds/director';
import { createAugmentOffers } from '../src/game/engine/augments/offers';
import { Rng } from '../src/game/engine/rng';
import { getAugment } from '../src/game/engine/augments/augment-defs';
import { serializeMatch,restoreDirector } from '../src/game/engine/save';
import { applyOnlineCommand } from '../src/game/network/commands';
function setup() {
 const state=createMatch({seed:55});state.stage=2;state.phase='AUGMENT_SELECT';
 state.augmentOffers=createAugmentOffers(state,new Rng(99));
 return new RoundDirector(state);
}
describe('per-card augment rerolls',()=>{
 it('replaces each card once with an unseen same-grade option, preserves other players and survives reload',()=>{
  let d=setup();const p=d.state.players[0],original=structuredClone(d.state.augmentOffers[0]),others=structuredClone(d.state.augmentOffers.slice(1));
  const seen=new Set(original.options);
  for(let slot=0;slot<3;slot++){
   const before=[...d.state.augmentOffers[0].options];
   expect(d.rerollAugment(p.id,slot)).toBe(true);
   const offer=d.state.augmentOffers[0];expect(seen.has(offer.options[slot])).toBe(false);seen.add(offer.options[slot]);
   expect(getAugment(offer.options[slot]).grade).toBe(original.grade);
   expect(offer.options.filter((_,i)=>i!==slot)).toEqual(before.filter((_,i)=>i!==slot));
   const saved=serializeMatch(d);d=restoreDirector(saved);
   expect(d.rerollAugment(p.id,slot)).toBe(false);expect(serializeMatch(d).match).toEqual(saved.match);
  }
  expect(d.state.augmentOffers.slice(1)).toEqual(others);
  expect(d.chooseAugment(p.id,original.options[0])).toBe(false);
  expect(d.chooseAugment(p.id,d.state.augmentOffers[0].options[0])).toBe(true);
  expect(d.rerollAugment(p.id,0)).toBe(false);
 });
 it('rejects invalid slots and wrong phases without changing match or RNG',()=>{
  const d=setup(),p=d.state.players[0];
  for(const slot of [-1,3,.5,NaN]){
   const before=serializeMatch(d);expect(d.rerollAugment(p.id,slot)).toBe(false);expect(serializeMatch(d).match).toEqual(before.match);
  }
  d.state.phase='BATTLE';const before=serializeMatch(d);
  expect(d.rerollAugment(p.id,1)).toBe(false);expect(serializeMatch(d).match).toEqual(before.match);
 });
 it('accepts old saves and applies online rerolls only to the authenticated owner',()=>{
  const d=setup(),[a,b]=d.state.players;delete d.state.augmentOffers[0].rerolled;
  const other=structuredClone(d.state.augmentOffers[1]);
  expect(applyOnlineCommand(d,a.id,{action:'augmentReroll',slot:1})).toBeNull();
  expect(d.state.augmentOffers[1]).toEqual(other);
  expect(applyOnlineCommand(d,a.id,{action:'augmentReroll',slot:1})).not.toBeNull();
  expect(applyOnlineCommand(d,b.id,{action:'augmentReroll',slot:1})).toBeNull();
 });
});
