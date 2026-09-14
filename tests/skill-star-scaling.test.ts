import { describe, expect, it } from 'vitest';
import { BattleEngine, type BattleSideInput } from '../src/game/engine/battle/engine';
import { ALL_UNITS, ACTIVE_BY_COST } from '../src/game/engine/roster';
import { starSkillMultiplier, COST_SKILL_POWER } from '../src/game/engine/constants';
import { skillEffectValue, scaleSkillSupport, upgradeSkill } from '../src/game/engine/battle/skill-scaling';
import { stat } from '../src/game/engine/battle/combat-unit';
import { Rng } from '../src/game/engine/rng';
import type { Cost, EffectDef, Star } from '../src/game/engine/types';

/**
 * `ad` is the caster's attack damage *relative to its own baseline*, which is
 * what a physical cast scales on — the mirror of ability power against its
 * authored 100. Passing the baseline itself leaves physical casts at 1x, so the
 * damage-type-agnostic cases below still read the authored value.
 */
function cast(effects: EffectDef[], star: Star = 1, cost: Cost = 1, ap = 100, ad = 100): BattleEngine {
  const side = (id: string): BattleSideInput => ({ playerId: id, augments: [], tacticianItems: [], units: [{ instanceId: '0', unitDefId: ACTIVE_BY_COST[1][0].id, star: 1, items: [], position: { q: 3, r: 0 } }] });
  const engine = new BattleEngine(side('a'), side('b'), new Rng(91), { maxSeconds: .7, recordFrames: true });
  for (const [i,u] of engine.units.entries()) {
    u.role = 'AD_CARRY'; u.base.hp = 100000; u.base.armor = u.base.magicResist = 0;
    u.base.maxMana = 10000; u.base.startMana = i === 0 ? 10000 : 0;
    // Auto-attacks are already suppressed by the cooldown and the 0.7s cap, so
    // attack damage is free to carry the physical-scaling baseline.
    u.base.attackDamage = 100; u.base.attackSpeed = .1; u.base.attackRange = 4; u.attackCooldown = 20;
    u.cell = { q: 3, r: 3 + i };
    u.skill = { ...u.skill, effects: i === 0 ? effects : [], targetRule: 'CURRENT_TARGET', choreography: { windup: .1, recovery: .2, pulseInterval: .2, color: '#fff', variant: 'test' } };
  }
  const source = engine.units[0]; source.star = star; source.cost = cost;
  source.skillMultiplier = starSkillMultiplier(star, cost); source.base.abilityPower = ap;
  // Set after the baseline is captured, so the ratio is ad/100 exactly as ap/100.
  if (ad !== 100) source.modifiers.push({ stat: 'attackDamage', value: ad - 100, isMultiplier: false, expiresAt: 999 });
  engine.run(); return engine;
}
const damage = (engine: BattleEngine) => engine.frames.flatMap(f=>f.events).filter(e=>e.type==='DAMAGE' && e.source==='a#0').reduce((sum,e)=>sum+(e.type==='DAMAGE'?e.damage:0),0);

