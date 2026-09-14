/** Bounded estimates from public definitions, not a prediction of hidden combat. */
import { getUnitDef } from '../roster';
import { getItem } from '../items/item-defs';
import { getAugment } from '../augments/augment-defs';
import { augmentApplies, augmentEffects } from '../augments/runtime';
import { skillEffectValue } from '../battle/skill-scaling';
import type { PlayerState, UnitInstance } from '../state';
import type { AugmentDef, BattleStats, EffectDef, TraitId } from '../types';
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const kitCache=new Map<string,{spell:number;magic:number;casts:number;front:boolean;support:boolean}>();
export function kitProfile(unit:UnitInstance) {
  const cached=kitCache.get(unit.unitDefId);if(cached)return cached;
  const d=getUnitDef(unit.unitDefId), effects=d.skill.effects.filter(e=>e.kind==='DAMAGE'||e.kind==='DAMAGE_MAXHP_PCT');
  const amount=(e:EffectDef)=>(e.kind==='DAMAGE_MAXHP_PCT'?(e.value??0)*1500:e.value??0);
  const raw=effects.reduce((n,e)=>n+amount(e),0);
  const result={spell:clamp(raw/Math.max(100,d.attackDamage*d.attackSpeed*5),.15,2),magic:raw?effects.filter(e=>e.damageType!=='PHYSICAL').reduce((n,e)=>n+amount(e),0)/raw:0,
    casts:clamp(70/d.maxMana,.45,1.8),front:d.attackRange<=1||d.role==='TANK',support:d.skill.effects.some(e=>e.kind.startsWith('HEAL')||e.kind.startsWith('SHIELD'))};
  kitCache.set(unit.unitDefId,result);return result;
}
export function statUtility(unit:UnitInstance,stat:keyof BattleStats,value:number,percent=false):number {
  const d=getUnitDef(unit.unitDefId),k=kitProfile(unit),v=percent?value*d[stat]:value;
  const weights:Record<keyof BattleStats,number>={hp:(k.front?1.25:.8)/130,attackDamage:(d.role==='AD_CARRY'?1.4:1)/14,abilityPower:(k.spell+(k.support?.5:0))/20,armor:(k.front?1.3:.7)/12,magicResist:(k.front?1.3:.7)/12,attackSpeed:5,startMana:k.casts/8,maxMana:-k.casts/8,attackRange:1,moveSpeedHexPerSec:.2,critChance:8,critMultiplier:3};
  return v*weights[stat];
}
// Catalogue effects are immutable. Ephemeral scaled effects are weakly held.
const effectCache=new WeakMap<EffectDef,Map<string,number>>();
export function effectUtility(unit:UnitInstance,e:EffectDef):number {
  let byUnit=effectCache.get(e);if(!byUnit){byUnit=new Map();effectCache.set(e,byUnit);}
  const cached=byUnit.get(unit.unitDefId);if(cached!==undefined)return cached;
  const value=estimateEffect(unit,e);byUnit.set(unit.unitDefId,value);return value;
}
function estimateEffect(unit:UnitInstance,e:EffectDef):number {
  const d=getUnitDef(unit.unitDefId),k=kitProfile(unit),v=e.value??0;
  const damage=(v+(e.scaling?.attackDamage??0)*d.attackDamage+(e.scaling?.abilityPower??0)*d.abilityPower+(e.scaling?.armor??0)*d.armor+(e.scaling?.selfMaxHp??0)*d.hp+(e.scaling?.targetCurrentHp??0)*1000+(e.scaling?.targetMissingHp??0)*500)/90;
  let score=0;
  switch(e.kind) {
    case 'STAT_ADD':score=e.stat?statUtility(unit,e.stat,v):0;break;
    case 'STAT_MUL':score=e.stat?statUtility(unit,e.stat,v,true):0;break;
    case 'STACKING_STAT':score=e.stat?statUtility(unit,e.stat,v,e.tag==='PCT')*Math.min(e.maxStacks??4,3):0;break;
    case 'DAMAGE':case 'PROC_DAMAGE':case 'ON_HIT_DAMAGE':case 'SPLASH_ON_HIT':case 'SPELLBLADE':score=damage;break;
    case 'DAMAGE_MAXHP_PCT':case 'BURN':score=v*18;break;
    case 'HEAL':case 'SHIELD_FLAT':score=v/120;break;
    case 'HEAL_MISSING_PCT':case 'HEAL_MAXHP_PCT':case 'SHIELD_MAXHP_PCT':score=v*(k.front?12:8);break;
    case 'MANA_ADD':case 'ON_HIT_MANA':score=(e.tag==='MAX_MANA_FRACTION'?v*d.maxMana:v)*k.casts/8;break;
    case 'MANA_MAX_ADD':score=-v*k.casts/8;break;
    case 'MANA_DRAIN':score=v/10;break;
    case 'DAMAGE_AMP':score=v*12;break;
    case 'SKILL_DAMAGE_AMP':score=v*8*k.spell;break;
    case 'DAMAGE_REDUCTION':score=v*(k.front?16:9);break;
    case 'OMNIVAMP':score=v*(k.front?16:10);break;
    case 'CRIT_DAMAGE_ADD':score=v*4;break;
    case 'CRIT_CHANCE_ADD':score=v*8;break;
    case 'SKILLS_CAN_CRIT':score=k.spell*1.5;break;
    case 'SUNDER_ARMOR_PCT':score=v*8;break;
    case 'SHRED_MR_PCT':score=v*(4+5*k.magic);break;
    case 'WOUND':score=1.8;break;
    case 'APPLY_STATUS':score=(e.duration??1)*.9;break;
    case 'CC_RESIST':score=v*5;break;
    case 'CC_IMMUNE':case 'UNTARGETABLE':score=Math.min(4,e.duration??4)*.6;break;
    case 'EXECUTE_THRESHOLD':score=v*15;break;
    case 'REVIVE':score=2+v*4;break;
    case 'SURVIVE_LETHAL':score=2.5;break;
    case 'HEAL_SHIELD_AMP':score=v*(k.front?9:5);break;
    case 'SHIELD_DAMAGE_AMP':score=v*6;break;
    case 'ATTACK_SPEED_CAP_ADD':score=v*(d.role==='AD_CARRY'?2:.3);break;
    case 'MANA_LOCK':score=Math.min(3,e.duration??1)*.5;break;
    case 'TAUNT':score=k.front?1.5:.2;break;
    case 'DASH':score=d.attackRange<=1?1:.3;break;
    case 'CLEANSE':score=1.2;break;
    case 'SUMMON':score=v/100;break;
    // A free re-release is worth about as much as the unit's whole spell, so it
    // is priced off the kit's spell share rather than as a flat bonus.
    case 'RECAST_SKILL':score=3+k.spell*7;break;
    // Filling the bar is one extra cast's worth of cadence, times how much this
    // unit actually gets out of casting.
    case 'MANA_FILL':score=(1.5+k.casts*2.5)*(v||1);break;
    // A conversion only pays for the excess it hands back; below a cap of 1 it
    // is a straight loss, and the AI should see that.
    case 'CONVERT_STAT':score=v*((e.scaling?.cap??1)-1)*6;break;
    default:{const exhaustive:never=e.kind;return exhaustive;}
  }
  if((e.kind==='STAT_ADD'||e.kind==='STAT_MUL') && e.target && ['CURRENT_TARGET','ALL_ENEMIES','HIGHEST_AD_ENEMY','NEAREST_ENEMY','FARTHEST_ENEMY'].includes(e.target))score=-score;
  const when=e.trigger?.when;
  if(when==='ON_CAST'||when==='ON_SUPPORT_SKILL')score*=k.casts*(when==='ON_SUPPORT_SKILL'&&!k.support?.1:1);
  if(when==='ON_SKILL_HIT')score*=k.spell>.2?1:.1;
  if(when==='ON_ATTACK'||when==='ON_NTH_ATTACK'||when==='ON_SAME_TARGET_NTH_ATTACK')score*=clamp(d.attackSpeed*(when==='ON_ATTACK'?1.5:3/Math.max(1,e.trigger?.threshold??3)),.25,2);
  if(when==='HP_BELOW'||when==='TARGET_HP_BELOW'||when==='ON_KILL'||when==='ON_TAKEDOWN_ASSIST'||when==='AFTER_SECONDS')score*=.6;
  if(when==='ON_DEATH')score*=.5;
  if(when==='IN_FRONT_ROWS'&&!k.front||when==='IN_BACK_ROWS'&&k.front)score*=.3;
  if(e.interval)score*=Math.min(1,3/e.interval);
  if(e.radius||e.shape)score*=Math.min(3,e.maxTargets??2);
  return clamp(score,-12,18);
}
const augmentCache=new WeakMap<AugmentDef,{key:string;effects:EffectDef[]}>();
function resolvedEffects(a:AugmentDef,player:PlayerState,counts:Map<TraitId,number>):EffectDef[] {
  const key=String(a.growth?player.augmentProgress?.[a.id]??0:0)+(a.activeTraitScaling?JSON.stringify([...counts]):'');
  const cached=augmentCache.get(a);if(cached?.key===key)return cached.effects;
  const effects=augmentEffects(a,player.augmentProgress??{},counts);augmentCache.set(a,{key,effects});return effects;
}
export function unitAugmentValue(player:PlayerState,unit:UnitInstance,counts:Map<TraitId,number>,traits:TraitId[],onlyId?:string):number {
  const d=getUnitDef(unit.unitDefId);let score=0;
  for(const id of onlyId?[onlyId]:player.augments) {
    const a=getAugment(id);if(!augmentApplies(a,{unitDefId:d.id,cost:d.cost,items:unit.items,traits},counts))continue;
    for(const e of resolvedEffects(a,player,counts))if(!e.tag?.startsWith('TRAIT:')||traits.includes(e.tag.slice(6) as TraitId))score+=effectUtility(unit,e);
    if(a.skillUpgrade) {
      score+=kitProfile(unit).spell*((a.skillUpgrade.damageMultiplier??1)-1)*8;
      for(const e of a.skillUpgrade.append??[])score+=effectUtility(unit,{...e,value:skillEffectValue(e,unit.star,d.cost)})*1.5;
    }
    if(a.rememberItem && unit.items.includes(a.rememberItem))for(const e of getItem(a.rememberItem).effects)if(e.kind==='STACKING_STAT'&&e.stat)score+=statUtility(unit,e.stat,(e.value??0)*Math.min(e.maxStacks??99,player.augmentProgress?.[id]??0),e.tag==='PCT');
  }
  return score;
}
