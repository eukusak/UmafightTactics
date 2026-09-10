/**
 * Skill generation from 12 shared templates (spec §12).
 *
 * Role/style/cost establish the body-action family. Authored specializations
 * add character-specific tactics and choreography as declarative EffectDefs;
 * the battle engine never switches on a character ID.
 */
import type { Cost, DamageType, EffectDef, Role, RunStyle, SkillDef, SkillTemplate, TargetRule } from '../types';
import { buildTacticalSkill, authoredBodyFamily } from './skill-patterns';

/** Spec §12.2 — which templates a role may draw from, in preference order. */
export const ROLE_TEMPLATES: Record<Role, SkillTemplate[]> = {
  TANK: ['SHIELD_TAUNT', 'CONTROL', 'AURA'],
  BRUISER: ['DASH_LINE', 'CONE', 'RAMP'],
  AD_CARRY: ['MULTI_SHOT', 'SINGLE_EXECUTE', 'DASH_LINE'],
  AP_CARRY: ['AOE_BURST', 'CONTROL', 'BACKLINE_DIVE'],
  SUPPORT: ['HEAL_BUFF', 'AURA', 'CONTROL'],
};

/** Spec §12.3 — run style biases which of the role's templates is picked. */
const STYLE_PREFERENCE: Record<RunStyle, SkillTemplate[]> = {
  nige: ['DASH_LINE', 'CONE', 'AURA', 'MULTI_SHOT'],
  senko: ['SHIELD_TAUNT', 'AOE_BURST', 'HEAL_BUFF', 'AURA'],
  sashi: ['DASH_LINE', 'RAMP', 'MULTI_SHOT', 'CONTROL'],
  oikomi: ['BACKLINE_DIVE', 'SINGLE_EXECUTE', 'CONTROL', 'AOE_BURST'],
};

export function chooseTemplate(role: Role, style: RunStyle): SkillTemplate {
  const allowed = ROLE_TEMPLATES[role];
  for (const preferred of STYLE_PREFERENCE[style]) {
    if (allowed.includes(preferred)) return preferred;
  }
  return allowed[0];
}

const TEMPLATE_LABEL: Record<SkillTemplate, string> = {
  DASH_LINE: '직선 돌파',
  AOE_BURST: '광역 폭발',
  SINGLE_EXECUTE: '결정타',
  SHIELD_TAUNT: '선두 방벽',
  HEAL_BUFF: '팀 페이스 업',
  BACKLINE_DIVE: '후열 습격',
  MULTI_SHOT: '연속 스퍼트',
  CONE: '전방 압박',
  AURA: '주도권 장악',
  CONTROL: '진로 봉쇄',
  RAMP: '가속 축적',
  SUMMON: '페이스메이커 소환',
};

export const TEMPLATE_VFX: Record<SkillTemplate, string> = {
  DASH_LINE: 'vfx_line_red',
  AOE_BURST: 'vfx_aoe_burst',
  SINGLE_EXECUTE: 'vfx_execute',
  SHIELD_TAUNT: 'vfx_shield',
  HEAL_BUFF: 'vfx_heal',
  BACKLINE_DIVE: 'vfx_arc_violet',
  MULTI_SHOT: 'vfx_projectile',
  CONE: 'vfx_cone_gold',
  AURA: 'vfx_buff',
  CONTROL: 'vfx_stun',
  RAMP: 'vfx_mana',
  SUMMON: 'vfx_buff',
};

const STYLE_VFX: Record<RunStyle, string> = {
  nige: 'vfx_dash_nige',
  senko: 'vfx_dash_senko',
  sashi: 'vfx_dash_sashi',
  oikomi: 'vfx_dash_oikomi',
};

const TEMPLATE_TARGET: Record<SkillTemplate, TargetRule> = {
  DASH_LINE: 'CURRENT_TARGET',
  AOE_BURST: 'LARGEST_ENEMY_CLUSTER',
  SINGLE_EXECUTE: 'LOWEST_HP_PCT_ENEMY',
  SHIELD_TAUNT: 'SELF',
  HEAL_BUFF: 'LOWEST_HP_ALLY',
  BACKLINE_DIVE: 'FARTHEST_ENEMY',
  MULTI_SHOT: 'CURRENT_TARGET',
  CONE: 'CURRENT_TARGET',
  AURA: 'SELF',
  CONTROL: 'LARGEST_ENEMY_CLUSTER',
  RAMP: 'CURRENT_TARGET',
  SUMMON: 'SELF',
};

