import { describe, expect, it } from 'vitest';
import { createMatch, RoundDirector } from '../src/game/engine/rounds/director';
import { getSeasonUnits, getUnitDef, getUnitTraits } from '../src/game/engine/roster';
import { newInstance } from '../src/game/engine/shop';
import { take } from '../src/game/engine/pool';
import { chooseFieldedUnits, planPlacement } from '../src/game/engine/ai/placement';
import { assignItems, runAiPrep } from '../src/game/engine/ai';
import { itemFit, lineupScore } from '../src/game/engine/ai/evaluation';
import { choosePlan, draftValue, economyPlan, publicBoards } from '../src/game/engine/ai/strategy';
import { combine } from '../src/game/engine/items/item-defs';
import { Rng } from '../src/game/engine/rng';
import { contributionTotals } from '../src/game/ui/battle-playback';
import { shuffledTracks } from '../src/game/ui/audio';
import { pveScale } from '../src/game/engine/rounds/pve';
import { useGameStore } from '../src/store/gameStore';
import type { BattleFrame } from '../src/game/engine/battle/engine';
import { BattleEngine } from '../src/game/engine/battle/engine';
import { serializeMatch, restoreDirector } from '../src/game/engine/save';
function setup() { const state = createMatch({ seed: 971, allAi: true }); return { state, p: state.players[0], roster: getSeasonUnits(state.seasonId) }; }

