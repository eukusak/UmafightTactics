import { describe, expect, it } from 'vitest';
import { createMatch } from '../src/game/engine/rounds/director';
import { ALL_UNITS, getUnitDef } from '../src/game/engine/roster';
import { AUGMENT_DEFS } from '../src/game/engine/augments/augment-defs';
import { getItem } from '../src/game/engine/items/item-defs';
import { describeEffect, matchSkillDescription, matchItemDescription } from '../src/game/ui/match-descriptions';
import { skillEffectValue } from '../src/game/engine/battle/skill-scaling';

const owner=()=>createMatch({seed:883}).players[0];
describe('match-specific descriptions',()=>{
  it('replaces a promoted hero skill explanation with the resolved added effect and saved growth',()=>{
    const p=owner();p.augments=['hero_haru_urara'];p.augmentProgress={hero_haru_urara:6};
    const d=getUnitDef('haru_urara'),before=JSON.stringify(d);
    const result=matchSkillDescription(d,p,{star:2});
    expect(result.description).toContain('잃은 체력 18% 회복');
    expect(result.changes.join(' ')).toContain('6/20중첩');expect(result.changes.join(' ')).toContain('다음 전투 +72');
    expect(result.description).not.toContain('1명 획득');expect(JSON.stringify(d)).toBe(before);
    expect(matchSkillDescription(getUnitDef('oguri_cap'),p).changes).toEqual([]);
  });
  it('describes amplified damage and added silence using the same upgraded skill as combat',()=>{
    const p=owner();p.augments=['hero_silence_suzuka'];const d=getUnitDef('silence_suzuka');
    const result=matchSkillDescription(d,p,{star:2,abilityPower:150});
    const i=d.skill.effects.findIndex(e=>e.kind==='DAMAGE');
    expect(result.skill.effects[i].value).toBeCloseTo(d.skill.effects[i].value!*1.2);
    const expected=Number(skillEffectValue(result.skill.effects[i],2,d.cost,150)!.toFixed(2));
    expect(result.description).toContain(String(expected));expect(result.description).toContain('침묵 (2초)');
  });
  it('keeps shared augment procs and stat bonuses out of the authored skill explanation',()=>{
    const p=owner();p.augments=['spell_jewel','spell_echo','spell_wound'];
    const def=getUnitDef('oguri_cap'), result=matchSkillDescription(def,p,{star:3,abilityPower:300});
    expect(result.changes).toEqual([]); expect(result.description).toBe(def.skill.description);
    expect(p.augments).toEqual(['spell_jewel','spell_echo','spell_wound']);
    expect(matchItemDescription('champion_trophy',p).changes).toEqual([]);
  });
  it('shows item retention and mastery only to that owner, clamps saved stacks, and keeps base data unchanged',()=>{
    const p=owner(),other=owner();p.augments=['trophy_memory','trophy_mastery'];p.augmentProgress={trophy_memory:3};
    const item=getItem('champion_trophy'),before=JSON.stringify(item);
    const text=matchItemDescription(item.id,p).description;
    expect(text).toContain('3/4중첩');expect(text).toContain('공격력 +18%');expect(text).toContain('처치 관여 시 자신 잃은 체력 15% 회복');
    expect(text).not.toContain('전투당 최대');expect(matchItemDescription(item.id,other).description).toBe(item.description);
    expect(matchItemDescription(item.id).description).toBe(item.description);expect(JSON.stringify(item)).toBe(before);
    p.augmentProgress.trophy_memory=99;expect(matchItemDescription(item.id,p).description).toContain('4/4중첩');
    expect(matchItemDescription('start_dash_plan',p).changes).toEqual([]);
    p.augments=[];expect(matchItemDescription(item.id,p).description).toBe(item.description);
  });
  it('shows the matching hero upgrade but excludes common, trait and equipment bonuses',()=>{
    const p=owner();p.augments=['equipment_pair','trait_oikomi','combat_last_stand','hero_haru_urara','spell_jewel'];
    const d=getUnitDef('oguri_cap');
    expect(matchSkillDescription(d,p,{items:['winner_ribbon','training_belt'],traits:['oikomi']}).changes).toEqual([]);
    const own=matchSkillDescription(getUnitDef('haru_urara'),p);
    expect(own.changes).toHaveLength(1);expect(own.changes[0]).toContain('전용 스킬 강화');
    expect(own.changes[0]).not.toContain('스킬 치명타');
  });
  it('can describe every current roster skill and every augment combat effect without falling back to raw identifiers',()=>{
    for(const u of ALL_UNITS) for(const e of u.skill.effects) expect(describeEffect(e),u.id+':'+e.kind).not.toBe('');
    for(const a of AUGMENT_DEFS) for(const e of [...a.teamEffects,...(a.skillUpgrade?.append??[])]) expect(describeEffect(e),a.id+':'+e.kind).not.toBe('');
  });
});
