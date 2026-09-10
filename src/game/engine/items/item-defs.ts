/** 10 components, 55 recipes, 6 artifacts and 6 radiant items; shared effect primitives. */
import type { EffectDef, ItemDef, TraitId } from '../types';

const AD = 'winner_ribbon';
const AR = 'reinforced_horseshoe';
const HP = 'training_belt';
const AP = 'tactics_notebook';
const AS = 'spurt_band';
const MN = 'focus_drop';
const MR = 'weather_cloak';
const CR = 'race_glove';
const SP = 'factor_badge';
const PN = 'support_card';

export const COMPONENT_IDS = [AD, AR, HP, AP, AS, MN, MR, CR, SP, PN] as const;

export const COMPONENT_DEFS: ItemDef[] = [
  {
    id: 'winner_ribbon',
    name: '우승자 리본',
    components: null,
    isComponent: true,
    stats: {
      attackDamage: 5,
      hp: 40,
    },
    pctStats: {},
    tags: ['DAMAGE'],
    slotCost: 1,
    effects: [],
    description: '공격력 +5, 체력 +40.',
  },
  {
    id: 'reinforced_horseshoe',
    name: '강화 편자',
    components: null,
    isComponent: true,
    stats: {
      armor: 15,
      hp: 40,
    },
    tags: ['TANK'],
    slotCost: 1,
    effects: [],
    description: '방어력 +15, 체력 +40.',
    pctStats: {},
  },
  {
    id: 'training_belt',
    name: '트레이닝 벨트',
    components: null,
    isComponent: true,
    stats: {
      hp: 180,
    },
    tags: ['TANK'],
    slotCost: 1,
    effects: [],
    description: '체력 +180.',
    pctStats: {},
  },
  {
    id: 'tactics_notebook',
    name: '작전 노트',
    components: null,
    isComponent: true,
    stats: {
      abilityPower: 12,
      startMana: 3,
    },
    tags: ['DAMAGE'],
    slotCost: 1,
    effects: [],
    description: '주문력 +12, 시작 마나 +3.',
    pctStats: {},
  },
  {
    id: 'spurt_band',
    name: '스퍼트 밴드',
    components: null,
    isComponent: true,
    stats: {},
    pctStats: {
      attackSpeed: 0.12,
    },
    tags: ['DAMAGE'],
    slotCost: 1,
    effects: [],
    description: '공격속도 +12%.',
  },
  {
    id: 'focus_drop',
    name: '집중의 물방울',
    components: null,
    isComponent: true,
    stats: {
      startMana: 10,
    },
    tags: ['MANA'],
    slotCost: 1,
    effects: [
      {
        kind: 'MANA_ADD',
        value: 2,
        trigger: {
          when: 'EVERY_SECONDS',
        },
        interval: 3,
      },
    ],
    description: '시작 마나 +10. 3초마다 마나 +2.',
    pctStats: {},
  },
  {
    id: 'weather_cloak',
    name: '비바람 망토',
    components: null,
    isComponent: true,
    stats: {
      magicResist: 15,
      hp: 40,
    },
    tags: ['TANK'],
    slotCost: 1,
    effects: [],
    description: '마법저항력 +15, 체력 +40.',
    pctStats: {},
  },
  {
    id: 'race_glove',
    name: '레이스 글러브',
    components: null,
    isComponent: true,
    stats: {
      critChance: 0.15,
    },
    tags: ['DAMAGE'],
    slotCost: 1,
    effects: [],
    description: '치명타 확률 +15%.',
    pctStats: {},
  },
  {
    id: 'factor_badge',
    name: '인자 배지',
    components: null,
    isComponent: true,
    stats: {},
    tags: ['EMBLEM'],
    slotCost: 1,
    effects: [],
    description: '능력치 없음. 특성 부여 재료.',
  },
  {
    id: 'support_card',
    name: '서포트 카드',
    components: null,
    isComponent: true,
    stats: {},
    tags: ['EMBLEM'],
    slotCost: 1,
    effects: [],
    description: '능력치 없음. 특성 부여 재료.',
  },
];

type Recipe = Omit<ItemDef, 'isComponent' | 'slotCost'> & { slotCost?: number };

const emblem = (
  id: string,
  name: string,
  a: string,
  b: string,
  trait: TraitId,
  traitName: string,
): Recipe => ({
  id,
  name,
  components: [a, b],
  stats: {},
  tags: ['EMBLEM'],
  unique: true,
  grantsTrait: trait,
  effects: [],
  description: `${traitName} 특성 +1.`,
});

