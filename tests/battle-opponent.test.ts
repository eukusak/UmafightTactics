import { ACTIVE_BY_COST } from '../src/game/engine/roster';
import { expect, it } from 'vitest';
import { BattleEngine, type BattleFrame, type BattleSideInput } from '../src/game/engine/battle/engine';
import { battleOpponent } from '../src/game/ui/battle-opponent';
import { Rng } from '../src/game/engine/rng';
const players=[{id:'p1',name:'트레이너'},{id:'p2',name:'AI 2'},{id:'p3',name:'AI 3'}];
const frames=(A:string,B:string):BattleFrame[]=>[{t:0,overtime:false,units:[],events:[],participants:{A,B}}];
it('uses the viewed side for human, away-side and other-player scouting',()=>{
  expect(battleOpponent(frames('p1','p2'),'p1',players)?.name).toBe('AI 2');
  expect(battleOpponent(frames('p1','p2'),'p2',players)?.name).toBe('트레이너');
  expect(battleOpponent(frames('p2','p3'),'p2',players)?.name).toBe('AI 3');
  expect(battleOpponent(frames('p2','p3'),'p1',players)).toBeNull();
});
it('names PvE enemies and does not reuse a stale opponent while frames load',()=>{
  expect(battleOpponent(frames('p1','pve:track_golem'),'p1',players)?.name).toBe('트랙 골렘');
  expect(battleOpponent(null,'p1',players)).toBeNull();
});
it('records participants even for an empty board; older recordings still resolve',()=>{
  const side=(playerId:string):BattleSideInput=>({playerId,units:[],augments:[],tacticianItems:[]});
  const engine=new BattleEngine(side('p1'),side('p2'),new Rng(7),{recordFrames:true});engine.run();
  expect(battleOpponent(engine.frames,'p1',players)?.name).toBe('AI 2');
  const populated=(id:string):BattleSideInput=>({...side(id),units:[{instanceId:'0',unitDefId:ACTIVE_BY_COST[1][0].id,star:1,items:[],position:{q:3,r:0}}]});
  const recorded=new BattleEngine(populated('p1'),populated('p2'),new Rng(7),{recordFrames:true,maxSeconds:.1});recorded.run();
  const legacy=structuredClone(recorded.frames);delete legacy[0].participants;
  expect(battleOpponent(legacy,'p1',players)?.name).toBe('AI 2');
});
