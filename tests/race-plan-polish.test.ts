import { describe, expect, it } from 'vitest';
import { BattleEngine, type BattleSideInput } from '../src/game/engine/battle/engine';
import { RaceResourceTracker } from '../src/game/engine/race-plan/runtime';
import { newInstance } from '../src/game/engine/shop';
import { take } from '../src/game/engine/pool';
import { Rng } from '../src/game/engine/rng';
import { SOUND_DESIGNS, soundPeakGain } from '../src/game/ui/audio';
import { createMatch, RoundDirector } from '../src/game/engine/rounds/director';
import { racePlanOpensFor } from '../src/game/engine/race-plan/director-ops';
import { describeEffects } from '../src/game/engine/race-plan/presentation';
import { findRacePlanNode } from '../src/game/engine/race-plan/defs';

const side = (playerId:string):BattleSideInput => ({
  playerId, augments:[],tacticianItems:[],
  units:[{instanceId:'entry',unitDefId:'super_creek',star:2,items:[],position:{q:3,r:0}}],
  racePlan:{entryInstanceId:'entry',entryUnitDefId:'super_creek',trackState:'STANDARD',nodeIds:['RP_SLOW_STORE','EV_STAMINA_BANK','FM_STAYER']},
});
describe('race plan delivery regressions',()=>{
  it('serializes independent gauges and phase progress without sharing mutable stacks',()=>{
    const engine=new BattleEngine(side('p1'),side('p2'),new Rng(67),{recordFrames:true,maxSeconds:12});
    engine.run();
    expect(engine.frames[0].units[0].race?.resources.every(r=>r.stacks===0)).toBe(true);
    expect(engine.frames.some(f=>f.units.some(u=>u.race?.resources.some(r=>r.stacks>0)))).toBe(true);
    for(let i=1;i<engine.frames.length;i++) expect(engine.frames[i].race!.progress).toBeGreaterThanOrEqual(engine.frames[i-1].race!.progress);
  });
  it('keeps each stamina stack and gives the last straight its recorded payout',()=>{
    const tracker=new RaceResourceTracker(['FM_STAYER']);
    expect(tracker.onTick(5,'START')[0].effects[0].value).toBeCloseTo(.02);
    expect(tracker.onTick(25,'LATE')[0].effects[0].value).toBeCloseTo(.1);
    const payout=tracker.onPhase('LAST_3F')[0];
    expect(payout.effects.map(e=>e.value)).toEqual([.1,.1]);
    expect(tracker.onTick(35,'OVERTIME')).toEqual([]);
    expect(tracker.resources[0].stacks).toBe(5);
  });
  it('does not drop intermediate phase effects after a single burst',()=>{
    const engine=new BattleEngine(side('p1'),side('p2'),new Rng(5),{recordFrames:true,maxSeconds:.1});
    engine.run();
    const internal=engine as unknown as {racePhase:'START';racePhaseHigh:number;events:import('../src/game/engine/battle/engine').BattleEvent[];advanceRacePhase():void};
    internal.racePhase='START';internal.racePhaseHigh=.9;
    const before=internal.events.length;internal.advanceRacePhase();
    expect(internal.events.slice(before).filter(e=>e.type==='RACE_PHASE').map(e=>e.type==='RACE_PHASE'&&e.phase)).toEqual(['POSITIONING','LATE','LAST_3F']);
    const count=internal.events.length;internal.advanceRacePhase();expect(internal.events.length).toBe(count);
  });
  it('updates headless AI recent combat just like recorded PvP',()=>{
    const state=createMatch({seed:19,allAi:true});const director=new RoundDirector(state);
    state.stage=2;state.round=2;director.beginPrep();director.resolveRound();
    const reports=state.players.filter(p=>p.racePlan!.recentCombat.sampleCount>0);
    expect(reports).toHaveLength(8);
    expect([...director.playerFrames.values()].every(f=>f.length===0)).toBe(true);
  });
  it('does not change PvP results or rewards when a seat is marked human',()=>{
    const setup=createMatch({seed:271,allAi:true});const initial=new RoundDirector(setup);
    setup.stage=4;setup.round=2;initial.beginPrep();
    for(const p of setup.players){
      expect(take(setup.pool,'super_creek',1)).toBe(true);
      const u=newInstance(setup,'super_creek',1);u.position={q:3,r:0};u.items=['iron_stable'];p.board.push(u);
      Object.assign(p.racePlan!,{planId:'RP_SLOW_STORE',evolutionId:'EV_STAMINA_BANK',finishingMoveId:'FM_STAYER',entryUnitDefId:u.unitDefId,entryUnitInstanceId:u.instanceId,offerPhase:'COMPLETE'});
    }
    const humanState=structuredClone(setup),aiState=structuredClone(setup);
    humanState.players[0].isHuman=true;aiState.players[0].isHuman=false;
    const viewed=new RoundDirector(humanState),headless=new RoundDirector(aiState);
    viewed.resolveRound();headless.resolveRound();
    expect(humanState.lastResolution).toEqual(aiState.lastResolution);
    const economic=(s:typeof setup)=>s.players.map(p=>({hp:p.hp,gold:p.gold,xp:p.xp,level:p.level,items:p.items,grants:p.pendingGrants,progress:p.augmentProgress}));
    expect(economic(humanState)).toEqual(economic(aiState));
    expect(viewed.lastHumanFrames?.length ?? 0).toBeGreaterThan(0);
    expect(headless.lastHumanFrames?.length ?? 0).toBe(0);
  });
  it('opens early entry at 30 HP without overlapping the augment round',()=>{
    const state=createMatch({seed:3});const p=state.players[0];p.racePlan!.planId='RP_SLOW_STORE';
    state.stage=4;state.round=3;p.hp=30;expect(racePlanOpensFor(state,p)).toBe('ENTRY');
    p.hp=31;expect(racePlanOpensFor(state,p)).toBeNull();
    p.hp=30;state.round=1;expect(racePlanOpensFor(state,p)).toBe('ENTRY');
    p.racePlan!.entryDeferred=true;expect(racePlanOpensFor(state,p)).toBeNull();p.racePlan!.entryDeferred=false;
    p.hp=10;state.round=2;expect(racePlanOpensFor(state,p)).toBeNull();
  });
  it('preserves pending race telemetry through a server restart and settles it once',()=>{
    const state=createMatch({seed:29,allAi:true});const d=new RoundDirector(state);state.stage=2;state.round=2;d.beginPrep();d.resolveRound(true);
    const restored=new RoundDirector(structuredClone(state));restored.restorePendingSettlement(JSON.parse(JSON.stringify(d.exportPendingSettlement())));
    d.settleRound();restored.settleRound();
    const reports=(s:typeof state)=>s.players.map(p=>p.racePlan!.recentCombat);
    expect(reports(restored.state)).toEqual(reports(state));
    expect(reports(state).every(r=>r.sampleCount===1)).toBe(true);
    restored.settleRound();expect(reports(restored.state)).toEqual(reports(state));
  });
  it('prints the actual +2 cast gain rather than saying every source grants +1',()=>{
    const text=describeEffects(findRacePlanNode('FM_SAVE_LEGS')!).join(' ');
    expect(text).toContain('스킬 사용마다 +2');
  });
  it('boosts only combat cues and defines nine distinct race cues',()=>{
    expect(soundPeakGain('hit')/soundPeakGain('augment')).toBeCloseTo(1.4545,3);
    expect(Object.keys(SOUND_DESIGNS).filter(k=>k.startsWith('race-'))).toHaveLength(9);
    expect(SOUND_DESIGNS['race-plan-hover'].duration).toBe(.05);
    expect(SOUND_DESIGNS['race-last3f'].duration).toBeLessThanOrEqual(.6);
  });
});