const RECIPES: Recipe[] = [
  {
    id: 'champion_trophy',
    name: '연승 사냥꾼의 트로피',
    components: ['winner_ribbon', 'winner_ribbon'],
    stats: {},
    pctStats: {
      attackDamage: 0.2,
    },
    tags: ['DAMAGE'],
    effects: [
      {
        kind: 'STACKING_STAT',
        value: 0.06,
        trigger: {
          when: 'ON_TAKEDOWN_ASSIST',
        },
        stat: 'attackDamage',
        tag: 'PCT',
        maxStacks: 4,
      },
    ],
    description: '공격력 +20%. 처치 관여마다 공격력 +6%, 전투당 최대 4중첩.',
  },
  {
    id: 'twilight_racing_suit',
    name: '삼박자 승부복',
    components: ['winner_ribbon', 'reinforced_horseshoe'],
    stats: {
      armor: 20,
      hp: 100,
    },
    pctStats: {
      attackDamage: 0.1,
    },
    tags: ['DAMAGE', 'TANK'],
    effects: [
      {
        kind: 'SPELLBLADE',
        value: 0,
        trigger: {
          when: 'ON_CAST',
        },
        scaling: {
          attackDamage: 0.8,
        },
        damageType: 'PHYSICAL',
        duration: 5,
        interval: 2,
      },
      {
        kind: 'STAT_MUL',
        value: 0.2,
        trigger: {
          when: 'ON_ATTACK',
        },
        stat: 'moveSpeedHexPerSec',
        duration: 2,
        refresh: true,
      },
    ],
    description:
      '방어력 +20, 체력 +100, 공격력 +10%. 스킬 사용 후 5초 내 다음 기본 공격에 공격력 80% 추가 물리 피해(2초 재사용). 공격 후 2초간 이동속도 +20%, 중첩 없이 갱신.',
    uniqueGroup: 'spellblade',
  },
  {
    id: 'unyielding_fighting_spirit',
    name: '불굴의 승부근성',
    components: ['winner_ribbon', 'training_belt'],
    stats: {
      hp: 300,
    },
    pctStats: {
      attackDamage: 0.1,
    },
    tags: ['DAMAGE', 'TANK'],
    effects: [
      {
        kind: 'SHIELD_MAXHP_PCT',
        value: 0.3,
        trigger: {
          when: 'HP_BELOW',
          threshold: 0.35,
        },
        target: 'SELF',
        oncePerCombat: true,
        duration: 4,
      },
      {
        kind: 'CC_RESIST',
        value: 0.2,
      },
    ],
    description:
      '체력 +300, 공격력 +10%. 체력이 처음 35% 아래가 되면 최대 체력 30% 보호막(4초). 군중제어 지속시간 20% 감소.',
  },
  {
    id: 'trainer_lifeblade',
    name: '동행의 생명검',
    components: ['winner_ribbon', 'tactics_notebook'],
    stats: {
      abilityPower: 20,
    },
    pctStats: {
      attackDamage: 0.1,
    },
    tags: ['DAMAGE', 'UTILITY'],
    effects: [
      {
        kind: 'OMNIVAMP',
        value: 0.14,
      },
      {
        kind: 'HEAL',
        value: 65,
        trigger: {
          when: 'ON_NTH_ATTACK',
          threshold: 3,
        },
        target: 'LOWEST_HP_ALLY',
        excludeSelf: true,
      },
    ],
    description:
      '주문력 +20, 공격력 +10%. 모든 피해 흡혈 14%. 기본 공격 3회마다 자신 외 체력 비율이 가장 낮은 아군 65 회복.',
  },
  {
    id: 'giant_overtaker',
    name: '거인 추월자',
    components: ['winner_ribbon', 'spurt_band'],
    stats: {},
    pctStats: {
      attackDamage: 0.1,
      attackSpeed: 0.2,
    },
    tags: ['DAMAGE'],
    effects: [
      {
        kind: 'PROC_DAMAGE',
        value: 0,
        trigger: {
          when: 'ON_ATTACK',
        },
        scaling: {
          targetCurrentHp: 0.045,
          cap: 100,
        },
        damageType: 'PHYSICAL',
      },
      {
        kind: 'OMNIVAMP',
        value: 0.08,
      },
    ],
    description:
      '공격력 +10%, 공격속도 +20%. 기본 공격 적중 후 대상 현재 체력 4.5% 추가 물리 피해(최대 100). 모든 피해 흡혈 8%.',
    uniqueGroup: 'giant_overtaker',
  },
  {
    id: 'start_dash_plan',
    name: '축적형 스타트 작전',
    components: ['winner_ribbon', 'focus_drop'],
    stats: {
      startMana: 15,
    },
    pctStats: {
      attackDamage: 0.1,
    },
    tags: ['DAMAGE', 'MANA'],
    effects: [
      {
        kind: 'ON_HIT_MANA',
        value: 3,
        trigger: {
          when: 'ON_ATTACK',
        },
      },
      {
        kind: 'STACKING_STAT',
        value: 0.08,
        trigger: {
          when: 'ON_CAST',
        },
        stat: 'attackDamage',
        tag: 'PCT',
        maxStacks: 4,
      },
    ],
    description:
      '시작 마나 +15, 공격력 +10%. 공격마다 마나 +3. 스킬 사용마다 공격력 +8%, 전투당 최대 4중첩.',
  },
  {
    id: 'victory_bloodwind',
    name: '갈라진 결승선',
    components: ['winner_ribbon', 'weather_cloak'],
    stats: {
      hp: 150,
      magicResist: 20,
    },
    pctStats: {
      attackDamage: 0.1,
    },
    tags: ['DAMAGE', 'TANK'],
    effects: [
      {
        kind: 'HEAL_MISSING_PCT',
        value: 0.15,
        trigger: {
          when: 'ON_ATTACK',
        },
        target: 'SELF',
        interval: 6,
        perTargetCooldown: true,
      },
      {
        kind: 'PROC_DAMAGE',
        value: 0,
        trigger: {
          when: 'ON_ATTACK',
        },
        scaling: {
          attackDamage: 0.55,
        },
        damageType: 'PHYSICAL',
        interval: 6,
        perTargetCooldown: true,
      },
    ],
    description:
      '체력 +150, 마법저항력 +20, 공격력 +10%. 대상별 6초마다 기본 공격에 공격력 55% 추가 물리 피해와 자신의 잃은 체력 15% 회복.',
  },
  {
    id: 'finish_line_strike',
    name: '결승선의 일격',
    components: ['winner_ribbon', 'race_glove'],
    stats: {
      critChance: 0.2,
    },
    pctStats: {
      attackDamage: 0.15,
    },
    tags: ['DAMAGE'],
    effects: [
      {
        kind: 'CRIT_DAMAGE_ADD',
        value: 0.3,
      },
      {
        kind: 'SKILLS_CAN_CRIT',
        value: 1,
      },
    ],
    description: '치명타 확률 +20%, 공격력 +15%. 치명타 피해 +30%. 스킬도 치명타가 발생한다.',
  },
  {
    id: 'iron_stable',
    name: '가시 편자의 마굿간',
    components: ['reinforced_horseshoe', 'reinforced_horseshoe'],
    stats: {
      armor: 50,
    },
    pctStats: {},
    tags: ['TANK'],
    effects: [
      {
        kind: 'PROC_DAMAGE',
        value: 25,
        trigger: {
          when: 'ON_BASIC_HIT_TAKEN',
        },
        scaling: {
          armor: 0.4,
        },
        damageType: 'MAGIC',
        interval: 2,
      },
      {
        kind: 'WOUND',
        value: 0.33,
        trigger: {
          when: 'ON_BASIC_HIT_TAKEN',
        },
        duration: 4,
        target: 'CURRENT_TARGET',
      },
    ],
    description:
      '방어력 +50. 기본 공격 피격 시 공격자에게 25 + 방어력 40% 마법 피해(2초 재사용). 공격자에게 4초간 치유 감소 33%.',
  },
  {
    id: 'heated_training_blanket',
    name: '잿불 훈련 담요',
    components: ['reinforced_horseshoe', 'training_belt'],
    stats: {
      armor: 20,
      hp: 250,
    },
    pctStats: {},
    tags: ['TANK'],
    effects: [
      {
        kind: 'BURN',
        value: 0.008,
        trigger: {
          when: 'EVERY_SECONDS',
        },
        interval: 2,
        target: 'ALL_ENEMIES',
        radius: 1,
        duration: 3,
      },
    ],
    description:
      '방어력 +20, 체력 +250. 2초마다 주변 1칸 모든 적에게 3초 화상: 초당 최대 체력 0.8% 고정 피해와 치유 감소 33%.',
  },
  {
    id: 'trainer_crownguard',
    name: '개화하는 크라운가드',
    components: ['reinforced_horseshoe', 'tactics_notebook'],
    stats: {
      armor: 25,
      abilityPower: 25,
    },
    pctStats: {},
    tags: ['TANK', 'DAMAGE'],
    effects: [
      {
        kind: 'SHIELD_MAXHP_PCT',
        value: 0.12,
        trigger: {
          when: 'ON_CAST',
        },
        target: 'SELF',
        duration: 4,
        interval: 4,
      },
      {
        kind: 'STACKING_STAT',
        value: 6,
        trigger: {
          when: 'ON_CAST',
        },
        stat: 'abilityPower',
        maxStacks: 5,
      },
    ],
    description:
      '방어력 +25, 주문력 +25. 스킬 사용 시 최대 체력 12% 보호막(4초, 4초 재사용). 시전마다 주문력 +6, 전투당 최대 5중첩.',
  },
  {
    id: 'iron_horseshoe_resolve',
    name: '반격의 철편자',
    components: ['reinforced_horseshoe', 'spurt_band'],
    stats: {
      armor: 25,
    },
    pctStats: {
      attackSpeed: 0.2,
    },
    tags: ['TANK', 'DAMAGE'],
    effects: [
      {
        kind: 'SHIELD_MAXHP_PCT',
        value: 0.08,
        trigger: {
          when: 'ON_BASIC_HIT_TAKEN',
        },
        target: 'SELF',
        duration: 4,
        interval: 4,
      },
      {
        kind: 'STAT_MUL',
        value: 0.3,
        trigger: {
          when: 'ON_BASIC_HIT_TAKEN',
        },
        stat: 'attackSpeed',
        duration: 3,
        refresh: true,
      },
    ],
    description:
      '방어력 +25, 공격속도 +20%. 기본 공격 피격 시 최대 체력 8% 보호막(4초 재사용)과 3초간 공격속도 +30%. 공격속도는 중첩 없이 갱신.',
  },
  {
    id: 'pre_race_vow',
    name: '혹한의 출전 맹세',
    components: ['reinforced_horseshoe', 'focus_drop'],
    stats: {
      armor: 25,
      hp: 150,
      startMana: 15,
    },
    pctStats: {},
    tags: ['TANK', 'MANA'],
    effects: [
      {
        kind: 'SHIELD_MAXHP_PCT',
        value: 0.16,
        trigger: {
          when: 'ON_CC_APPLIED',
        },
        target: 'SELF',
        duration: 4,
        interval: 4,
      },
    ],
    description:
      '방어력 +25, 체력 +150, 시작 마나 +15. 적에게 군중제어를 실제 적용하면 최대 체력 16% 보호막(4초). 4초 재사용. 면역으로 막힌 제어에는 발동하지 않는다.',
  },
  {
    id: 'racecourse_stoneplate',
    name: '장기전 석갑',
    components: ['reinforced_horseshoe', 'weather_cloak'],
    stats: {
      armor: 25,
      magicResist: 25,
    },
    pctStats: {},
    tags: ['TANK'],
    effects: [
      {
        kind: 'STAT_ADD',
        value: 25,
        trigger: {
          when: 'AFTER_SECONDS',
          threshold: 6,
        },
        stat: 'armor',
        oncePerCombat: true,
      },
      {
        kind: 'STAT_ADD',
        value: 25,
        trigger: {
          when: 'AFTER_SECONDS',
          threshold: 6,
        },
        stat: 'magicResist',
        oncePerCombat: true,
      },
    ],
    description:
      '방어력 +25, 마법저항력 +25. 전투 시작 6초 후 방어력과 마법저항력 +25를 추가 획득한다. 전투당 1회.',
  },
  {
    id: 'steadfast_heart',
    name: '굳건한 하트',
    components: ['reinforced_horseshoe', 'race_glove'],
    stats: {
      armor: 20,
      hp: 200,
    },
    pctStats: {},
    tags: ['TANK'],
    effects: [
      {
        kind: 'DAMAGE_REDUCTION',
        value: 0.08,
      },
      {
        kind: 'DAMAGE_REDUCTION',
        value: 0.1,
        trigger: {
          when: 'HP_BELOW',
          threshold: 0.5,
        },
      },
    ],
    description: '방어력 +20, 체력 +200. 받는 피해 8% 감소. 체력 50% 미만에서는 총 18% 감소.',
  },
  {
    id: 'long_distance_training_coat',
    name: '강철심장 훈련 코트',
    components: ['training_belt', 'training_belt'],
    stats: {
      hp: 400,
    },
    pctStats: {},
    tags: ['TANK', 'DAMAGE'],
    effects: [
      {
        kind: 'STACKING_STAT',
        value: 45,
        trigger: {
          when: 'ON_ATTACK',
        },
        stat: 'hp',
        maxStacks: 6,
        interval: 4,
      },
      {
        kind: 'PROC_DAMAGE',
        value: 0,
        trigger: {
          when: 'ON_ATTACK',
        },
        scaling: {
          selfMaxHp: 0.035,
        },
        damageType: 'PHYSICAL',
        interval: 4,
      },
    ],
    description:
      '체력 +400. 4초마다 기본 공격 시 최대 체력 +45(전투당 최대 6중첩), 증가한 최대 체력 3.5% 추가 물리 피해. 성장치는 다음 전투에 초기화.',
    uniqueGroup: 'long_distance_training_coat',
  },
  {
    id: 'burning_spirit_strategy',
    name: '타오르는 투지의 작전서',
    components: ['training_belt', 'tactics_notebook'],
    stats: {
      hp: 200,
      abilityPower: 25,
    },
    pctStats: {},
    tags: ['DAMAGE'],
    effects: [
      {
        kind: 'BURN',
        value: 0.01,
        trigger: {
          when: 'ON_SKILL_HIT',
        },
        duration: 4,
      },
      {
        kind: 'SKILL_DAMAGE_AMP',
        value: 0.08,
        trigger: {
          when: 'AFTER_SECONDS',
          threshold: 6,
        },
      },
    ],
    description:
      '체력 +200, 주문력 +25. 스킬 피해를 받은 적에게 4초 화상: 초당 최대 체력 1% 고정 피해와 치유 감소 33%. 전투 6초 후 스킬 피해 +8%.',
    uniqueGroup: 'burning_spirit_strategy',
  },
  {
    id: 'pace_up_snack',
    name: '실험적 페이스 보급식',
    components: ['training_belt', 'spurt_band'],
    stats: {
      hp: 200,
    },
    pctStats: {
      attackSpeed: 0.2,
    },
    tags: ['DAMAGE'],
    effects: [
      {
        kind: 'STAT_MUL',
        value: 0.4,
        trigger: {
          when: 'ON_CAST',
        },
        stat: 'attackSpeed',
        duration: 4,
        refresh: true,
      },
    ],
    description:
      '체력 +200, 공격속도 +20%. 스킬 사용 후 4초간 공격속도 +40%. 반복 시전은 중첩 없이 지속시간만 갱신.',
  },
  {
    id: 'recovery_saddle',
    name: '달빛 회복의 안장',
    components: ['training_belt', 'focus_drop'],
    stats: {
      hp: 200,
      startMana: 15,
    },
    pctStats: {},
    tags: ['TANK', 'UTILITY'],
    effects: [
      {
        kind: 'HEAL_MAXHP_PCT',
        value: 0.07,
        trigger: {
          when: 'EVERY_SECONDS',
        },
        target: 'LOWEST_HP_ALLY',
        excludeSelf: true,
        interval: 4,
      },
    ],
    description:
      '체력 +200, 시작 마나 +15. 4초마다 자신 외 체력 비율이 가장 낮은 아군의 최대 체력 7%를 회복한다.',
    uniqueGroup: 'recovery_saddle',
  },
  {
    id: 'evening_race_armor',
    name: '쇠약의 야간 갑주',
    components: ['training_belt', 'weather_cloak'],
    stats: {
      hp: 250,
      magicResist: 25,
    },
    pctStats: {},
    tags: ['TANK', 'UTILITY'],
    effects: [
      {
        kind: 'SUNDER_ARMOR_PCT',
        value: 0.2,
        trigger: {
          when: 'EVERY_SECONDS',
        },
        target: 'ALL_ENEMIES',
        radius: 2,
        duration: 2.1,
        interval: 2,
      },
      {
        kind: 'SHRED_MR_PCT',
        value: 0.2,
        trigger: {
          when: 'EVERY_SECONDS',
        },
        target: 'ALL_ENEMIES',
        radius: 2,
        duration: 2.1,
        interval: 2,
      },
    ],
    description:
      '체력 +250, 마법저항력 +25. 2초마다 주변 2칸 적의 방어력과 마법저항력을 20% 감소(2.1초). 범위를 벗어나면 곧 해제된다.',
  },
  {
    id: 'frontline_retake_mallet',
    name: '선두 탈환 메달',
    components: ['training_belt', 'race_glove'],
    stats: {
      hp: 250,
      critChance: 0.15,
    },
    pctStats: {
      attackDamage: 0.1,
    },
    tags: ['DAMAGE'],
    effects: [
      {
        kind: 'PROC_DAMAGE',
        value: 0,
        trigger: {
          when: 'ON_ATTACK',
        },
        scaling: {
          attackDamage: 0.4,
          targetMissingHp: 0.04,
          cap: 150,
        },
        damageType: 'PHYSICAL',
        interval: 4,
      },
    ],
    description:
      '체력 +250, 치명타 확률 +15%, 공격력 +10%. 4초마다 기본 공격에 공격력 40% + 대상 잃은 체력 4% 추가 물리 피해(최대 150).',
  },
  {
    id: 'genius_trainer_hat',
    name: '완성형 트레이너 모자',
    components: ['tactics_notebook', 'tactics_notebook'],
    stats: {
      abilityPower: 50,
    },
    pctStats: {},
    tags: ['DAMAGE'],
    effects: [
      {
        kind: 'STACKING_STAT',
        value: 10,
        trigger: {
          when: 'ON_CAST',
        },
        stat: 'abilityPower',
        maxStacks: 4,
      },
    ],
    description: '주문력 +50. 스킬 사용마다 주문력 +10, 전투당 최대 4중첩.',
  },
  {
    id: 'endless_spurt',
    name: '내셔의 스퍼트 노트',
    components: ['tactics_notebook', 'spurt_band'],
    stats: {
      abilityPower: 30,
    },
    pctStats: {
      attackSpeed: 0.2,
    },
    tags: ['DAMAGE'],
    effects: [
      {
        kind: 'PROC_DAMAGE',
        value: 15,
        trigger: {
          when: 'ON_ATTACK',
        },
        scaling: {
          abilityPower: 0.22,
        },
        damageType: 'MAGIC',
      },
    ],
    description: '주문력 +30, 공격속도 +20%. 기본 공격마다 15 + 주문력 22% 추가 마법 피해.',
  },
  {
    id: 'accumulated_fighting_spirit',
    name: '영겁의 투지',
    components: ['tactics_notebook', 'focus_drop'],
    stats: {
      hp: 150,
      abilityPower: 20,
      startMana: 15,
    },
    pctStats: {},
    tags: ['DAMAGE', 'MANA'],
    effects: [
      {
        kind: 'STACKING_STAT',
        value: 10,
        trigger: {
          when: 'EVERY_SECONDS',
        },
        stat: 'abilityPower',
        interval: 4,
        maxStacks: 5,
      },
      {
        kind: 'STACKING_STAT',
        value: 35,
        trigger: {
          when: 'EVERY_SECONDS',
        },
        stat: 'hp',
        interval: 4,
        maxStacks: 5,
      },
    ],
    description:
      '체력 +150, 주문력 +20, 시작 마나 +15. 4초마다 주문력 +10, 최대 체력 +35. 전투당 최대 5중첩이며 다음 전투에 초기화.',
  },
  {
    id: 'gate_shock_device',
    name: '메아리 게이트 충격기',
    components: ['tactics_notebook', 'weather_cloak'],
    stats: {
      abilityPower: 25,
      magicResist: 20,
    },
    pctStats: {},
    tags: ['DAMAGE', 'UTILITY'],
    effects: [
      {
        kind: 'PROC_DAMAGE',
        value: 30,
        trigger: {
          when: 'ON_SKILL_HIT',
        },
        scaling: {
          abilityPower: 0.35,
        },
        damageType: 'MAGIC',
        target: 'CURRENT_TARGET',
        radius: 1,
        interval: 3,
      },
    ],
    description:
      '주문력 +25, 마법저항력 +20. 스킬 적중 시 대상과 주변 1칸 적에게 30 + 주문력 35% 추가 마법 피해. 3초 재사용.',
  },
  {
    id: 'jewel_race_glove',
    name: '그림자 보석 글러브',
    components: ['tactics_notebook', 'race_glove'],
    stats: {
      abilityPower: 30,
      critChance: 0.2,
    },
    pctStats: {},
    tags: ['DAMAGE'],
    effects: [
      {
        kind: 'SKILLS_CAN_CRIT',
        value: 1,
      },
      {
        kind: 'SKILL_DAMAGE_AMP',
        value: 0.15,
        trigger: {
          when: 'TARGET_HP_BELOW',
          threshold: 0.4,
        },
      },
    ],
    description:
      '주문력 +30, 치명타 확률 +20%. 스킬 치명타 가능. 현재 공격 대상의 체력이 40% 이하면 스킬 피해 +15%.',
  },
  {
    id: 'red_turf_booster',
    name: '삼연격 터프 부스터',
    components: ['spurt_band', 'spurt_band'],
    stats: {},
    pctStats: {
      attackSpeed: 0.35,
    },
    tags: ['DAMAGE'],
    effects: [
      {
        kind: 'PROC_DAMAGE',
        value: 35,
        trigger: {
          when: 'ON_NTH_ATTACK',
          threshold: 3,
        },
        scaling: {
          attackDamage: 0.6,
          targetMissingHp: 0.025,
          cap: 180,
        },
        damageType: 'PHYSICAL',
      },
    ],
    description:
      '공격속도 +35%. 기본 공격 3회마다 35 + 공격력 60% + 대상 잃은 체력 2.5% 추가 물리 피해(최대 180). 대상 변경 후에도 공격 횟수 유지.',
    uniqueGroup: 'red_turf_booster',
  },
  {
    id: 'corner_piercer',
    name: '갈래바람 관통봉',
    components: ['spurt_band', 'focus_drop'],
    stats: {
      startMana: 15,
    },
    pctStats: {
      attackSpeed: 0.2,
    },
    tags: ['DAMAGE', 'MANA'],
    effects: [
      {
        kind: 'PROC_DAMAGE',
        value: 0,
        trigger: {
          when: 'ON_ATTACK',
        },
        scaling: {
          attackDamage: 0.3,
        },
        damageType: 'PHYSICAL',
        target: 'CURRENT_TARGET',
        radius: 1,
        interval: 2,
      },
    ],
    description:
      '시작 마나 +15, 공격속도 +20%. 2초마다 기본 공격 대상과 주변 1칸 모든 적에게 공격력 30% 추가 물리 피해.',
  },
  {
    id: 'breakaway_horseshoe',
    name: '파죽지세 편자',
    components: ['spurt_band', 'weather_cloak'],
    stats: {
      magicResist: 25,
    },
    pctStats: {
      attackSpeed: 0.2,
    },
    tags: ['DAMAGE'],
    effects: [
      {
        kind: 'PROC_DAMAGE',
        value: 40,
        trigger: {
          when: 'ON_SAME_TARGET_NTH_ATTACK',
          threshold: 3,
        },
        scaling: {
          attackDamage: 0.5,
        },
        damageType: 'MAGIC',
      },
      {
        kind: 'HEAL',
        value: 35,
        trigger: {
          when: 'ON_SAME_TARGET_NTH_ATTACK',
          threshold: 3,
        },
        target: 'SELF',
      },
    ],
    description:
      '마법저항력 +25, 공격속도 +20%. 같은 적을 연속 3회 공격할 때마다 40 + 공격력 50% 추가 마법 피해와 자신의 체력 35 회복. 대상 변경 시 횟수 초기화.',
  },
  {
    id: 'last_overtake',
    name: '칠흑의 추월 편자',
    components: ['spurt_band', 'race_glove'],
    stats: {
      critChance: 0.15,
    },
    pctStats: {
      attackSpeed: 0.2,
    },
    tags: ['DAMAGE'],
    effects: [
      {
        kind: 'SUNDER_ARMOR_PCT',
        value: 0.06,
        trigger: {
          when: 'ON_ATTACK',
        },
        duration: 5,
        maxStacks: 5,
      },
    ],
    description:
      '치명타 확률 +15%, 공격속도 +20%. 기본 공격마다 대상 방어력 6% 감소(5초, 최대 5중첩 30%). 같은 출처는 지속시간 갱신, 다른 방어력 감소와는 가장 큰 값만 적용.',
  },
  {
    id: 'blue_focus',
    name: '마나 순환 결정',
    components: ['focus_drop', 'focus_drop'],
    stats: {
      startMana: 30,
      abilityPower: 15,
    },
    pctStats: {},
    tags: ['MANA'],
    effects: [
      {
        kind: 'MANA_ADD',
        value: 10,
        trigger: {
          when: 'ON_CAST',
        },
      },
      {
        kind: 'MANA_ADD',
        value: 15,
        trigger: {
          when: 'ON_TAKEDOWN_ASSIST',
        },
        interval: 2,
      },
    ],
    description:
      '시작 마나 +30, 주문력 +15. 스킬 사용 후 마나 10 회복. 처치 관여 시 마나 15 추가 회복(2초 재사용).',
  },
  {
    id: 'adaptive_headgear',
    name: '겨울 집중 헤드기어',
    components: ['focus_drop', 'weather_cloak'],
    stats: {
      startMana: 15,
      magicResist: 30,
      hp: 150,
    },
    pctStats: {},
    tags: ['MANA', 'TANK'],
    effects: [
      {
        kind: 'SHIELD_MAXHP_PCT',
        value: 0.1,
        trigger: {
          when: 'ON_CAST',
        },
        target: 'SELF',
        duration: 4,
        interval: 3,
      },
      {
        kind: 'MANA_ADD',
        value: 5,
        trigger: {
          when: 'EVERY_SECONDS',
        },
        interval: 3,
      },
    ],
    description:
      '시작 마나 +15, 마법저항력 +30, 체력 +150. 3초마다 마나 +5. 스킬 사용 시 최대 체력 10% 보호막(4초, 3초 재사용).',
  },
  {
    id: 'hand_of_victory',
    name: '구원의 손길',
    components: ['focus_drop', 'race_glove'],
    stats: {
      startMana: 15,
      critChance: 0.15,
      abilityPower: 20,
    },
    pctStats: {},
    tags: ['UTILITY', 'MANA'],
    effects: [
      {
        kind: 'HEAL_MISSING_PCT',
        value: 0.18,
        trigger: {
          when: 'ON_CAST',
        },
        target: 'LOWEST_HP_ALLY',
        excludeSelf: true,
        interval: 3,
      },
      {
        kind: 'OMNIVAMP',
        value: 0.1,
      },
    ],
    description:
      '시작 마나 +15, 치명타 확률 +15%, 주문력 +20. 스킬 사용 시 자신 외 체력 비율이 가장 낮은 아군의 잃은 체력 18% 회복(3초 재사용). 모든 피해 흡혈 10%.',
  },
  {
    id: 'stormproof_racing_cloak',
    name: '정령의 방풍 마의',
    components: ['weather_cloak', 'weather_cloak'],
    stats: {
      magicResist: 55,
      hp: 200,
    },
    pctStats: {},
    tags: ['TANK'],
    effects: [
      {
        kind: 'HEAL_SHIELD_AMP',
        value: 0.25,
      },
      {
        kind: 'HEAL_MAXHP_PCT',
        value: 0.025,
        trigger: {
          when: 'EVERY_SECONDS',
        },
        target: 'SELF',
        interval: 3,
      },
    ],
    description:
      '마법저항력 +55, 체력 +200. 받는 회복과 보호막 +25%. 3초마다 자신의 최대 체력 2.5% 회복.',
  },
  {
    id: 'composure_ribbon',
    name: '평정의 리본',
    components: ['weather_cloak', 'race_glove'],
    stats: {
      magicResist: 25,
      critChance: 0.15,
    },
    pctStats: {
      attackSpeed: 0.2,
    },
    tags: ['TANK', 'DAMAGE'],
    effects: [
      {
        kind: 'CC_IMMUNE',
        value: 0,
        trigger: {
          when: 'COMBAT_START',
        },
        duration: 6,
      },
      {
        kind: 'CC_RESIST',
        value: 0.35,
      },
    ],
    description:
      '마법저항력 +25, 치명타 확률 +15%, 공격속도 +20%. 전투 시작 6초간 군중제어 면역. 이후 군중제어 지속시간 35% 감소.',
  },
  {
    id: 'trick_strategy_gloves',
    name: '변칙 작전 글러브',
    components: [CR, CR],
    stats: {},
    tags: ['UTILITY'],
    unique: true,
    slotCost: 3,
    effects: [],
    description: '아이템 슬롯 3칸 사용. 매 준비 단계 종료 시 완성 아이템 2개를 무작위로 장착.',
  },

  // ---- 인자 배지 엠블럼 8종 ----
  emblem('emblem_nige', '도주 인자', SP, AD, 'nige', '도주'),
  emblem('emblem_senko', '선행 인자', SP, AR, 'senko', '선행'),
  emblem('emblem_sashi', '선입 인자', SP, HP, 'sashi', '선입'),
  emblem('emblem_oikomi', '추입 인자', SP, AP, 'oikomi', '추입'),
  emblem('emblem_sprinter', '스프린터 인자', SP, AS, 'sprinter', '스프린터'),
  emblem('emblem_miler', '마일러 인자', SP, MN, 'miler', '마일러'),
  emblem('emblem_middle', '중거리 인자', SP, MR, 'middle', '중거리'),
  emblem('emblem_stayer', '스테이어 인자', SP, CR, 'stayer', '스테이어'),

  // ---- 서포트 카드 엠블럼 8종 ----
  emblem('emblem_golden_generation', '황금세대 엠블럼', PN, AD, 'golden_generation', '황금세대'),
  emblem('emblem_famous_house', '명가 엠블럼', PN, AR, 'famous_house', '명가'),
  emblem('emblem_dirt_champion', '더트 챔피언 엠블럼', PN, HP, 'dirt_champion', '더트 챔피언'),
  emblem('emblem_international', '국제파 엠블럼', PN, AP, 'international', '국제파'),
  emblem('emblem_unbeaten', '무패 전설 엠블럼', PN, AS, 'unbeaten', '무패 전설'),
  emblem('emblem_comeback', '역전극 엠블럼', PN, MN, 'comeback', '역전극'),
  emblem('emblem_triple_crown', '삼관 엠블럼', PN, MR, 'triple_crown', '삼관'),
  emblem('emblem_era_star', '시대의 스타 엠블럼', PN, CR, 'era_star', '시대의 스타'),

  // ---- 전략가 전용 3종 ----
  {
    id: 'trainer_crown',
    name: '트레이너 왕관',
    components: [SP, SP],
    stats: {},
    tags: ['TACTICIAN'],
    tactician: true,
    slotCost: 0,
    effects: [],
    description: '전략가 전용. 팀 최대 규모 +1. 유닛에게 장착하지 않는다.',
  },
  {
    id: 'trainer_cloak',
    name: '트레이너 망토',
    components: [SP, PN],
    stats: {},
    tags: ['TACTICIAN'],
    tactician: true,
    slotCost: 0,
    effects: [
      {
        kind: 'STAT_MUL',
        stat: 'moveSpeedHexPerSec',
        value: 0.1,
        duration: 10,
        target: 'ALL_ALLIES',
        trigger: { when: 'COMBAT_START' },
      },
    ],
    description: '전략가 전용. 팀 최대 규모 +1. 전투 시작 시 아군 전체 이동속도 +10%(10초).',
  },
  {
    id: 'trainer_shield',
    name: '트레이너 방패',
    components: [PN, PN],
    stats: {},
    tags: ['TACTICIAN'],
    tactician: true,
    slotCost: 0,
    effects: [],
    description: '전략가 전용. 팀 최대 규모 +1. 플레이어가 받는 라운드 피해 10% 감소(최소 1).',
  },
];

