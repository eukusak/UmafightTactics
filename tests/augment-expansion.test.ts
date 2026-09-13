import { describe, expect, it } from 'vitest';
import { createMatch, RoundDirector } from '../src/game/engine/rounds/director';
import { applyAugment, createAugmentOffers, matchAugmentGrades, rollAugmentOptions, AUGMENT_SEQUENCES } from '../src/game/engine/augments/offers';
import { getAugment } from '../src/game/engine/augments/augment-defs';
import { EXPANSION_AUGMENTS } from '../src/game/engine/augments/expansion';
import { combatProgress } from '../src/game/engine/augments/runtime';
import { BattleEngine, type BattleSideInput } from '../src/game/engine/battle/engine';
import { stat } from '../src/game/engine/battle/combat-unit';
import { Rng } from '../src/game/engine/rng';
import { getSeasonUnits, getUnitDef, TRAIT_DEFS } from '../src/game/engine/roster';
import { SEASON_IDS, SEASON_TRAIT_DEFS } from '../src/game/engine/seasons/catalog';
import { chooseAiAugment } from '../src/game/engine/ai/augment-choice';
import { choosePlan, economyPlan } from '../src/game/engine/ai/strategy';
import { newInstance } from '../src/game/engine/shop';
import { take, countInPlay, totalCopies } from '../src/game/engine/pool';
import { heldUnits } from '../src/game/engine/rounds/director';
import { serializeMatch, restoreDirector } from '../src/game/engine/save';

const side = (playerId: string, id: string, augments: string[] = [], items: string[] = []): BattleSideInput => ({ playerId, augments, tacticianItems: [], units: [{ instanceId: 'u', unitDefId: id, star: 2, items, position: { q: 3, r: 0 } }] });

