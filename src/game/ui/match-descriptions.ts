import { augmentApplies, augmentEffects } from '../engine/augments/runtime';
import { getAugment } from '../engine/augments/augment-defs';
import { upgradeSkill, skillEffectValue } from '../engine/battle/skill-scaling';
import { getItem } from '../engine/items/item-defs';
import { getUnitTraits } from '../engine/roster';
import { activeTraitCounts } from '../engine/ai';
import type { PlayerState } from '../engine/state';
import type { BattleStats, EffectDef, Star, TraitId, UnitDef } from '../engine/types';

const n = (v: number) => Number(v.toFixed(2));
const pct = (v: number) => n(v * 100) + '%';
const statNames: Record<keyof BattleStats, string> = { hp:'체력',attackDamage:'공격력',abilityPower:'주문력',armor:'방어력',magicResist:'마법저항력',attackSpeed:'공격속도',attackRange:'사거리',moveSpeedHexPerSec:'이동속도',critChance:'치명타 확률',critMultiplier:'치명타 피해',startMana:'시작 마나',maxMana:'최대 마나' };
const targets: Record<string,string> = { SELF:'자신',CURRENT_TARGET:'현재 대상',ALL_ALLIES:'아군',ALL_ENEMIES:'적',LOWEST_HP_ALLY:'체력 비율이 가장 낮은 아군',LOWEST_HP_ALLIES:'체력 비율이 낮은 아군',FARTHEST_ENEMY:'가장 먼 적',NEAREST_ENEMY:'가장 가까운 적',LOWEST_HP_ENEMY:'체력이 가장 낮은 적',LOWEST_HP_PCT_ENEMY:'체력 비율이 가장 낮은 적',HIGHEST_HP_ENEMY:'체력이 가장 높은 적',HIGHEST_AD_ENEMY:'공격력이 가장 높은 적',HIGHEST_AD_ALLY:'공격력이 가장 높은 아군',LARGEST_ENEMY_CLUSTER:'가장 밀집한 적 무리' };
const statuses: Record<string,string> = { STUN:'기절',SILENCE:'침묵',DISARM:'무장해제',SLOW:'둔화',TAUNT:'도발' };
function condition(e: EffectDef): string {
  const t=e.trigger, v=t?.threshold??0;
  switch(t?.when) {
    case 'ON_CAST': return '스킬 사용 시'; case 'ON_SKILL_HIT': return '스킬 적중 시';
    case 'ON_ATTACK': return '기본 공격 시'; case 'ON_DEATH': return '사망 시';
    case 'ON_TAKEDOWN_ASSIST': return '처치 관여 시';
    case 'HP_BELOW': return '자신 체력 '+pct(v)+' 미만일 때';
    case 'TARGET_HP_BELOW': return '대상 체력 '+pct(v)+' 이하일 때';
    case 'IN_FRONT_ROWS': return '전열 배치 시'; case 'IN_BACK_ROWS': return '후열 배치 시';
    case 'ADJACENT_ALLIES_AT_LEAST': return '인접 아군 '+v+'명 이상일 때';
    case 'NO_ADJACENT_ALLIES': return '인접 아군이 없을 때';
    case 'AFTER_SECONDS': return '전투 '+v+'초 이후';
    default:return '';
  }
}
/** Describe resolved effects, never rewrite race names/dates or mutate authored data. */
export function describeEffect(e: EffectDef, value=e.value??0): string {
  const sign=value>=0?'+':'', stat=e.stat?statNames[e.stat]:'';
  let body='';
  switch(e.kind) {
    case 'DAMAGE': case 'PROC_DAMAGE': body=({MAGIC:'마법',PHYSICAL:'물리',TRUE:'고정',NONE:''}[e.damageType??'MAGIC'])+' 피해 '+n(value);break;
    case 'DAMAGE_MAXHP_PCT': body='최대 체력의 '+pct(value)+' '+({MAGIC:'마법',PHYSICAL:'물리',TRUE:'고정',NONE:''}[e.damageType??'TRUE'])+' 피해';break;
    case 'HEAL': body='체력 '+n(value)+' 회복';break;
    case 'HEAL_MISSING_PCT': body='잃은 체력 '+pct(value)+' 회복';break;
    case 'HEAL_MAXHP_PCT': body='최대 체력 '+pct(value)+' 회복';break;
    case 'SHIELD_FLAT': body='보호막 '+n(value);break;
    case 'SHIELD_MAXHP_PCT': body='최대 체력 '+pct(value)+' 보호막';break;
    case 'STAT_ADD': body=stat+' '+sign+n(value);break;
    case 'STAT_MUL': body=stat+' '+sign+pct(value);break;
    case 'STACKING_STAT': body='중첩당 '+stat+' '+sign+(e.tag==='PCT'?pct(value):n(value))+' (최대 '+e.maxStacks+'중첩)';break;
    case 'MANA_ADD': body=(e.tag==='MAX_MANA_FRACTION'?'최대 마나의 '+pct(value):'마나 '+n(value))+' 회복';break;
    case 'MANA_DRAIN': body='마나 '+n(value)+' 감소';break;
    case 'MANA_MAX_ADD': body='최대 마나 '+sign+n(value)+' (최소 30)';break;
    case 'SUNDER_ARMOR_PCT': body='방어력 '+pct(value)+' 감소';break;
    case 'SHRED_MR_PCT': body='마법저항력 '+pct(value)+' 감소';break;
    case 'DAMAGE_REDUCTION': body='받는 피해 '+pct(value)+' 감소';break;
    case 'DAMAGE_AMP': body='주는 피해 +'+pct(value);break;
    case 'SKILL_DAMAGE_AMP': body='스킬 피해 +'+pct(value);break;
    case 'SKILLS_CAN_CRIT': body='스킬 치명타 가능';break;
    case 'CRIT_CHANCE_ADD': body='치명타 확률 +'+pct(value);break;
    case 'HEAL_SHIELD_AMP': body='받는 회복·보호막 +'+pct(value);break;
    case 'OMNIVAMP': body='모든 피해 흡혈 '+pct(value);break;
    case 'APPLY_STATUS': body=statuses[e.status??'STUN']??e.status!;break;
    case 'TAUNT': body='도발';break;
    case 'WOUND': body='상처 (회복량 33% 감소)';break;
    case 'CC_IMMUNE': body='방해 효과 면역';break;
    case 'UNTARGETABLE': body='대상 지정 불가';break;
    case 'CLEANSE': body='기절·침묵·무장해제·둔화·도발 해제';break;
    case 'DASH': body=n(value)+'칸 이내 돌진';break;
    case 'EXECUTE_THRESHOLD': body='체력 '+pct(value)+' 미만 적 처형';break;
    case 'REVIVE': body=n(e.duration??1.5)+'초 후 최대 체력 '+pct(value)+'로 부활';break;
    default: return '';
  }
  const details=[e.radius?'주변 '+e.radius+'칸':'',e.maxTargets?'최대 '+e.maxTargets+'명':'',e.excludeSelf?'자신 제외':'',e.shape?({LINE:'직선',CONE:'부채꼴',CHAIN:'연쇄'}[e.shape]):'',e.range?'범위 '+e.range+'칸':'',e.duration&&e.kind!=='REVIVE'?e.duration+'초':'',e.delay?e.delay+'초 뒤':'',e.oncePerCombat?'전투당 1회':'',e.leech?'체력 피해의 '+pct(e.leech)+' 흡혈':'',e.isolatedMultiplier?'주변 1칸에 다른 적이 없으면 피해 ×'+e.isolatedMultiplier:'',e.onKillMana?'처치 시 마나 '+e.onKillMana+' 회복':''].filter(Boolean);
  return [condition(e),targets[e.target??'SELF'],body,details.length?'('+details.join(' · ')+')':''].filter(Boolean).join(' ');
}