describe('adaptive strategy and public-information formation', () => {
  it('keeps low-cost reroll at useful odds and pivots when a carry is heavily contested', () => {
    const { state, p, roster } = setup(); p.aiProfile = 'REROLL'; p.level = 5; p.gold = 70;
    const carry = roster.find(d => d.cost === 1 && d.role === 'AD_CARRY')!;
    p.board = [newInstance(state, carry.id, 2)];
    p.aiPlan = choosePlan(p, 3, 1, []);
    expect(p.aiPlan.mode).toBe('REROLL_1'); expect(p.aiPlan.carryId).toBe(carry.id);
    const budget = economyPlan(p, 3, 1, []); expect(budget.targetLevel).toBe(5); expect(budget.roll).toBe(true);
    const enemy = { id: 'rival', board: [newInstance(state, carry.id, 3), newInstance(state, carry.id, 3)] };
    const pivot = choosePlan(p, 3, 2, [enemy]); expect(pivot.carryId).not.toBe(carry.id); expect(pivot.pivots).toBe(1);
  });
  it('chooses midgame and late-game plans with distinct leveling decisions', () => {
    const { state, p, roster } = setup(); p.aiProfile = 'BALANCED'; p.level = 7; p.gold = 60;
    const carry = roster.find(d => d.cost === 3 && d.role === 'AP_CARRY')!;
    p.board = [newInstance(state, carry.id, 2), newInstance(state, carry.id, 1)];
    p.aiPlan = choosePlan(p, 4, 1, []); expect(p.aiPlan.mode).toBe('REROLL_3'); expect(economyPlan(p, 4, 1, []).targetLevel).toBe(7);
    p.aiProfile = 'FAST_LEVEL'; p.board = []; p.aiPlan = undefined;
    p.aiPlan = choosePlan(p, 3, 1, []); expect(p.aiPlan.mode).toBe('FAST_9'); expect(getUnitDef(p.aiPlan.carryId).cost).toBeGreaterThanOrEqual(4);
    expect(economyPlan(p, 5, 1, []).targetLevel).toBe(9);
  });
  it('ignores opponents hidden shops, benches and remaining pool when deciding a strategy', () => {
    const { state, p } = setup();
    const before = choosePlan(p, 3, 1, publicBoards(state, p));
    for (const other of state.players.slice(1)) { other.gold = 999; other.shop = []; other.bench = []; }
    state.pool.remaining = {}; state.rngStates = {};
    expect(choosePlan(p, 3, 1, publicBoards(state, p))).toEqual(before);
  });
  it('scores a full lineup including overlapping distinct-unit traits', () => {
    const { state, p, roster } = setup(); p.level = 4;
    p.bench = roster.slice(0, 9).map(d => newInstance(state, d.id, 1));
    const selected = chooseFieldedUnits(p);
    expect(selected).toHaveLength(4);
    for (const spare of p.bench.filter(u => !selected.includes(u))) for (let i = 0; i < selected.length; i++) {
      const swap = selected.slice(); swap[i] = spare;
      expect(lineupScore(p, selected)).toBeGreaterThanOrEqual(lineupScore(p, swap) - .01);
    }
    expect(new Set(selected.map(u => u.unitDefId)).size).toBe(4);
  });
  it('crafts AD, AP and tank items on appropriate fielded units', () => {
    const { state, p, roster } = setup(); p.level = 3;
    p.board = ['AD_CARRY', 'AP_CARRY', 'TANK'].map(role => newInstance(state, roster.find(d => d.role === role)!.id, 2));
    p.items = ['winner_ribbon','winner_ribbon','tactics_notebook','tactics_notebook','training_belt','training_belt'].map((itemId,i) => ({instanceId:`it${i}`,itemId}));
    assignItems(p);
    for (const [i, component] of ['winner_ribbon','tactics_notebook','training_belt'].entries()) expect(p.board[i].items).toContain(combine(component, component));
    expect(p.items).toHaveLength(0);
    expect(itemFit(p.board[0], 'champion_trophy')).toBeGreaterThan(itemFit(p.board[2], 'champion_trophy'));
  });
  it('values a carousel item completing carry gear over an unrelated expensive body', () => {
    const { state, p, roster } = setup();
    const carry = roster.find(d => d.role === 'AD_CARRY' && d.cost <= 2)!;
    p.board = [newInstance(state, carry.id, 2)]; p.items = [{instanceId:'ad',itemId:'winner_ribbon'}];
    p.aiPlan = {mode:'REROLL_2',carryId:carry.id,trait:getUnitTraits(carry.id,p.seasonId)[0],decidedAt:21,pivots:0};
    const useful = {index:0,unitDefId:carry.id,itemId:'winner_ribbon',takenBy:null};
    const expensive = {index:1,unitDefId:roster.find(d=>d.cost===5 && d.role==='AP_CARRY')!.id,itemId:'tactics_notebook',takenBy:null};
    expect(draftValue(p,useful)).toBeGreaterThan(draftValue(p,expensive));
  });
  it('puts tanks ahead of ranged carries and moves to reflect public threats', () => {
    const {state,p,roster}=setup(); p.level=3;
    p.board=['TANK','AD_CARRY','AP_CARRY'].map(role=>newInstance(state,roster.find(d=>d.role===role && (role==='TANK'||d.attackRange>=3))!.id,2));
    const foe=newInstance(state,roster.find(d=>d.role==='AD_CARRY'&&d.attackRange>=3)!.id,3);foe.position={q:0,r:3};
    const a=planPlacement(p,true,[{id:'foe',board:[foe]}]);foe.position={q:6,r:3};
    const b=planPlacement(p,true,[{id:'foe',board:[foe]}]);
    expect(a).not.toEqual(b);expect(new Set(a.map(s=>`${s.position.q},${s.position.r}`)).size).toBe(3);
    expect(a.find(s=>s.instanceId===p.board[0].instanceId)!.position.r).toBe(0);
    expect(a.find(s=>s.instanceId===p.board[1].instanceId)!.position.r).toBe(3);
  });
  it('preserves the plan through saves and never gets extra economy turns during scouting', () => {
    const {state,p}=setup(); p.gold=75; state.stage=3;state.round=2;state.phase='ROUND_PREP';
    runAiPrep(state,p,new Rng(22)); const d=new RoundDirector(state);
    const before=[p.gold,p.xp,JSON.stringify(state.pool.remaining)];
    d.refreshAiPlacements();d.refreshAiPlacements();expect([p.gold,p.xp,JSON.stringify(state.pool.remaining)]).toEqual(before);
    expect(restoreDirector(serializeMatch(d)).state.players[0].aiPlan).toEqual(p.aiPlan);
  });
});