describe('match-wide augment sequence', () => {
  it('allows GGG and PPP, excludes SSS, shares grades and survives save/load', () => {
    expect(AUGMENT_SEQUENCES.reduce((n,r)=>n+r.weight,0)).toBe(100);
    const seen = new Set<string>();
    for (let seed = 1; seed <= 1000; seed++) {
      const state = createMatch({ seed }); const grades = matchAugmentGrades(state); seen.add(grades.join(''));
      expect(grades.join('')).not.toBe('SSS');
      state.stage = 2;
      expect(new Set(createAugmentOffers(state,new Rng(seed)).map(o=>o.grade))).toEqual(new Set([grades[0]]));
      if (seed === 1) expect(matchAugmentGrades(restoreDirector(serializeMatch(new RoundDirector(state))).state)).toEqual(grades);
    }
    expect(seen.has('GGG')).toBe(true); expect(seen.has('PPP')).toBe(true);
  });
  it('preserves the grades already picked in a legacy save', () => {
    const state = createMatch({ seed: 42 }); state.players[0].augments = ['crit_small', 'combat_first_cast'];
    expect(matchAugmentGrades(state).slice(0,2)).toEqual(['S','G']);
  });
  it.each(SEASON_IDS)('offers only season-available hero augments in %s', seasonId => {
    const p = createMatch({ seed: 2, seasonId }).players[0], roster = new Set(getSeasonUnits(seasonId).map(u=>u.id));
    for (const grade of ['S','G','P'] as const) for(let seed=0;seed<100;seed++) {
      const ids=rollAugmentOptions(p,grade,new Rng(seed)); expect(ids).toHaveLength(3); expect(new Set(ids).size).toBe(3);
      for(const id of ids) { const aug=getAugment(id); expect(aug.grade).toBe(grade); for(const hero of aug.filter?.unitIds ?? []) expect(roster.has(hero)).toBe(true); }
    }
  });
});
describe('hero skill and item progression', () => {
  it.each(EXPANSION_AUGMENTS.filter(a=>a.skillUpgrade))('$id modifies only its owner and leaves shared skill definitions intact', aug => {
    const id=aug.filter!.unitIds![0], original=structuredClone(getUnitDef(id).skill);
    const engine=new BattleEngine(side('a',id,[aug.id]),side('b',id),new Rng(5));
    expect(engine.units[0].skill.effects.length).toBe(original.effects.length+(aug.skillUpgrade?.append?.length??0));
    expect(engine.units[1].skill).toEqual(original); expect(getUnitDef(id).skill).toEqual(original);
    const result=engine.run(); expect(result.events.some(e=>e.type==='CAST' && e.source==='a#u')).toBe(true);
  });
  it('grants a hero from the shared pool exactly once, with full-bench gold fallback', () => {
    const state=createMatch({seed:8}), p=state.players[0], id='hero_haru_urara';
    applyAugment(state,p,id,new Rng(1)); const count=p.bench.length;
    applyAugment(state,p,id,new Rng(1)); expect(p.bench.length).toBe(count);
    expect(countInPlay(state.pool,heldUnits(state))).toBe(totalCopies(state.seasonId));
    p.bench=Array.from({length:20},()=>newInstance(state,'gold_ship',1)); const gold=p.gold;
    applyAugment(state,p,'hero_rice_shower',new Rng(1)); expect(p.gold).toBe(gold+getUnitDef('rice_shower').cost);
  });
  it('retains actual item counters and caps further growth in the next battle', () => {
    const input=side('a','gold_ship',['cast_memory'],['start_dash_plan']);
    const engine=new BattleEngine(input,side('b','tm_opera_o'),new Rng(18));
    engine.units[0].mana=999; engine.units[1].hp=engine.units[1].maxHp=100000;
    const result=engine.run(); const progress=combatProgress(input.augments,{},[engine.units[0]],result.events);
    expect(progress.cast_memory).toBeGreaterThan(0); expect(progress.cast_memory).toBeLessThanOrEqual(4);
    const next=new BattleEngine({...input,augmentProgress:progress},side('b','tm_opera_o'),new Rng(18));
    expect(stat(next.units[0],'attackDamage',0)).toBeGreaterThan(stat(new BattleEngine(input,side('b','tm_opera_o'),new Rng(18)).units[0],'attackDamage',0));
    next.units[0].mana=999; next.units[1].hp=next.units[1].maxHp=100000;
    const again=next.run(); expect(combatProgress(input.augments,progress,[next.units[0]],again.events).cast_memory).toBeLessThanOrEqual(4);
  });
  it('caps training per round and in total', () => {
    const engine=new BattleEngine(side('a','haru_urara',['hero_haru_urara']),side('b','gold_ship'),new Rng(2));
    const events=Array.from({length:20},()=>({t:1,type:'CAST' as const,source:'a#u',skill:'x'}));
    expect(combatProgress(['hero_haru_urara'],{},[engine.units[0]],events).hero_haru_urara).toBe(3);
    expect(combatProgress(['hero_haru_urara'],{hero_haru_urara:19},[engine.units[0]],events).hero_haru_urara).toBe(20);
  });
  it('commits growth once after deferred PvP settlement and retains it after resume', () => {
    const state=createMatch({seed:71}), director=new RoundDirector(state); state.stage=2; state.round=2; state.phase='ROUND_PREP';
    const p=state.players[0]; p.augments=['hero_haru_urara']; p.aiProfile=null;
    expect(take(state.pool,'haru_urara',1)).toBe(true); const unit=newInstance(state,'haru_urara',1); unit.position={q:3,r:0}; p.board=[unit];
    director.resolveRound(true); expect(p.augmentProgress).toBeUndefined();
    const pending=director.exportPendingSettlement()!; pending.augmentProgress={[p.id]:{hero_haru_urara:3}};
    const restored=new RoundDirector(structuredClone(state)); restored.restorePendingSettlement(pending); restored.settleRound();
    expect(restored.state.players[0].augmentProgress?.hero_haru_urara).toBe(3); restored.settleRound();
    expect(restored.state.players[0].augmentProgress?.hero_haru_urara).toBe(3);
    expect(restoreDirector(serializeMatch(restored)).state.players[0].augmentProgress?.hero_haru_urara).toBe(3);
  });
});
describe('authoritative augment round rewards', () => {
  const setup = (pve: boolean, augments: string[]) => {
    const state = createMatch({ seed: 221 });
    state.stage = 2; state.round = pve ? 7 : 2; state.phase = 'ROUND_PREP';
    for (const p of state.players) {
      p.aiProfile = null; p.level = 5;
      p.augments = augments;
      const id = 'haru_urara';
      expect(take(state.pool, id, 1)).toBe(true);
      const unit = newInstance(state, id, 1);
      unit.items = ['start_dash_plan'];
      unit.position = { q: 3, r: 0 }; p.board = [unit];
    }
    return new RoundDirector(state);
  };
  it('records casts from actual PvP simulation, not PvE, before saving and settling once', () => {
    for (const pve of [false, true]) {
      const d = setup(pve, ['hero_haru_urara', 'cast_memory']);
      // Use the real generated combat events; no synthetic settlement progress.
      d.resolveRound(true);
      const pending = d.exportPendingSettlement()!;
      if (pve) expect(Object.keys(pending.augmentProgress ?? {})).toHaveLength(0);
      else expect(Object.values(pending.augmentProgress ?? {}).some(p => p.hero_haru_urara > 0 && p.cast_memory > 0)).toBe(true);
      const restored = new RoundDirector(structuredClone(d.state));
      restored.restorePendingSettlement(pending);
      restored.settleRound();
      const once = structuredClone(restored.state.players.map(p=>p.augmentProgress));
      restored.settleRound();
      expect(restored.state.players.map(p=>p.augmentProgress)).toEqual(once);
      expect(restoreDirector(serializeMatch(restored)).state.players.map(p=>p.augmentProgress)).toEqual(once);
      if (pve) expect(once.every(p=>p === undefined)).toBe(true);
      else expect(once.some(p=>(p?.hero_haru_urara ?? 0)>0)).toBe(true);
    }
  });
  it('awards empty-bench XP only in PvP and only once, using the combat-start bench', () => {
    for (const pve of [false, true]) {
      const base = setup(pve, []), bonus = setup(pve, ['clear_stable']);
      base.resolveRound(true); bonus.resolveRound(true);
      // A delayed settlement must not change eligibility when bench contents change.
      bonus.state.players[0].bench.push(newInstance(bonus.state, 'gold_ship', 1));
      base.settleRound(); bonus.settleRound();
      expect(bonus.state.players[0].xp - base.state.players[0].xp).toBe(pve ? 0 : 2);
      const xp = bonus.state.players[0].xp;
      bonus.settleRound(); expect(bonus.state.players[0].xp).toBe(xp);
    }
  });
});
describe('styles, traits and AI strategy', () => {
  it('corrects Gran Alegria without changing the eight legendary costs', () => {
    expect(getUnitDef('gran_alegria').source.primaryStyle).toBe('senko'); expect(getUnitDef('gran_alegria').cost).toBe(4);
    for(const s of SEASON_IDS) expect(getSeasonUnits(s).filter(u=>u.cost===5)).toHaveLength(8);
  });
  it('has no movement-speed trait bonuses', () => {
    for(const trait of [...TRAIT_DEFS,...SEASON_TRAIT_DEFS]) for(const tier of trait.tiers) expect(tier.effects.some(e=>e.stat==='moveSpeedHexPerSec')).toBe(false);
  });
  it('AI chooses an invested hero over irrelevant equipment and keeps the carry plan', () => {
    const state=createMatch({seed:1}),p=state.players[0]; p.aiProfile='REROLL'; p.level=5;
    const u=newInstance(state,'gold_ship',2);u.position={q:3,r:0};p.board=[u];
    expect(chooseAiAugment(p,['item_reforge','hero_gold_ship'],3)).toBe('hero_gold_ship');
    p.augments=['hero_gold_ship']; expect(choosePlan(p,3,2,[]).carryId).toBe('gold_ship');
  });
  it('AI exits an unfinished low-cost reroll in late game but gives seven copies one more stage', () => {
    const state=createMatch({seed:1}),p=state.players[0]; p.aiProfile='REROLL'; p.level=6; p.augments=['hero_gold_ship'];
    p.board=[{...newInstance(state,'gold_ship',2),position:{q:3,r:0}}];
    expect(choosePlan(p,5,1,[]).mode).toBe('FAST_8');
    p.bench=[newInstance(state,'gold_ship',2),newInstance(state,'gold_ship',1)];
    expect(choosePlan(p,5,1,[]).mode).toMatch(/^REROLL/);
    expect(choosePlan(p,6,1,[]).mode).toBe('FAST_8');
  });
  it('AI keeps a damage carry when a supporting hero receives an augment', () => {
    const state=createMatch({seed:1}),p=state.players[0];p.aiProfile='REROLL';p.augments=['hero_haru_urara'];
    p.board=[{...newInstance(state,'gold_ship',2),position:{q:3,r:0}},{...newInstance(state,'haru_urara',2),position:{q:2,r:0}}];
    expect(choosePlan(p,3,1,[]).carryId).not.toBe('haru_urara');
  });
  it('AI spends to contest a nearly completed carry instead of always holding 50 gold', () => {
    const state=createMatch({seed:1}),p=state.players[0];p.hp=55;p.level=6;p.aiProfile='REROLL';
    p.aiPlan={mode:'REROLL_2',carryId:'gold_ship',trait:'oikomi',decidedAt:32,pivots:0};
    p.bench=[newInstance(state,'gold_ship',2),newInstance(state,'gold_ship',2),newInstance(state,'gold_ship',1)];
    expect(economyPlan(p,3,3,[]).rollFloor).toBe(20);
  });
});
