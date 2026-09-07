/** The 24 traits from spec §11, expressed purely as data for the EffectSystem. */
import type { EffectDef, TraitDef, TraitId } from '../types';

const add = (stat: EffectDef['stat'], value: number, extra: Partial<EffectDef> = {}): EffectDef => ({
  kind: 'STAT_ADD', stat, value, ...extra,
});
const mul = (stat: EffectDef['stat'], value: number, extra: Partial<EffectDef> = {}): EffectDef => ({
  kind: 'STAT_MUL', stat, value, ...extra,
});

export const TRAIT_DEFS: TraitDef[] = [
  {
    id: 'nige', name: '도주', category: 'STYLE', thresholds: [2, 4, 6],
    emblemItemId: 'emblem_nige',
    description: '앞으로 치고 나가 속도로 압박한다.',
    tiers: [
      { count: 2, description: '공속 +10%, 이동속도 +10%',
        effects: [mul('attackSpeed', 0.1), mul('moveSpeedHexPerSec', 0.1)] },
      { count: 4, description: '공속 +25%, 이동속도 +20%',
        effects: [mul('attackSpeed', 0.25), mul('moveSpeedHexPerSec', 0.2)] },
      { count: 6, description: '공속 +45%, 이동속도 +35%. 전투 시작 4초간 방해 효과 면역',
        effects: [mul('attackSpeed', 0.45), mul('moveSpeedHexPerSec', 0.35),
          { kind: 'CC_IMMUNE', duration: 4, trigger: { when: 'COMBAT_START' } }] },
    ],
  },
  {
    id: 'senko', name: '선행', category: 'STYLE', thresholds: [2, 4, 6],
    emblemItemId: 'emblem_senko',
    description: '앞 자리를 지키며 안정적으로 밀어붙인다.',
    tiers: [
      { count: 2, description: '체력 70% 이상일 때 피해 증폭 +8%. 첫 스킬 마나 -5',
        effects: [{ kind: 'DAMAGE_AMP', value: 0.08, trigger: { when: 'HP_ABOVE', threshold: 0.7 } },
          { kind: 'MANA_ADD', value: 5, trigger: { when: 'COMBAT_START' } }] },
      { count: 4, description: '체력 70% 이상일 때 피해 증폭 +15%. 첫 스킬 마나 -10',
        effects: [{ kind: 'DAMAGE_AMP', value: 0.15, trigger: { when: 'HP_ABOVE', threshold: 0.7 } },
          { kind: 'MANA_ADD', value: 10, trigger: { when: 'COMBAT_START' } }] },
      { count: 6, description: '체력 70% 이상일 때 피해 증폭 +25%. 첫 스킬 마나 -15',
        effects: [{ kind: 'DAMAGE_AMP', value: 0.25, trigger: { when: 'HP_ABOVE', threshold: 0.7 } },
          { kind: 'MANA_ADD', value: 15, trigger: { when: 'COMBAT_START' } }] },
    ],
  },
  {
    id: 'sashi', name: '선입', category: 'STYLE', thresholds: [2, 4, 6],
    emblemItemId: 'emblem_sashi',
    description: '안쪽을 파고들어 승부를 뒤집는다.',
    tiers: [
      { count: 2, description: '처치 관여 시 6초간 치명타 +10%',
        effects: [{ kind: 'CRIT_CHANCE_ADD', value: 0.1, duration: 6, trigger: { when: 'ON_TAKEDOWN_ASSIST' } }] },
      { count: 4, description: '처치 관여 시 6초간 치명타 +20%, 피해 증폭 +5%',
        effects: [{ kind: 'CRIT_CHANCE_ADD', value: 0.2, duration: 6, trigger: { when: 'ON_TAKEDOWN_ASSIST' } },
          { kind: 'DAMAGE_AMP', value: 0.05, duration: 6, trigger: { when: 'ON_TAKEDOWN_ASSIST' } }] },
      { count: 6, description: '처치 관여 시 6초간 치명타 +35%, 피해 증폭 +10%',
        effects: [{ kind: 'CRIT_CHANCE_ADD', value: 0.35, duration: 6, trigger: { when: 'ON_TAKEDOWN_ASSIST' } },
          { kind: 'DAMAGE_AMP', value: 0.1, duration: 6, trigger: { when: 'ON_TAKEDOWN_ASSIST' } }] },
    ],
  },
  {
    id: 'oikomi', name: '추입', category: 'STYLE', thresholds: [2, 4, 6],
    emblemItemId: 'emblem_oikomi',
    description: '뒤에서 몰아쳐 약해진 적을 끝낸다.',
    tiers: [
      { count: 2, description: '대상 체력 50% 이하일 때 피해 증폭 +10%',
        effects: [{ kind: 'DAMAGE_AMP', value: 0.1, trigger: { when: 'TARGET_HP_BELOW', threshold: 0.5 } }] },
      { count: 4, description: '대상 체력 50% 이하일 때 피해 증폭 +20%',
        effects: [{ kind: 'DAMAGE_AMP', value: 0.2, trigger: { when: 'TARGET_HP_BELOW', threshold: 0.5 } }] },
      { count: 6, description: '대상 체력 50% 이하일 때 피해 증폭 +35%. 처치 관여 시 마나 +20',
        effects: [{ kind: 'DAMAGE_AMP', value: 0.35, trigger: { when: 'TARGET_HP_BELOW', threshold: 0.5 } },
          { kind: 'MANA_ADD', value: 20, trigger: { when: 'ON_TAKEDOWN_ASSIST' } }] },
    ],
  },
  {
    id: 'sprinter', name: '스프린터', category: 'DISTANCE', thresholds: [2, 4],
    emblemItemId: 'emblem_sprinter',
    description: '짧은 거리에서 폭발적으로 튀어나간다.',
    tiers: [
      { count: 2, description: '기본 공격 3회마다 40 추가 물리피해',
        effects: [{ kind: 'ON_HIT_DAMAGE', value: 40, damageType: 'PHYSICAL', trigger: { when: 'ON_NTH_ATTACK', threshold: 3 } }] },
      { count: 4, description: '기본 공격 3회마다 90 추가 물리피해. 공격속도 상한 +1',
        effects: [{ kind: 'ON_HIT_DAMAGE', value: 90, damageType: 'PHYSICAL', trigger: { when: 'ON_NTH_ATTACK', threshold: 3 } },
          { kind: 'ATTACK_SPEED_CAP_ADD', value: 1 }] },
    ],
  },
  {
    id: 'miler', name: '마일러', category: 'DISTANCE', thresholds: [2, 4],
    emblemItemId: 'emblem_miler',
    description: '스킬 직후 페이스를 끌어올린다.',
    tiers: [
      { count: 2, description: '스킬 사용 후 5초간 공격력/주문력 +10%',
        effects: [mul('attackDamage', 0.1, { duration: 5, trigger: { when: 'ON_CAST' } }),
          mul('abilityPower', 0.1, { duration: 5, trigger: { when: 'ON_CAST' } })] },
      { count: 4, description: '스킬 사용 후 5초간 공격력/주문력 +25%',
        effects: [mul('attackDamage', 0.25, { duration: 5, trigger: { when: 'ON_CAST' } }),
          mul('abilityPower', 0.25, { duration: 5, trigger: { when: 'ON_CAST' } })] },
    ],
  },
  {
    id: 'middle', name: '중거리', category: 'DISTANCE', thresholds: [2, 4],
    emblemItemId: 'emblem_middle',
    description: '중반 이후 본격적으로 힘을 낸다.',
    tiers: [
      { count: 2, description: '전투 8초 후 최대 체력 +8%, 공격력/주문력 +8%',
        effects: [mul('hp', 0.08, { trigger: { when: 'AFTER_SECONDS', threshold: 8 } }),
          mul('attackDamage', 0.08, { trigger: { when: 'AFTER_SECONDS', threshold: 8 } }),
          mul('abilityPower', 0.08, { trigger: { when: 'AFTER_SECONDS', threshold: 8 } })] },
      { count: 4, description: '전투 8초 후 최대 체력 +18%, 공격력/주문력 +18%',
        effects: [mul('hp', 0.18, { trigger: { when: 'AFTER_SECONDS', threshold: 8 } }),
          mul('attackDamage', 0.18, { trigger: { when: 'AFTER_SECONDS', threshold: 8 } }),
          mul('abilityPower', 0.18, { trigger: { when: 'AFTER_SECONDS', threshold: 8 } })] },
    ],
  },
  {
    id: 'stayer', name: '스테이어', category: 'DISTANCE', thresholds: [2, 4],
    emblemItemId: 'emblem_stayer',
    description: '오래 버틸수록 단단해진다.',
    tiers: [
      { count: 2, description: '5초마다 잃은 체력의 4% 회복',
        effects: [{ kind: 'HEAL_MISSING_PCT', value: 0.04, interval: 5, trigger: { when: 'EVERY_SECONDS', threshold: 5 } }] },
      { count: 4, description: '5초마다 잃은 체력의 8% 회복. 전투 15초 후 방어력/마저 +25',
        effects: [{ kind: 'HEAL_MISSING_PCT', value: 0.08, interval: 5, trigger: { when: 'EVERY_SECONDS', threshold: 5 } },
          add('armor', 25, { trigger: { when: 'AFTER_SECONDS', threshold: 15 } }),
          add('magicResist', 25, { trigger: { when: 'AFTER_SECONDS', threshold: 15 } })] },
    ],
  },
  {
    id: 'dirt_champion', name: '더트 챔피언', category: 'SURFACE', thresholds: [2, 3, 4],
    emblemItemId: 'emblem_dirt_champion',
    description: '거친 주로에서 단련된 몸.',
    tiers: [
      { count: 2, description: '방어력/마저 +10', effects: [add('armor', 10), add('magicResist', 10)] },
      { count: 3, description: '방어력/마저 +20, 군중제어 저항 +15%',
        effects: [add('armor', 20), add('magicResist', 20), { kind: 'CC_RESIST', value: 0.15 }] },
      { count: 4, description: '방어력/마저 +35, 군중제어 저항 +30%',
        effects: [add('armor', 35), add('magicResist', 35), { kind: 'CC_RESIST', value: 0.3 }] },
    ],
  },
  {
    id: 'all_rounder', name: '올라운더', category: 'SURFACE', thresholds: [2, 3],
    emblemItemId: null,
    description: '잔디도 더트도 가리지 않는다.',
    tiers: [
      { count: 2, description: '모든 피해 흡혈 +8%', effects: [{ kind: 'OMNIVAMP', value: 0.08 }] },
      { count: 3, description: '모든 피해 흡혈 +15%, 공격 사거리 +1(최대 4)',
        effects: [{ kind: 'OMNIVAMP', value: 0.15 }, add('attackRange', 1)] },
    ],
  },
  {
    id: 'golden_generation', name: '황금세대', category: 'HISTORY', thresholds: [2, 4, 6],
    emblemItemId: 'emblem_golden_generation',
    description: '한 세대를 통째로 빛낸 이름들.',
    tiers: [
      { count: 2, description: '아군 전체 공격력/주문력 +5%',
        effects: [mul('attackDamage', 0.05, { target: 'ALL_ALLIES' }), mul('abilityPower', 0.05, { target: 'ALL_ALLIES' })] },
      { count: 4, description: '아군 전체 공격력/주문력 +10%',
        effects: [mul('attackDamage', 0.1, { target: 'ALL_ALLIES' }), mul('abilityPower', 0.1, { target: 'ALL_ALLIES' })] },
      { count: 6, description: '아군 전체 공격력/주문력 +18%. 첫 치명상을 막고 1초간 체력 1로 생존(유닛당 1회)',
        effects: [mul('attackDamage', 0.18, { target: 'ALL_ALLIES' }), mul('abilityPower', 0.18, { target: 'ALL_ALLIES' }),
          { kind: 'SURVIVE_LETHAL', value: 1, duration: 1, target: 'ALL_ALLIES', oncePerCombat: true }] },
    ],
  },
  {
    id: 'famous_house', name: '명가', category: 'HISTORY', thresholds: [2, 4],
    emblemItemId: 'emblem_famous_house',
    description: '이름만으로 무게가 실리는 혈통.',
    tiers: [
      { count: 2, description: '전투 시작 시 최대 체력 +8%. 명가 유닛끼리 인접 시 방어력/마저 +10',
        effects: [mul('hp', 0.08, { trigger: { when: 'COMBAT_START' } }),
          add('armor', 10, { trigger: { when: 'ADJACENT_ALLIES_AT_LEAST', threshold: 1 } }),
          add('magicResist', 10, { trigger: { when: 'ADJACENT_ALLIES_AT_LEAST', threshold: 1 } })] },
      { count: 4, description: '전투 시작 시 최대 체력 +16%. 명가 유닛끼리 인접 시 방어력/마저 +20',
        effects: [mul('hp', 0.16, { trigger: { when: 'COMBAT_START' } }),
          add('armor', 20, { trigger: { when: 'ADJACENT_ALLIES_AT_LEAST', threshold: 1 } }),
          add('magicResist', 20, { trigger: { when: 'ADJACENT_ALLIES_AT_LEAST', threshold: 1 } })] },
    ],
  },
  {
    id: 'international', name: '국제파', category: 'HISTORY', thresholds: [2, 3, 4],
    emblemItemId: 'emblem_international',
    description: '바다 건너에서 증명한 실력.',
    tiers: [
      { count: 2, description: '스킬 피해 +8%, 보호막에 주는 피해 +15%',
        effects: [{ kind: 'SKILL_DAMAGE_AMP', value: 0.08 }, { kind: 'SHIELD_DAMAGE_AMP', value: 0.15 }] },
      { count: 3, description: '스킬 피해 +15%, 보호막에 주는 피해 +30%',
        effects: [{ kind: 'SKILL_DAMAGE_AMP', value: 0.15 }, { kind: 'SHIELD_DAMAGE_AMP', value: 0.3 }] },
      { count: 4, description: '스킬 피해 +25%, 보호막에 주는 피해 +50%',
        effects: [{ kind: 'SKILL_DAMAGE_AMP', value: 0.25 }, { kind: 'SHIELD_DAMAGE_AMP', value: 0.5 }] },
    ],
  },
  {
    id: 'unbeaten', name: '무패 전설', category: 'HISTORY', thresholds: [2, 3],
    emblemItemId: 'emblem_unbeaten',
    description: '패배를 모르는 기록.',
    tiers: [
      { count: 2, description: '전투 시작 8초간 피해 증폭 +12%',
        effects: [{ kind: 'DAMAGE_AMP', value: 0.12, duration: 8, trigger: { when: 'COMBAT_START' } }] },
      { count: 3, description: '전투 시작 시 피해 증폭 +25%가 전투 종료까지 지속',
        effects: [{ kind: 'DAMAGE_AMP', value: 0.25, trigger: { when: 'COMBAT_START' } }] },
    ],
  },
  {
    id: 'comeback', name: '역전극', category: 'HISTORY', thresholds: [2, 4],
    emblemItemId: 'emblem_comeback',
    description: '몰릴수록 살아난다.',
    tiers: [
      { count: 2, description: '체력 50% 아래에서 공격속도 +20%, 흡혈 +8%',
        effects: [mul('attackSpeed', 0.2, { trigger: { when: 'HP_BELOW', threshold: 0.5 } }),
          { kind: 'OMNIVAMP', value: 0.08, trigger: { when: 'HP_BELOW', threshold: 0.5 } }] },
      { count: 4, description: '체력 50% 아래에서 공격속도 +40%, 흡혈 +16%',
        effects: [mul('attackSpeed', 0.4, { trigger: { when: 'HP_BELOW', threshold: 0.5 } }),
          { kind: 'OMNIVAMP', value: 0.16, trigger: { when: 'HP_BELOW', threshold: 0.5 } }] },
    ],
  },
  {
    id: 'triple_crown', name: '삼관', category: 'HISTORY', thresholds: [2, 3],
    emblemItemId: 'emblem_triple_crown',
    description: '세 개의 왕관을 모두 가져간 자.',
    tiers: [
      { count: 2, description: '스킬 피해 +15%', effects: [{ kind: 'SKILL_DAMAGE_AMP', value: 0.15 }] },
      { count: 3, description: '스킬 피해 +30%. 첫 스킬 직후 최대 마나의 50% 회복',
        effects: [{ kind: 'SKILL_DAMAGE_AMP', value: 0.3 },
          { kind: 'MANA_ADD', value: 0.5, tag: 'MAX_MANA_FRACTION', oncePerCombat: true, trigger: { when: 'ON_CAST' } }] },
    ],
  },
  {
    id: 'era_star', name: '시대의 스타', category: 'HISTORY', thresholds: [2, 4, 6],
    emblemItemId: 'emblem_era_star',
    description: '경마장 밖에서도 이름이 팔린 스타.',
    tiers: [
      { count: 2, description: '아군 전체 치명타 +5%, 치명타 피해 +5%',
        effects: [{ kind: 'CRIT_CHANCE_ADD', value: 0.05, target: 'ALL_ALLIES' },
          { kind: 'CRIT_DAMAGE_ADD', value: 0.05, target: 'ALL_ALLIES' }] },
      { count: 4, description: '아군 전체 치명타 +10%, 치명타 피해 +10%',
        effects: [{ kind: 'CRIT_CHANCE_ADD', value: 0.1, target: 'ALL_ALLIES' },
          { kind: 'CRIT_DAMAGE_ADD', value: 0.1, target: 'ALL_ALLIES' }] },
      { count: 6, description: '아군 전체 치명타 +15%, 치명타 피해 +20%',
        effects: [{ kind: 'CRIT_CHANCE_ADD', value: 0.15, target: 'ALL_ALLIES' },
          { kind: 'CRIT_DAMAGE_ADD', value: 0.2, target: 'ALL_ALLIES' }] },
    ],
  },
  {
    id: 'classic_legend', name: '클래식 레전드', category: 'HISTORY', thresholds: [2, 4],
    emblemItemId: null,
    description: '쇼와의 끝자락을 장식한 이름.',
    tiers: [
      { count: 2, description: '방어력/마저 +8', effects: [add('armor', 8), add('magicResist', 8)] },
      { count: 4, description: '방어력/마저 +18. 전투 시작 6초간 받는 피해 10% 감소',
        effects: [add('armor', 18), add('magicResist', 18),
          { kind: 'DAMAGE_REDUCTION', value: 0.1, duration: 6, trigger: { when: 'COMBAT_START' } }] },
    ],
  },
  {
    id: 'heisei_dynasty', name: '헤이세이 왕조', category: 'HISTORY', thresholds: [2, 4, 6],
    emblemItemId: null,
    description: '헤이세이 경마를 지배한 계보.',
    tiers: [
      { count: 2, description: '공격력/주문력 +6%', effects: [mul('attackDamage', 0.06), mul('abilityPower', 0.06)] },
      { count: 4, description: '공격력/주문력 +12%', effects: [mul('attackDamage', 0.12), mul('abilityPower', 0.12)] },
      { count: 6, description: '공격력/주문력 +20%', effects: [mul('attackDamage', 0.2), mul('abilityPower', 0.2)] },
    ],
  },
  {
    id: 'reiwa_elite', name: '레이와 엘리트', category: 'HISTORY', thresholds: [2, 4],
    emblemItemId: null,
    description: '가장 새로운 세대의 정예.',
    tiers: [
      { count: 2, description: '시작 마나 +10, 이동속도 +10%',
        effects: [add('startMana', 10), mul('moveSpeedHexPerSec', 0.1)] },
      { count: 4, description: '시작 마나 +20, 이동속도 +20%',
        effects: [add('startMana', 20), mul('moveSpeedHexPerSec', 0.2)] },
    ],
  },
  {
    id: 'queen', name: '여왕', category: 'HISTORY', thresholds: [2, 3],
    emblemItemId: null,
    description: '암말 전선의 정점.',
    tiers: [
      { count: 2, description: '스킬 사용 시 체력이 가장 낮은 아군에게 최대 체력 8% 보호막',
        effects: [{ kind: 'SHIELD_MAXHP_PCT', value: 0.08, duration: 6, target: 'LOWEST_HP_ALLY', trigger: { when: 'ON_CAST' } }] },
      { count: 3, description: '스킬 사용 시 체력이 가장 낮은 아군에게 최대 체력 14% 보호막',
        effects: [{ kind: 'SHIELD_MAXHP_PCT', value: 0.14, duration: 6, target: 'LOWEST_HP_ALLY', trigger: { when: 'ON_CAST' } }] },
    ],
  },
  {
    id: 'emperor', name: '황제', category: 'HISTORY', thresholds: [1],
    emblemItemId: null,
    description: '고유 특성. 살아 있는 동안 아군 전체를 끌어올린다.',
    tiers: [
      { count: 1, description: '살아 있는 동안 아군 전체 피해 증폭 +5%, 군중제어 저항 +10%',
        effects: [{ kind: 'DAMAGE_AMP', value: 0.05, target: 'ALL_ALLIES' },
          { kind: 'CC_RESIST', value: 0.1, target: 'ALL_ALLIES' }] },
    ],
  },
  {
    id: 'record_breaker', name: '레코드 브레이커', category: 'HISTORY', thresholds: [2, 3],
    emblemItemId: null,
    description: '시계를 부수며 달린 기록 보유자.',
    tiers: [
      { count: 2, description: '기본 공격 4회마다 공격속도 +12% 중첩(최대 4회)',
        effects: [{ kind: 'STACKING_STAT', stat: 'attackSpeed', value: 0.12, maxStacks: 4, trigger: { when: 'ON_NTH_ATTACK', threshold: 4 } }] },
      { count: 3, description: '기본 공격 4회마다 공격속도 +25% 중첩(최대 4회)',
        effects: [{ kind: 'STACKING_STAT', stat: 'attackSpeed', value: 0.25, maxStacks: 4, trigger: { when: 'ON_NTH_ATTACK', threshold: 4 } }] },
    ],
  },
  {
    id: 'iron_horse', name: '철마', category: 'HISTORY', thresholds: [2, 4],
    emblemItemId: null,
    description: '쉬지 않고 달린 무쇠 다리.',
    tiers: [
      { count: 2, description: '최대 체력 +10%. 체력 30% 이하에서 받는 피해 8% 감소',
        effects: [mul('hp', 0.1), { kind: 'DAMAGE_REDUCTION', value: 0.08, trigger: { when: 'HP_BELOW', threshold: 0.3 } }] },
      { count: 4, description: '최대 체력 +20%. 체력 30% 이하에서 받는 피해 18% 감소',
        effects: [mul('hp', 0.2), { kind: 'DAMAGE_REDUCTION', value: 0.18, trigger: { when: 'HP_BELOW', threshold: 0.3 } }] },
    ],
  },
];

export const TRAIT_BY_ID = new Map<TraitId, TraitDef>(TRAIT_DEFS.map((t) => [t.id, t]));

export function getTrait(id: TraitId): TraitDef {
  const t = TRAIT_BY_ID.get(id);
  if (!t) throw new Error(`Unknown trait id: ${id}`);
  return t;
}

/** Highest reached tier index for a live unit count, or -1 when inactive. */
export function activeTierIndex(trait: TraitDef, count: number): number {
  let idx = -1;
  for (let i = 0; i < trait.thresholds.length; i += 1) {
    if (count >= trait.thresholds[i]) idx = i;
  }
  return idx;
}
