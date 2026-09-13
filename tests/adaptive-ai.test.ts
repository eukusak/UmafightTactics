import { describe,it,expect } from 'vitest';
import { createMatch } from '../src/game/engine/rounds/director';
import { ALL_UNITS,getUnitDef,ALL_ITEM_DEFS,AUGMENT_DEFS,TRAIT_DEFS } from '../src/game/engine/roster';
import { newInstance } from '../src/game/engine/shop';
import { take,countInPlay,totalCopies } from '../src/game/engine/pool';
import { effectUtility,unitAugmentValue } from '../src/game/engine/ai/knowledge';
import { itemFit,lineupTraits,unitTraits,lineupScore } from '../src/game/engine/ai/evaluation';
import { chooseFieldedUnits,planPlacement } from '../src/game/engine/ai/placement';
import { retireItemHolders,assignItems } from '../src/game/engine/ai';
import { choosePlan } from '../src/game/engine/ai/strategy';
import { hexDistance } from '../src/game/engine/battle/hex';
const setup=()=>{const state=createMatch({seed:911,allAi:true});return {state,p:state.players[0]};};
describe('rule-aware adaptive AI',()=>{
  it('evaluates every authored unit/item/trait/augment effect with finite values',()=>{
    const {state,p}=setup();const unit=newInstance(state,'oguri_cap',2);
    for(const d of ALL_UNITS)for(const e of d.skill.effects)expect(Number.isFinite(effectUtility({...unit,unitDefId:d.id},e))).toBe(true);
    for(const d of [...ALL_ITEM_DEFS,...AUGMENT_DEFS])for(const e of 'effects' in d?d.effects:d.teamEffects)expect(Number.isFinite(effectUtility(unit,e))).toBe(true);
    for(const t of TRAIT_DEFS)for(const tier of t.tiers)for(const e of tier.effects)expect(Number.isFinite(effectUtility(unit,e))).toBe(true);
    for(const a of AUGMENT_DEFS)expect(Number.isFinite(unitAugmentValue(p,unit,new Map(),unitTraits(p,unit),a.id))).toBe(true);
  });
  it('values magnitudes and actual skill triggers rather than counting effects',()=>{
    const {state}=setup(),unit=newInstance(state,'oguri_cap',2);
    expect(effectUtility(unit,{kind:'DAMAGE_AMP',value:.3})).toBeGreaterThan(effectUtility(unit,{kind:'DAMAGE_AMP',value:.05}));
    expect(effectUtility(unit,{kind:'PROC_DAMAGE',value:100,trigger:{when:'ON_CAST'}})).toBeGreaterThan(effectUtility(unit,{kind:'PROC_DAMAGE',value:20,trigger:{when:'ON_CAST'}}));
  });
  it('invalidates selection when an augment or saved growth changes on the same player',()=>{
    // A peer comparison: both 1-cost supports, so the augment is what decides.
    // It used to be checked against a 1-star four-cost, which only worked while
    // the cost curve undervalued that tier — a grade-G augment worth +240hp at
    // full stacks should not out-value a whole cost tier.
    const {state,p}=setup();p.level=1;p.board=[];p.bench=[newInstance(state,'haru_urara',1),newInstance(state,'biko_pegasus',1)];
    expect(chooseFieldedUnits(p)[0].unitDefId).toBe('biko_pegasus');p.augments=['hero_haru_urara'];p.augmentProgress={hero_haru_urara:20};
    const a=chooseFieldedUnits(p),fresh=chooseFieldedUnits(structuredClone(p));
    expect(a.map(u=>u.instanceId)).toEqual(fresh.map(u=>u.instanceId));expect(a[0].unitDefId).toBe('haru_urara');
    const before=lineupScore(p,a);p.augmentProgress.hero_haru_urara=0;expect(lineupScore(p,a)).toBeLessThan(before);
  });
  it('recognizes equipment thresholds, item memory, and redundant emblem traits',()=>{
    const {state,p}=setup(),unit=newInstance(state,'oguri_cap',2);p.board=[unit];unit.items=['winner_ribbon'];
    const plain=itemFit(unit,'training_belt',p);p.augments=['equipment_pair'];expect(itemFit(unit,'training_belt',p)).toBeGreaterThan(plain);
    p.augments=['trophy_memory'];p.augmentProgress={trophy_memory:4};const enhanced=itemFit(unit,'champion_trophy',p);p.augments=[];expect(enhanced).toBeGreaterThan(itemFit(unit,'champion_trophy',p));
    const trait=unitTraits(p,unit).find(t=>ALL_ITEM_DEFS.some(i=>i.grantsTrait===t))!;
    const emblem=ALL_ITEM_DEFS.find(i=>i.grantsTrait===trait)!;expect(itemFit(unit,emblem.id,p)).toBeLessThan(itemFit(unit,emblem.id));
  });
  it('honors isolated augment positioning using real hex adjacency',()=>{
    const {state,p}=setup();p.level=3;p.board=['oguri_cap','gold_ship','agnes_tachyon'].map(id=>newInstance(state,id,2));
    p.augments=['combat_isolated'];const layout=planPlacement(p,true);
    expect(layout.some(a=>layout.every(b=>a===b||hexDistance(a.position,b.position)>1))).toBe(true);
  });
  it('releases temporary gear only after a stronger compatible replacement is fielded',()=>{
    const {state,p}=setup();p.board=[];p.bench=[];p.items=[];
    const low=ALL_UNITS.find(d=>d.activeS1&&d.cost===1&&d.role==='AD_CARRY')!,high=ALL_UNITS.find(d=>d.activeS1&&d.cost===5&&d.role==='AD_CARRY')!;
    for(const d of [low,high])expect(take(state.pool,d.id,3)).toBe(true);
    const old=newInstance(state,low.id,2),next=newInstance(state,high.id,2);old.items=['champion_trophy'];p.bench=[old];p.board=[next];
    const before=countInPlay(state.pool,state.players.flatMap(x=>[...x.board,...x.bench]));
    retireItemHolders(state,p);expect(p.bench).toHaveLength(0);expect(p.items.map(i=>i.itemId)).toContain('champion_trophy');
    assignItems(p);expect(next.items).toContain('champion_trophy');expect(countInPlay(state.pool,state.players.flatMap(x=>[...x.board,...x.bench]))).toBe(before);expect(before).toBe(totalCopies(state.seasonId));
  });
  it('changes its carry plan after a stronger item-compatible two-star is actually acquired',()=>{
    const {state,p}=setup();p.aiProfile='BALANCED';p.level=8;p.items=[];
    const low=ALL_UNITS.find(d=>d.activeS1&&d.cost===1&&d.role==='AD_CARRY')!,high=ALL_UNITS.find(d=>d.activeS1&&d.cost===4&&d.role==='AP_CARRY')!;
    p.board=[newInstance(state,low.id,1)];p.bench=[];p.aiPlan={carryId:low.id,mode:'REROLL_1',trait:getUnitDef(low.id).traits[0],decidedAt:21,pivots:0};
    const next=newInstance(state,high.id,2);next.items=['blue_focus','tactics_notebook'];p.bench=[next];
    const plan=choosePlan(p,5,1,[]);expect(plan.carryId).not.toBe(low.id);expect(plan.pivots).toBe(1);
    expect(lineupTraits(p,p.board).size).toBeGreaterThan(0);
  });
});