export function matchSkillDescription(def: UnitDef, owner?: PlayerState, options: { star?: Star; abilityPower?: number; items?: string[]; traits?: TraitId[] } = {}) {
  const star=options.star??1, ap=options.abilityPower??100;
  const context={unitDefId:def.id,cost:def.cost,items:options.items??[],traits:options.traits??[...getUnitTraits(def.id,owner?.seasonId),...(options.items??[]).flatMap(id=>getItem(id).grantsTrait?[getItem(id).grantsTrait!]:[])]};
  const counts=owner?activeTraitCounts(owner,owner.board):new Map<TraitId,number>();
  let skill=def.skill;
  const changes: string[]=[];
  for(const id of owner?.augments??[]) {
    const aug=getAugment(id);if(!augmentApplies(aug,context,counts))continue;
    if (aug.skillUpgrade) skill = upgradeSkill(skill, aug.skillUpgrade);
    // Shared combat bonuses belong to the augment panel, not every unit's skill.
    // Only a dedicated hero upgrade rewrites that hero's authored explanation.
    if (!aug.skillUpgrade || !aug.filter?.unitIds?.includes(def.id)) continue;
    const lines: string[] = ['전용 스킬 강화 적용'];
    const effects=augmentEffects(aug,owner!.augmentProgress??{},counts).slice(0, aug.teamEffects.length).filter(e=>!e.tag?.startsWith('TRAIT:')||context.traits.includes(e.tag.slice(6) as TraitId));
    lines.push(...effects.map(e=>describeEffect(e)).filter(Boolean));
    if(aug.growth) {
      const g=aug.growth, stacks=Math.min(g.maxStacks,owner!.augmentProgress?.[id]??0);
      lines.push('PvP '+(g.event==='CAST'?'시전':'처치')+'마다 '+statNames[g.stat]+' +'+g.value+' 영구 성장 · 현재 '+stacks+'/'+g.maxStacks+'중첩 (다음 전투 +'+n(stacks*g.value)+', 라운드당 최대 '+g.perRoundCap+'중첩)');
    }
    if(lines.length)changes.push(aug.name+': '+lines.join('. '));
  }
  const description=changes.length?skill.effects.map(e=>describeEffect(e,skillEffectValue(e,star,def.cost,ap))).filter(Boolean).join('. ')+'.':def.skill.description;
  return {skill,description,changes};
}

