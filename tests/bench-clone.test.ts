import { describe, expect, it } from 'vitest';
import { createMatch, RoundDirector, heldUnits } from '../src/game/engine/rounds/director';
import { ACTIVE_BY_COST } from '../src/game/engine/roster';
import { newInstance, benchCapacity, sellUnit } from '../src/game/engine/shop';
import { moveToBench } from '../src/game/engine/shop/bench';
import { take, remainingOf, countInPlay, totalCopies } from '../src/game/engine/pool';
import { applyItemTool } from '../src/game/engine/items/consumables';
import { applyOnlineCommand } from '../src/game/network/commands';
import { commandSchema } from '../src/game/network/protocol';
import { Rng } from '../src/game/engine/rng';
import type { Cost, Star } from '../src/game/engine/types';

function fixture() {
  const state=createMatch({seed:881}); state.phase='ROUND_PREP'; state.draft=null;
  const player=state.players[0], director=new RoundDirector(state), rng=new Rng(88);
  const add=(cost:Cost=1,star:Star=1,variant=0)=>{const u=newInstance(state,ACTIVE_BY_COST[cost][variant].id,star);expect(take(state.pool,u.unitDefId,u.sourceCopies)).toBe(true);player.bench.push(u);return u;};
  const tool=(unit:string)=>applyItemTool(state,player,'CLONE',{unit},rng);
  return {state,player,director,rng,add,tool};
}

describe('bench movement',()=>{
  it('swaps occupied positions with identities, stars and equipment preserved',()=>{
    const f=fixture(),a=f.add(1,2),b=f.add(2);a.items=['training_belt'];
    const pool=JSON.stringify(f.state.pool);
    expect(moveToBench(f.player,a.instanceId,1)).toBeNull();
    expect(f.player.bench).toEqual([b,a]);expect(a.star).toBe(2);expect(a.items).toEqual(['training_belt']);
    expect(moveToBench(f.player,a.instanceId,1)).toBeNull();expect(f.player.bench).toEqual([b,a]);
    expect(JSON.stringify(f.state.pool)).toBe(pool);
  });
  it('moves a bench unit to the end for an empty slot and rejects invalid indices atomically',()=>{
    const f=fixture(),a=f.add(),b=f.add(2);
    expect(moveToBench(f.player,a.instanceId,8)).toBeNull();expect(f.player.bench).toEqual([b,a]);
    const saved=JSON.stringify(f.state);
    for(const index of [-1,.5,NaN,benchCapacity(f.player)]) expect(moveToBench(f.player,a.instanceId,index)).not.toBeNull();
    expect(moveToBench(f.player,'foreign',0)).not.toBeNull();expect(JSON.stringify(f.state)).toBe(saved);
  });
  it('swaps a field unit into a full bench without losing the displaced unit',()=>{
    const f=fixture(),field=f.add();f.player.bench.pop();field.position={q:3,r:1};f.player.board.push(field);
    for(let i=0;i<benchCapacity(f.player);i++) f.add(2,1,i);
    const target=f.player.bench[4];expect(moveToBench(f.player,field.instanceId,4)).toBeNull();
    expect(f.player.board).toEqual([target]);expect(target.position).toEqual({q:3,r:1});expect(field.position).toBeNull();expect(f.player.bench[4]).toBe(field);
    expect(f.player.bench).toHaveLength(benchCapacity(f.player));
  });
  it('shares swaps with online commands, rejects foreign units and combat placement',()=>{
    const f=fixture(),a=f.add(),b=f.add(2);
    const command=commandSchema.parse({action:'move',unit:a.instanceId,position:null,benchIndex:1});
    expect(applyOnlineCommand(f.director,f.player.id,command)).toBeNull();expect(f.player.bench).toEqual([b,a]);
    const before=JSON.stringify(f.state);
    expect(applyOnlineCommand(f.director,f.player.id,{action:'move',unit:'enemy',position:null,benchIndex:0})).not.toBeNull();
    expect(applyOnlineCommand(f.director,f.player.id,{action:'move',unit:a.instanceId,position:{q:0,r:0},benchIndex:0})).not.toBeNull();
    expect(JSON.stringify(f.state)).toBe(before);
    f.state.phase='BATTLE';expect(applyOnlineCommand(f.director,f.player.id,command)).not.toBeNull();expect(f.player.bench).toEqual([b,a]);
  });
});