export const COMPLETED_ITEM_DEFS: ItemDef[] = RECIPES.map((r) => ({
  ...r,
  isComponent: false,
  slotCost: r.slotCost ?? 1,
  effects: r.effects as EffectDef[],
}));

export const SPECIAL_ITEM_DEFS: ItemDef[] = [
  {
    id: 'artifact_echo_lantern',
    name: '유물 · 메아리 등불',
    iconId: 'gate_shock_device',
    tier: 'ARTIFACT',
    components: null,
    isComponent: false,
    slotCost: 1,
    uniqueGroup: 'artifact_echo_lantern',
    stats: {
      abilityPower: 45,
      startMana: 20,
    },
    pctStats: {},
    effects: [
      {
        kind: 'PROC_DAMAGE',
        value: 45,
        trigger: {
          when: 'ON_SKILL_HIT',
        },
        scaling: {
          abilityPower: 0.5,
        },
        damageType: 'MAGIC',
        target: 'CURRENT_TARGET',
        radius: 1,
        interval: 3,
      },
      {
        kind: 'MANA_ADD',
        value: 15,
        trigger: {
          when: 'ON_KILL',
        },
        interval: 2,
      },
    ],
    description:
      '주문력 +45, 시작 마나 +20. 스킬 적중 시 대상과 주변 1칸에 45 + 주문력 50% 마법 피해(3초 재사용). 처치 시 마나 +15(2초 재사용).',
    tags: ['DAMAGE', 'MANA'],
  },
  {
    id: 'artifact_moon_chime',
    name: '유물 · 월석 공명종',
    iconId: 'recovery_saddle',
    tier: 'ARTIFACT',
    components: null,
    isComponent: false,
    slotCost: 1,
    uniqueGroup: 'artifact_moon_chime',
    stats: {
      abilityPower: 30,
      hp: 200,
      startMana: 20,
    },
    pctStats: {},
    effects: [
      {
        kind: 'HEAL',
        value: 100,
        trigger: {
          when: 'ON_SUPPORT_SKILL',
        },
        target: 'LOWEST_HP_ALLY',
        excludeSelf: true,
        interval: 2,
      },
    ],
    description:
      '주문력 +30, 체력 +200, 시작 마나 +20. 자신의 스킬로 다른 아군을 실제 회복시키거나 보호막을 주면, 자신 외 체력 비율이 가장 낮은 아군 100 회복(2초 재사용). 아이템 회복은 연쇄 발동하지 않는다.',
    tags: ['UTILITY', 'MANA'],
  },
  {
    id: 'artifact_winter_oath',
    name: '유물 · 겨울의 서약',
    iconId: 'pre_race_vow',
    tier: 'ARTIFACT',
    components: null,
    isComponent: false,
    slotCost: 1,
    uniqueGroup: 'artifact_winter_oath',
    stats: {
      armor: 35,
      magicResist: 35,
      hp: 200,
    },
    pctStats: {},
    effects: [
      {
        kind: 'SHIELD_MAXHP_PCT',
        value: 0.2,
        trigger: {
          when: 'ON_CC_APPLIED',
        },
        target: 'SELF',
        duration: 4,
        interval: 3,
      },
    ],
    description:
      '방어력 +35, 마법저항력 +35, 체력 +200. 적에게 군중제어를 실제 적용하면 최대 체력 20% 보호막(4초, 3초 재사용).',
    tags: ['TANK'],
  },
  {
    id: 'artifact_hydra_saddle',
    name: '유물 · 히드라 안장',
    iconId: 'corner_piercer',
    tier: 'ARTIFACT',
    components: null,
    isComponent: false,
    slotCost: 1,
    uniqueGroup: 'artifact_hydra_saddle',
    stats: {
      hp: 350,
    },
    pctStats: {
      attackDamage: 0.15,
    },
    effects: [
      {
        kind: 'PROC_DAMAGE',
        value: 0,
        trigger: {
          when: 'ON_ATTACK',
        },
        scaling: {
          attackDamage: 0.35,
          selfMaxHp: 0.012,
        },
        damageType: 'PHYSICAL',
        target: 'CURRENT_TARGET',
        radius: 1,
        interval: 1.5,
      },
    ],
    description:
      '체력 +350, 공격력 +15%. 1.5초마다 공격 대상과 주변 1칸 모든 적에게 공격력 35% + 자신의 최대 체력 1.2% 물리 피해.',
    tags: ['DAMAGE', 'TANK'],
  },
  {
    id: 'artifact_duelist_clock',
    name: '유물 · 결투자의 시계',
    iconId: 'twilight_racing_suit',
    tier: 'ARTIFACT',
    components: null,
    isComponent: false,
    slotCost: 1,
    uniqueGroup: 'spellblade',
    stats: {
      abilityPower: 35,
      startMana: 15,
    },
    pctStats: {
      attackDamage: 0.15,
    },
    effects: [
      {
        kind: 'SPELLBLADE',
        value: 0,
        trigger: {
          when: 'ON_CAST',
        },
        scaling: {
          attackDamage: 0.7,
          abilityPower: 0.4,
        },
        damageType: 'MAGIC',
        duration: 6,
        interval: 2,
      },
    ],
    description:
      '주문력 +35, 시작 마나 +15, 공격력 +15%. 스킬 사용 후 6초 내 다음 기본 공격에 공격력 70% + 주문력 40% 추가 마법 피해(2초 재사용). 삼박자 승부복 계열과 동시 장착 불가.',
    tags: ['DAMAGE'],
  },
  {
    id: 'artifact_legacy_heart',
    name: '유물 · 계승의 심장',
    iconId: 'long_distance_training_coat',
    tier: 'ARTIFACT',
    components: null,
    isComponent: false,
    slotCost: 1,
    uniqueGroup: 'artifact_legacy_heart',
    stats: {
      hp: 450,
    },
    pctStats: {},
    effects: [
      {
        kind: 'STACKING_STAT',
        value: 60,
        trigger: {
          when: 'ON_ATTACK',
        },
        stat: 'hp',
        maxStacks: 8,
        interval: 3,
      },
      {
        kind: 'HEAL_MISSING_PCT',
        value: 0.12,
        trigger: {
          when: 'ON_CAST',
        },
        target: 'SELF',
        interval: 3,
      },
    ],
    description:
      '체력 +450. 3초마다 공격 시 최대 체력 +60, 전투당 최대 8중첩. 스킬 사용 시 잃은 체력 12% 회복(3초 재사용). 성장치는 다음 전투에 초기화.',
    tags: ['TANK'],
  },
  {
    id: 'radiant_twilight_racing_suit',
    name: '찬란한 · 삼박자 승부복',
    components: null,
    stats: {
      armor: 35,
      hp: 200,
    },
    pctStats: {
      attackDamage: 0.2,
    },
    tags: ['DAMAGE', 'TANK'],
    effects: [
      {
        kind: 'SPELLBLADE',
        value: 0,
        trigger: {
          when: 'ON_CAST',
        },
        scaling: {
          attackDamage: 1.15,
        },
        damageType: 'PHYSICAL',
        duration: 6,
        interval: 2,
      },
      {
        kind: 'STAT_MUL',
        value: 0.3,
        trigger: {
          when: 'ON_ATTACK',
        },
        stat: 'moveSpeedHexPerSec',
        duration: 2,
        refresh: true,
      },
    ],
    description:
      '방어력 +35, 체력 +200, 공격력 +20%. 스킬 사용 후 6초 내 다음 기본 공격에 공격력 115% 추가 물리 피해(2초 재사용). 공격 후 2초간 이동속도 +30%, 중첩 없이 갱신.',
    uniqueGroup: 'spellblade',
    iconId: 'twilight_racing_suit',
    tier: 'RADIANT',
    isComponent: false,
    slotCost: 1,
  },
  {
    id: 'radiant_giant_overtaker',
    name: '찬란한 · 거인 추월자',
    components: null,
    stats: {},
    pctStats: {
      attackDamage: 0.2,
      attackSpeed: 0.3,
    },
    tags: ['DAMAGE'],
    effects: [
      {
        kind: 'PROC_DAMAGE',
        value: 0,
        trigger: {
          when: 'ON_ATTACK',
        },
        scaling: {
          targetCurrentHp: 0.06,
          cap: 150,
        },
        damageType: 'PHYSICAL',
      },
      {
        kind: 'OMNIVAMP',
        value: 0.12,
      },
    ],
    description:
      '공격력 +20%, 공격속도 +30%. 기본 공격 적중 후 대상 현재 체력 6% 추가 물리 피해(최대 150). 모든 피해 흡혈 12%.',
    uniqueGroup: 'giant_overtaker',
    iconId: 'giant_overtaker',
    tier: 'RADIANT',
    isComponent: false,
    slotCost: 1,
  },
  {
    id: 'radiant_long_distance_training_coat',
    name: '찬란한 · 강철심장 훈련 코트',
    components: null,
    stats: {
      hp: 600,
    },
    pctStats: {},
    tags: ['TANK', 'DAMAGE'],
    effects: [
      {
        kind: 'STACKING_STAT',
        value: 60,
        trigger: {
          when: 'ON_ATTACK',
        },
        stat: 'hp',
        maxStacks: 6,
        interval: 4,
      },
      {
        kind: 'PROC_DAMAGE',
        value: 0,
        trigger: {
          when: 'ON_ATTACK',
        },
        scaling: {
          selfMaxHp: 0.05,
        },
        damageType: 'PHYSICAL',
        interval: 4,
      },
    ],
    description:
      '체력 +600. 4초마다 공격 시 최대 체력 +60(전투당 최대 6중첩)과 최대 체력 5% 추가 물리 피해. 성장치는 다음 전투에 초기화.',
    uniqueGroup: 'long_distance_training_coat',
    iconId: 'long_distance_training_coat',
    tier: 'RADIANT',
    isComponent: false,
    slotCost: 1,
  },
  {
    id: 'radiant_recovery_saddle',
    name: '찬란한 · 달빛 회복의 안장',
    components: null,
    stats: {
      hp: 300,
      startMana: 25,
    },
    pctStats: {},
    tags: ['TANK', 'UTILITY'],
    effects: [
      {
        kind: 'HEAL_MAXHP_PCT',
        value: 0.1,
        trigger: {
          when: 'EVERY_SECONDS',
        },
        target: 'LOWEST_HP_ALLY',
        excludeSelf: true,
        interval: 4,
      },
      {
        kind: 'SHIELD_FLAT',
        value: 70,
        trigger: {
          when: 'EVERY_SECONDS',
        },
        target: 'LOWEST_HP_ALLY',
        excludeSelf: true,
        interval: 4,
        duration: 3,
      },
    ],
    description:
      '체력 +300, 시작 마나 +25. 4초마다 자신 외 가장 다친 아군의 최대 체력 10% 회복. 이어 현재 가장 다친 다른 아군에게 70 보호막(3초).',
    uniqueGroup: 'recovery_saddle',
    iconId: 'recovery_saddle',
    tier: 'RADIANT',
    isComponent: false,
    slotCost: 1,
  },
  {
    id: 'radiant_red_turf_booster',
    name: '찬란한 · 삼연격 터프 부스터',
    components: null,
    stats: {},
    pctStats: {
      attackSpeed: 0.5,
    },
    tags: ['DAMAGE'],
    effects: [
      {
        kind: 'PROC_DAMAGE',
        value: 50,
        trigger: {
          when: 'ON_NTH_ATTACK',
          threshold: 3,
        },
        scaling: {
          attackDamage: 0.9,
          targetMissingHp: 0.03,
          cap: 250,
        },
        damageType: 'PHYSICAL',
      },
    ],
    description:
      '공격속도 +50%. 기본 공격 3회마다 50 + 공격력 90% + 대상 잃은 체력 3% 추가 물리 피해(최대 250). 대상 변경 후에도 횟수 유지.',
    uniqueGroup: 'red_turf_booster',
    iconId: 'red_turf_booster',
    tier: 'RADIANT',
    isComponent: false,
    slotCost: 1,
  },
  {
    id: 'radiant_burning_spirit_strategy',
    name: '찬란한 · 타오르는 투지의 작전서',
    components: null,
    stats: {
      hp: 300,
      abilityPower: 40,
    },
    pctStats: {},
    tags: ['DAMAGE'],
    effects: [
      {
        kind: 'BURN',
        value: 0.012,
        trigger: {
          when: 'ON_SKILL_HIT',
        },
        duration: 5,
      },
      {
        kind: 'SKILL_DAMAGE_AMP',
        value: 0.12,
        trigger: {
          when: 'AFTER_SECONDS',
          threshold: 6,
        },
      },
    ],
    description:
      '체력 +300, 주문력 +40. 스킬 피해를 받은 적에게 5초 화상: 초당 최대 체력 1.2% 고정 피해와 치유 감소 33%. 전투 6초 후 스킬 피해 +12%.',
    uniqueGroup: 'burning_spirit_strategy',
    iconId: 'burning_spirit_strategy',
    tier: 'RADIANT',
    isComponent: false,
    slotCost: 1,
  },
];