/** This projection belongs to one owner in one match, never to the item registry. */
export function matchItemDescription(itemId: string, owner?: PlayerState): { description: string; changes: string[] } {
  const item=getItem(itemId),changes:string[]=[];
  let description=item.description;
  for(const id of owner?.augments??[]) {
    const aug=getAugment(id);
    if(aug.rememberItem===itemId) {
      for(const e of item.effects.filter(e=>e.kind==='STACKING_STAT')) {
        const max=e.maxStacks??99,stacks=Math.min(max,owner!.augmentProgress?.[id]??0);
        const bonus=(e.value??0)*stacks;
        description=description.replace('전투당 최대 '+max+'중첩','최대 '+max+'중첩');
        changes.push(aug.name+': PvP 최고 중첩을 이번 경기 동안 팀 기록으로 보존. 다음 전투 '+stacks+'/'+max+'중첩으로 시작 ('+statNames[e.stat!]+' +'+(e.tag==='PCT'?pct(bonus):n(bonus))+'). 중첩 상한 유지.');
      }
    }
    if(aug.filter?.itemId===itemId) changes.push(aug.name+': 장착자에게 '+aug.teamEffects.map(e=>describeEffect(e)).filter(Boolean).join('. ')+'.');
  }
  return {description:changes.length?description+'\n이번 경기 변경 효과\n'+changes.join('\n'):description,changes};
}