describe('cast potency and preview agree', () => {
  it.each(['MAGIC','TRUE'] as const)('scales %s skill damage once, including current AP', damageType => {
    const effect: EffectDef = { kind:'DAMAGE', value:200, damageType, target:'CURRENT_TARGET' };
    expect(damage(cast([effect]))).toBeCloseTo(200);
    expect(damage(cast([effect],2,1,150))).toBeCloseTo(435);
    expect(damage(cast([effect],3,5,150))).toBeCloseTo(1800);
  });

  it('scales PHYSICAL skill damage on attack damage, exactly as magic scales on AP', () => {
    const physical: EffectDef = { kind:'DAMAGE', value:200, damageType:'PHYSICAL', target:'CURRENT_TARGET' };
    const magic: EffectDef = { kind:'DAMAGE', value:200, damageType:'MAGIC', target:'CURRENT_TARGET' };
    // At baseline both read the authored value.
    expect(damage(cast([physical]))).toBeCloseTo(200);
    // Raising attack damage moves a physical cast by the same factor that
    // raising ability power moves a magic one. Without this an AD item improved
    // only a physical carry's auto-attacks while an AP item improved all of a
    // magic carry's output.
    expect(damage(cast([physical],2,1,100,150))).toBeCloseTo(damage(cast([magic],2,1,150)));
    expect(damage(cast([physical],3,5,100,150))).toBeCloseTo(damage(cast([magic],3,5,150)));
    // And the other stat does nothing to it: ability power leaves it alone.
    expect(damage(cast([physical],1,1,200,100))).toBeCloseTo(200);
  });
  it('scales max-health damage once rather than applying the flat support curve', () => {
    expect(damage(cast([{kind:'DAMAGE_MAXHP_PCT',value:.01,damageType:'TRUE',target:'CURRENT_TARGET'}],3,1,150))).toBeCloseTo(3300);
  });
  it('applies star and AP to flat shields and heals without double scaling', () => {
    const shield=cast([{kind:'SHIELD_FLAT',value:200,duration:4,target:'SELF'}],2,1,150);
    const event=shield.frames.flatMap(f=>f.events).find(e=>e.type==='SHIELD');
    expect(event?.type==='SHIELD' && event.amount).toBeCloseTo(435);
    const healed=cast([{kind:'DAMAGE',value:5000,damageType:'TRUE',target:'SELF'}, {kind:'HEAL',value:200,target:'SELF'}],2,1,150);
    expect(healed.units[0].hp).toBeCloseTo(100000-10875+435);
  });
  it('grows percent recovery without an AP or recipient-star multiplier on the percentage', () => {
    const e=cast([{kind:'DAMAGE',value:1000,damageType:'TRUE',target:'SELF'},{kind:'HEAL_MISSING_PCT',value:.25,target:'SELF'}],3,1,200);
    expect(e.units[0].hp).toBeCloseTo(100000-4400+4400*.375);
  });
  it('grows support buffs and stacking HP, keeps the stack ceiling and control timing', () => {
    const e=cast([{kind:'STAT_ADD',stat:'armor',value:20,target:'SELF',duration:4}, {kind:'STAT_MUL',stat:'attackSpeed',value:.3,target:'SELF',duration:4}, {kind:'STACKING_STAT',stat:'hp',value:70,maxStacks:4}],3,1);
    expect(stat(e.units[0],'armor',.5)).toBeCloseTo(30);
    expect(stat(e.units[0],'attackSpeed',.5)).toBeCloseTo(.145);
    expect(e.units[0].maxHp).toBeCloseTo(100105);
    for(const effect of [{kind:'APPLY_STATUS',status:'STUN',duration:1,target:'CURRENT_TARGET'}, {kind:'DASH',value:3}, {kind:'CLEANSE'}, {kind:'STAT_MUL',stat:'attackSpeed',value:-.25}] as EffectDef[]) expect(scaleSkillSupport(effect,3,5,300)).toEqual(effect);
  });
  it('does not star-scale item proc damage or apply AP twice to its coefficients', () => {
    const effect: EffectDef = {kind:'PROC_DAMAGE',value:100,scaling:{abilityPower:1},damageType:'TRUE',target:'CURRENT_TARGET'};
    expect(damage(cast([effect],1,1,150))).toBeCloseTo(250);
    expect(damage(cast([effect],3,5,150))).toBeCloseTo(250);
  });
  it('caps utility growth instead of allowing full invulnerability, full heals or infinite mana', () => {
    expect(scaleSkillSupport({kind:'DAMAGE_REDUCTION',value:.4},3,5,500).value).toBe(.5);
    expect(scaleSkillSupport({kind:'HEAL_MISSING_PCT',value:.5},3,5,500).value).toBe(.75);
    expect(scaleSkillSupport({kind:'MANA_ADD',value:20},3,5,500).value).toBe(30);
  });
  it('upgrades a hero skill immutably before star scaling', () => {
    const original=ALL_UNITS[0].skill, saved=structuredClone(original);
    const upgraded=upgradeSkill(original,{damageMultiplier:1.2,append:[{kind:'HEAL',value:100,target:'SELF'}]});
    expect(original).toEqual(saved);
    expect(skillEffectValue(upgraded.effects.at(-1)!,2,1,150)).toBeCloseTo(217.5);
  });
});

describe('roster and cost balance invariants', () => {
  it('all 145 skills gain meaningful potency at both promotions without mutating their motion', () => {
    expect(ALL_UNITS).toHaveLength(145);
    for(const unit of ALL_UNITS) {
      const before=JSON.stringify(unit.skill);
      const values=([1,2,3] as Star[]).map(s=>unit.skill.effects.map(e=>skillEffectValue(e,s,unit.cost)));
      for(let star=1;star<3;star++) expect(values[star].some((n,i)=>n!==undefined && n>(values[star-1][i]??Infinity)),unit.id).toBe(true);
      expect(JSON.stringify(unit.skill)).toBe(before);
    }
  });
  it('each higher cost gains base power and three-star 4/5-costs retain premium ceilings', () => {
    for(const star of [1,2,3] as Star[]) {
      const values=([1,2,3,4,5] as Cost[]).map(cost=>skillEffectValue({kind:'DAMAGE',value:200*COST_SKILL_POWER[cost]},star,cost)!);
      for(let i=1;i<values.length;i++) expect(values[i]/values[i-1]).toBeGreaterThan(1.1);
    }
    expect(skillEffectValue({kind:'STAT_MUL',stat:'attackSpeed',value:.3},3,5)).toBeCloseTo(.66);
    expect(skillEffectValue({kind:'STAT_MUL',stat:'attackSpeed',value:.3},3,1)).toBeCloseTo(.45);
  });
});