const TEMPLATE_DAMAGE_TYPE: Record<SkillTemplate, DamageType> = {
  DASH_LINE: 'PHYSICAL',
  AOE_BURST: 'MAGIC',
  SINGLE_EXECUTE: 'PHYSICAL',
  SHIELD_TAUNT: 'NONE',
  HEAL_BUFF: 'NONE',
  BACKLINE_DIVE: 'MAGIC',
  MULTI_SHOT: 'PHYSICAL',
  CONE: 'MAGIC',
  AURA: 'NONE',
  CONTROL: 'MAGIC',
  RAMP: 'PHYSICAL',
  SUMMON: 'MAGIC',
};

/** Cost scaling for a skill's headline number, before star multipliers. */
const COST_POWER: Record<Cost, number> = { 1: 1.0, 2: 1.08, 3: 1.16, 4: 1.26, 5: 1.4 };

export type SkillBuildInput = {
  unitId: string;
  nameKo: string;
  role: Role;
  style: RunStyle;
  cost: Cost;
  /** 0..1 percentile of the unit's power index inside the 145 pool. */
  power01: number;
  signatureName: string | null;
  mainWin: string | null;
};

/** Cleans "LEGACY · 41'日本ダービー(OP)" down to "41'日本ダービー(OP)". */
export function cleanSignature(raw: string | null): string | null {
  if (!raw) return null;
  const parts = raw.split('·').map((p) => p.trim());
  const tail = parts[parts.length - 1];
  return tail && tail.length > 0 ? tail : null;
}