export const ALL_ITEM_DEFS: ItemDef[] = [
  ...COMPONENT_DEFS,
  ...COMPLETED_ITEM_DEFS,
  ...SPECIAL_ITEM_DEFS,
];
export const ITEM_BY_ID = new Map<string, ItemDef>(ALL_ITEM_DEFS.map((i) => [i.id, i]));

/** Recipe lookup keyed by the sorted component pair, so order never matters. */
export const RECIPE_KEY = (a: string, b: string): string => [a, b].sort().join('+');

export const RECIPE_TABLE = new Map<string, string>(
  COMPLETED_ITEM_DEFS.filter((i) => i.components).map((i) => [
    RECIPE_KEY(i.components![0], i.components![1]),
    i.id,
  ]),
);

export function combine(a: string, b: string): string | null {
  return RECIPE_TABLE.get(RECIPE_KEY(a, b)) ?? null;
}

export function getItem(id: string): ItemDef {
  const item = ITEM_BY_ID.get(id);
  if (!item) throw new Error(`Unknown item id: ${id}`);
  return item;
}

export const TACTICIAN_ITEM_IDS = COMPLETED_ITEM_DEFS.filter((i) => i.tactician).map((i) => i.id);
export const EMBLEM_ITEM_IDS = COMPLETED_ITEM_DEFS.filter((i) => i.grantsTrait).map((i) => i.id);