describe('battle recap and music',()=>{
  it('separates dealt, taken and generated shields without exposing future events',()=>{
    const frames:BattleFrame[]=[{t:0,overtime:false,units:[],events:[{t:0,type:'SHIELD',source:'support',target:'tank',amount:300}]},{t:1,overtime:false,units:[],events:[{t:1,type:'DAMAGE',isSkill:false,source:'enemy',target:'tank',damage:20,absorbed:100}]},{t:2,overtime:false,units:[],events:[{t:2,type:'DAMAGE',isSkill:false,source:'tank',target:'enemy',damage:999,absorbed:0}]}];
    expect(contributionTotals(frames,1,'shield').get('support')).toBe(300);
    expect(contributionTotals(frames,1,'taken').get('tank')).toBe(120);
    expect(contributionTotals(frames,1,'dealt').get('enemy')).toBe(120);
    expect(contributionTotals(frames,1,'dealt').has('tank')).toBe(false);
  });
  it('records generated shields from the actual effect pipeline',()=>{
    const {roster}=setup(); const tank=roster.find(d=>d.skill.effects.some(e=>e.kind.startsWith('SHIELD')))!;
    const side=(id:string)=>({playerId:id,units:[{instanceId:'u',unitDefId:tank.id,star:2 as const,items:[],position:{q:3,r:0}}],augments:[],tacticianItems:[]});
    const engine=new BattleEngine(side('a'),side('b'),new Rng(9),{recordFrames:true});engine.run();
    const totals=contributionTotals(engine.frames,1000,'shield');expect([...totals.values()].reduce((a,b)=>a+b,0)).toBeGreaterThan(0);
  });
  it('retains a completed battle through the next preparation and resets for a new match',()=>{
    useGameStore.getState().newMatch(333);const s=useGameStore.getState();s.director!.state.draft=null;s.director!.state.phase='ROUND_PREP';
    const p=s.human()!,d=getSeasonUnits()[0];take(s.match!.pool,d.id,1);p.bench.push(newInstance(s.match!,d.id,1));
    s.startBattle();useGameStore.getState().completeBattle();const frames=useGameStore.getState().battleFrames;
    useGameStore.getState().setBattleTime(.4);
    expect(useGameStore.getState().battleTime).toBe(frames!.at(-1)!.t);
    useGameStore.getState().finishBattle();expect(useGameStore.getState().battleFrames === frames).toBe(true);
    useGameStore.getState().setBattleTime(.4);
    expect(useGameStore.getState().battleTime).toBe(frames!.at(-1)!.t);
    useGameStore.getState().newMatch(334);expect(useGameStore.getState().battleFrames).toBeNull();
  });
  it('shuffles every available song exactly once and avoids adjacent cycle repeats',()=>{
    const GAME_TRACKS = Array.from({length:23},(_,i)=>`bgm${i}.mp3`);
    const rng=new Rng(87),first=shuffledTracks(GAME_TRACKS,'',()=>rng.next()),next=shuffledTracks(GAME_TRACKS,first.at(-1),()=>rng.next());
    expect(new Set(first)).toEqual(new Set(GAME_TRACKS));expect(first).not.toEqual(GAME_TRACKS);expect(next[0]).not.toBe(first.at(-1));
  });
  it('softens only the stage 4 and stage 5 encounters',()=>{
    expect(pveScale(4)).toBeCloseTo(1.84*.88);expect(pveScale(5)).toBeCloseTo(2.12*.9);expect(pveScale(6)).toBeCloseTo(2.4);
  });
});