export function buildSkill(input: SkillBuildInput): SkillDef {
  // Racing-style corrections must not silently replace an authored skill or its art.
  const template = authoredBodyFamily(input.unitId) ?? chooseTemplate(input.role, input.style);
  const scale = COST_POWER[input.cost] * (0.9 + 0.2 * input.power01);

  // Spec §12.4: prefer the signature / representative race name, never official skill text.
  const race = cleanSignature(input.signatureName) ?? input.mainWin;
  const displayName = race
    ? `${input.nameKo} · ${race}`
    : `${input.nameKo} - 라스트 스퍼트`;

  const dmg = Math.round(180 * scale);
  const heal = Math.round(200 * scale);
  const shield = 0.28 + 0.04 * input.power01;
  const damageType = TEMPLATE_DAMAGE_TYPE[template];
  const target = TEMPLATE_TARGET[template];

  const effects: EffectDef[] = [];
  let description = '';

  switch (template) {
    case 'DASH_LINE':
      effects.push(
        { kind: 'DASH', value: 2, target: 'CURRENT_TARGET' },
        { kind: 'DAMAGE', value: dmg, damageType, target: 'CURRENT_TARGET', radius: 1 },
        { kind: 'STAT_MUL', stat: 'attackSpeed', value: 0.35, duration: 4 },
      );
      description = `대상 방향으로 돌진해 주변 적에게 ${dmg} 물리피해를 입히고 4초간 공격속도 +35%.`;
      break;
    case 'AOE_BURST':
      effects.push({ kind: 'DAMAGE', value: Math.round(dmg * 0.85), damageType, target, radius: 2 });
      description = `가장 밀집한 적 무리에 ${Math.round(dmg * 0.85)} 마법피해를 입힌다.`;
      break;
    case 'SINGLE_EXECUTE':
      effects.push(
        { kind: 'DAMAGE', value: Math.round(dmg * 1.35), damageType, target },
        { kind: 'EXECUTE_THRESHOLD', value: 0.1, target },
      );
      description = `체력 비율이 가장 낮은 적에게 ${Math.round(dmg * 1.35)} 물리피해. 체력 10% 미만이면 즉시 처치.`;
      break;
    case 'SHIELD_TAUNT':
      effects.push(
        { kind: 'SHIELD_MAXHP_PCT', value: shield, duration: 5, target: 'SELF' },
        { kind: 'TAUNT', duration: 2.5, radius: 2, target: 'ALL_ENEMIES' },
      );
      description = `최대 체력 ${Math.round(shield * 100)}% 보호막(5초)을 얻고 2칸 내 적을 2.5초간 도발한다.`;
      break;
    case 'HEAL_BUFF':
      effects.push(
        { kind: 'HEAL', value: heal, target: 'LOWEST_HP_ALLY' },
        { kind: 'STAT_MUL', stat: 'attackDamage', value: 0.2, duration: 5, target: 'ALL_ALLIES' },
        { kind: 'STAT_MUL', stat: 'abilityPower', value: 0.2, duration: 5, target: 'ALL_ALLIES' },
      );
      description = `체력이 가장 낮은 아군을 ${heal} 회복시키고 아군 전체 공격력/주문력을 5초간 +20%.`;
      break;
    case 'BACKLINE_DIVE':
      effects.push(
        { kind: 'DASH', value: 4, target: 'FARTHEST_ENEMY' },
        { kind: 'DAMAGE', value: Math.round(dmg * 1.1), damageType, target: 'FARTHEST_ENEMY', radius: 1 },
        { kind: 'APPLY_STATUS', status: 'STUN', duration: 1.2, target: 'FARTHEST_ENEMY' },
      );
      description = `가장 먼 적에게 뛰어들어 ${Math.round(dmg * 1.1)} 마법피해를 입히고 1.2초간 기절시킨다.`;
      break;
    case 'MULTI_SHOT':
      effects.push(
        { kind: 'DAMAGE', value: Math.round(dmg * 0.42), damageType, target, tag: 'REPEAT:3' },
        { kind: 'ON_HIT_MANA', value: 10 },
      );
      description = `대상에게 ${Math.round(dmg * 0.42)} 물리피해를 3회 연속으로 가한다.`;
      break;
    case 'CONE':
      effects.push(
        { kind: 'DAMAGE', value: Math.round(dmg * 0.9), damageType, target, radius: 2, tag: 'CONE' },
        { kind: 'SUNDER_ARMOR_PCT', value: 0.2, duration: 4, target, radius: 2 },
      );
      description = `전방 부채꼴 범위에 ${Math.round(dmg * 0.9)} 마법피해를 입히고 4초간 방어력 20%를 깎는다.`;
      break;
    case 'AURA':
      effects.push(
        { kind: 'STAT_MUL', stat: 'attackSpeed', value: 0.25, duration: 6, target: 'ALL_ALLIES' },
        { kind: 'STAT_ADD', stat: 'armor', value: 20, duration: 6, target: 'ALL_ALLIES' },
        { kind: 'STAT_ADD', stat: 'magicResist', value: 20, duration: 6, target: 'ALL_ALLIES' },
      );
      description = '6초간 아군 전체의 공격속도 +25%, 방어력/마저 +20.';
      break;
    case 'CONTROL':
      effects.push(
        { kind: 'DAMAGE', value: Math.round(dmg * 0.6), damageType, target, radius: 1 },
        { kind: 'APPLY_STATUS', status: 'STUN', duration: 1.5, target, radius: 1 },
      );
      description = `대상 주변 적에게 ${Math.round(dmg * 0.6)} 마법피해를 입히고 1.5초간 기절시킨다.`;
      break;
    case 'RAMP':
      effects.push(
        { kind: 'DAMAGE', value: Math.round(dmg * 0.75), damageType, target },
        { kind: 'STACKING_STAT', stat: 'attackDamage', value: 0.12, maxStacks: 8, tag: 'PCT' },
        { kind: 'STACKING_STAT', stat: 'abilityPower', value: 0.12, maxStacks: 8, tag: 'PCT' },
      );
      description = `대상에게 ${Math.round(dmg * 0.75)} 물리피해를 입히고 공격력/주문력 +12%를 영구 중첩(최대 8).`;
      break;
    case 'SUMMON':
      effects.push(
        { kind: 'SUMMON', value: Math.round(dmg * 2.4), duration: 12, target: 'SELF' },
        { kind: 'DAMAGE', value: Math.round(dmg * 0.4), damageType, target: 'CURRENT_TARGET', radius: 1 },
      );
      description = '페이스메이커를 소환해 12초간 함께 싸운다.';
      break;
  }

  // Spec §12.3 — run style flavours the finished skill.
  if (input.style === 'nige') {
    effects.push({ kind: 'STAT_MUL', stat: 'moveSpeedHexPerSec', value: 0.3, duration: 3 });
  } else if (input.style === 'senko') {
    effects.push({ kind: 'SHIELD_MAXHP_PCT', value: 0.1, duration: 4, target: 'SELF' });
  } else if (input.style === 'sashi') {
    effects.push({ kind: 'CRIT_CHANCE_ADD', value: 0.15, duration: 5 });
  } else {
    effects.push({ kind: 'DAMAGE_AMP', value: 0.12, duration: 5, trigger: { when: 'TARGET_HP_BELOW', threshold: 0.5 } });
  }

  const manaByRole: Record<Role, number> = {
    TANK: 90, BRUISER: 80, AD_CARRY: 70, AP_CARRY: 80, SUPPORT: 90,
  };

  return buildTacticalSkill(input.unitId, {
    id: `skill_${input.unitId}`,
    displayName,
    template,
    baseValues: [dmg, heal, Math.round(shield * 100)],
    starMultipliers: [1.0, 1.45, input.cost === 5 ? 6.0 : input.cost === 4 ? 3.6 : 2.2],
    damageType,
    targetRule: target,
    manaCost: manaByRole[input.role],
    effects,
    vfxKey: template === 'DASH_LINE' || template === 'BACKLINE_DIVE'
      ? STYLE_VFX[input.style]
      : TEMPLATE_VFX[template],
    description: `[${TEMPLATE_LABEL[template]}] ${description}`,
  });
}
