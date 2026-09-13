import { describe, expect, it } from 'vitest';
import { BattleEngine, type BattleSideInput } from '../src/game/engine/battle/engine';
import { RaceResourceTracker } from '../src/game/engine/race-plan/runtime';
import { Rng } from '../src/game/engine/rng';
import { SOUND_DESIGNS, soundPeakGain } from '../src/game/ui/audio';
import { createMatch, RoundDirector } from '../src/game/engine/rounds/director';
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