describe('unit duplicator',()=>{
  it('creates one naked 1-star copy, uses the smallest eligible charge, and conserves the pool after sale',()=>{
    const f=fixture(),u=f.add(2,2);u.items=['training_belt'];
    f.player.pendingGrants=[{kind:'CLONE',maxCost:5,count:1},{kind:'CLONE',maxCost:3,count:1}];
    const left=remainingOf(f.state.pool,u.unitDefId);
    expect(f.tool(u.instanceId)).toBe(true);
    const clone=f.player.bench[1];expect(clone.star).toBe(1);expect(clone.sourceCopies).toBe(1);expect(clone.items).toEqual([]);expect(clone.instanceId).not.toBe(u.instanceId);
    expect(u.items).toEqual(['training_belt']);expect(u.star).toBe(2);expect(f.player.pendingGrants).toEqual([{kind:'CLONE',maxCost:5,count:1}]);
    expect(remainingOf(f.state.pool,u.unitDefId)).toBe(left-1);
    expect(countInPlay(f.state.pool,heldUnits(f.state))).toBe(totalCopies(f.state.seasonId));
    sellUnit(f.state,f.player,clone.instanceId);expect(remainingOf(f.state.pool,u.unitDefId)).toBe(left);
  });
  it('can complete a combine even with a full bench',()=>{
    const f=fixture(),u=f.add();f.add();for(let i=0;f.player.bench.length<benchCapacity(f.player);i++) f.add(2,1,i);
    f.player.pendingGrants=[{kind:'CLONE',maxCost:3,count:1}];
    expect(f.tool(u.instanceId)).toBe(true);expect(f.player.bench.filter(x=>x.unitDefId===u.unitDefId).map(x=>x.star)).toEqual([2]);
    expect(f.player.bench.length).toBeLessThanOrEqual(benchCapacity(f.player));expect(f.player.pendingGrants).toHaveLength(0);
    expect(countInPlay(f.state.pool,heldUnits(f.state))).toBe(totalCopies(f.state.seasonId));
  });
  it.each(['cost','empty','full','pool','battle','foreign'] as const)('rejects %s without consuming charge, RNG, counter or copies',reason=>{
    const f=fixture(),u=f.add(reason==='cost'?5:1);f.player.pendingGrants=[{kind:'CLONE',maxCost:3,count:1}];
    if(reason==='empty') f.player.pendingGrants=[];
    if(reason==='full') for(let i=0;f.player.bench.length<benchCapacity(f.player);i++) f.add(2,1,i);
    if(reason==='pool') take(f.state.pool,u.unitDefId,remainingOf(f.state.pool,u.unitDefId));
    if(reason==='battle') f.state.phase='BATTLE';
    const before=JSON.stringify(f.state),rng=JSON.stringify(f.rng);
    expect(f.tool(reason==='foreign'?'foreign':u.instanceId)).toBe(false);expect(JSON.stringify(f.state)).toBe(before);expect(JSON.stringify(f.rng)).toBe(rng);
  });
  it('runs through the validated multiplayer tool command on an unequipped legendary',()=>{
    const f=fixture(),u=f.add(5);f.player.pendingGrants=[{kind:'CLONE',maxCost:5,count:1}];
    const command=commandSchema.parse({action:'itemTool',kind:'CLONE',target:{unit:u.instanceId}});
    expect(applyOnlineCommand(f.director,f.player.id,command)).toBeNull();expect(f.player.bench).toHaveLength(2);expect(f.player.bench[1].unitDefId).toBe(u.unitDefId);
  });
});
