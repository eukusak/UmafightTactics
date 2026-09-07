/** 10 components + 55 combined items from spec §23, all data, no per-item branching. */
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
  { id: AD, name: '우승자 리본', components: null, isComponent: true, stats: {}, pctStats: { attackDamage: 0.1 },
    tags: ['DAMAGE'], slotCost: 1, effects: [], description: '공격력 +10%' },
  { id: AR, name: '강화 편자', components: null, isComponent: true, stats: { armor: 20 },
    tags: ['TANK'], slotCost: 1, effects: [], description: '방어력 +20' },
  { id: HP, name: '트레이닝 벨트', components: null, isComponent: true, stats: { hp: 150 },
    tags: ['TANK'], slotCost: 1, effects: [], description: '체력 +150' },
  { id: AP, name: '작전 노트', components: null, isComponent: true, stats: { abilityPower: 10 },
    tags: ['DAMAGE'], slotCost: 1, effects: [], description: '주문력 +10' },
  { id: AS, name: '스퍼트 밴드', components: null, isComponent: true, stats: {}, pctStats: { attackSpeed: 0.1 },
    tags: ['DAMAGE'], slotCost: 1, effects: [], description: '공격속도 +10%' },
  { id: MN, name: '집중의 물방울', components: null, isComponent: true, stats: { startMana: 15 },
    tags: ['MANA'], slotCost: 1, effects: [], description: '시작 마나 +15' },
  { id: MR, name: '비바람 망토', components: null, isComponent: true, stats: { magicResist: 20 },
    tags: ['TANK'], slotCost: 1, effects: [], description: '마법저항력 +20' },
  { id: CR, name: '레이스 글러브', components: null, isComponent: true, stats: { critChance: 0.2 },
    tags: ['DAMAGE'], slotCost: 1, effects: [], description: '치명타 확률 +20%' },
  { id: SP, name: '인자 배지', components: null, isComponent: true, stats: {},
    tags: ['EMBLEM'], slotCost: 1, effects: [], description: '능력치 없음. 특성 부여 재료.' },
  { id: PN, name: '서포트 카드', components: null, isComponent: true, stats: {},
    tags: ['EMBLEM'], slotCost: 1, effects: [], description: '능력치 없음. 특성 부여 재료.' },
];

type Recipe = Omit<ItemDef, 'isComponent' | 'slotCost'> & { slotCost?: number };

const emblem = (id: string, name: string, a: string, b: string, trait: TraitId, traitName: string): Recipe => ({
  id, name, components: [a, b], stats: {}, tags: ['EMBLEM'], unique: true, grantsTrait: trait,
  effects: [], description: `${traitName} 특성 +1.`,
});

const RECIPES: Recipe[] = [
  // ---- 우승자 리본 계열 ----
  { id: 'champion_trophy', name: '챔피언 트로피', components: [AD, AD], stats: {}, pctStats: { attackDamage: 0.2 },
    tags: ['DAMAGE'], effects: [], description: '기본 공격력 합산 후 추가 공격력 +20%.' },
  { id: 'twilight_racing_suit', name: '황혼의 승부복', components: [AD, AR], stats: {}, pctStats: { attackDamage: 0.1 },
    tags: ['DAMAGE', 'TANK'],
    effects: [
      { kind: 'UNTARGETABLE', duration: 0.75, oncePerCombat: true, trigger: { when: 'HP_BELOW', threshold: 0.6 } },
      { kind: 'STAT_MUL', stat: 'attackSpeed', value: 0.25, duration: 5, oncePerCombat: true, trigger: { when: 'HP_BELOW', threshold: 0.6 } },
    ],
    description: '체력이 처음 60% 아래로 내려가면 0.75초 대상 지정 불가, 이후 5초간 공격속도 +25%. 전투당 1회.' },
  { id: 'unyielding_fighting_spirit', name: '불굴의 승부근성', components: [AD, HP], stats: { hp: 150 }, pctStats: { attackDamage: 0.1 },
    tags: ['DAMAGE', 'TANK'],
    effects: [
      { kind: 'SHIELD_MAXHP_PCT', value: 0.25, duration: 5, oncePerCombat: true, trigger: { when: 'HP_BELOW', threshold: 0.6 } },
      { kind: 'STAT_MUL', stat: 'attackDamage', value: 0.2, duration: 5, oncePerCombat: true, trigger: { when: 'HP_BELOW', threshold: 0.6 } },
    ],
    description: '체력이 처음 60% 아래로 내려가면 최대 체력 25% 보호막(5초)과 공격력 +20%. 전투당 1회.' },
  { id: 'trainer_lifeblade', name: '트레이너 생명검', components: [AD, AP], stats: { abilityPower: 10 }, pctStats: { attackDamage: 0.1 },
    tags: ['DAMAGE'],
    effects: [{ kind: 'OMNIVAMP', value: 0.2 }, { kind: 'HEAL', value: 0.2, tag: 'SHARE_VAMP_TO_LOWEST', target: 'LOWEST_HP_ALLY' }],
    description: '모든 피해 흡혈 20%. 회복량의 20%를 체력이 가장 낮은 아군에게 전달.' },
  { id: 'giant_overtaker', name: '거인 추월자', components: [AD, AS], stats: {}, pctStats: { attackDamage: 0.1, attackSpeed: 0.1 },
    tags: ['DAMAGE'],
    effects: [
      { kind: 'DAMAGE_AMP', value: 0.15 },
      { kind: 'DAMAGE_AMP', value: 0.25, tag: 'TARGET_MAXHP_AT_LEAST_1600' },
    ],
    description: '피해량 +15%. 대상 최대 체력이 1600 이상이면 추가로 +25%.' },
  { id: 'start_dash_plan', name: '스타트 대시 작전', components: [AD, MN], stats: { startMana: 15 }, pctStats: { attackDamage: 0.1 },
    tags: ['DAMAGE', 'MANA'],
    effects: [{ kind: 'ON_HIT_MANA', value: 5, trigger: { when: 'ON_ATTACK' } }],
    description: '기본 공격마다 추가 마나 +5.' },
  { id: 'victory_bloodwind', name: '우승의 혈풍', components: [AD, MR], stats: { magicResist: 20 }, pctStats: { attackDamage: 0.1 },
    tags: ['DAMAGE', 'TANK'],
    effects: [
      { kind: 'OMNIVAMP', value: 0.2 },
      { kind: 'SHIELD_MAXHP_PCT', value: 0.25, duration: 5, oncePerCombat: true, trigger: { when: 'HP_BELOW', threshold: 0.4 } },
    ],
    description: '모든 피해 흡혈 20%. 체력이 처음 40% 아래로 내려가면 최대 체력 25% 보호막(5초).' },
  { id: 'finish_line_strike', name: '결승선의 일격', components: [AD, CR], stats: { critChance: 0.2 }, pctStats: { attackDamage: 0.1 },
    tags: ['DAMAGE'],
    effects: [
      { kind: 'CRIT_DAMAGE_ADD', value: 0.35 },
      { kind: 'SKILLS_CAN_CRIT', value: 1 },
      { kind: 'CRIT_DAMAGE_ADD', value: 0.5, tag: 'CONVERT_EXCESS_CRIT' },
    ],
    description: '치명타 피해 +35%. 스킬 치명타 가능. 100% 초과 치명타 확률 1%당 치명타 피해 +0.5%.' },

  // ---- 강화 편자 계열 ----
  { id: 'iron_stable', name: '철벽 마굿간', components: [AR, AR], stats: { armor: 40 }, tags: ['TANK'],
    effects: [
      { kind: 'DAMAGE_REDUCTION', value: 0.25, tag: 'CRIT_ONLY' },
      { kind: 'ON_HIT_DAMAGE', value: 60, damageType: 'MAGIC', radius: 1, interval: 2, trigger: { when: 'ON_HIT_TAKEN' } },
    ],
    description: '받는 치명타 피해 25% 감소. 기본 공격 피격 시 주변 1칸 적에게 60 마법피해(2초 재사용).' },
  { id: 'heated_training_blanket', name: '열혈 훈련 담요', components: [AR, HP], stats: { armor: 20, hp: 150 }, tags: ['TANK'],
    effects: [{ kind: 'BURN', value: 0.01, duration: 10, interval: 2, radius: 2, trigger: { when: 'EVERY_SECONDS', threshold: 2 } }],
    description: '2초마다 2칸 내 적 1명에게 10초 화상: 초당 최대 체력 1% 고정피해, 치유량 33% 감소.' },
  { id: 'trainer_crownguard', name: '트레이너 크라운가드', components: [AR, AP], stats: { armor: 20, abilityPower: 10 }, tags: ['TANK', 'DAMAGE'],
    effects: [
      { kind: 'SHIELD_MAXHP_PCT', value: 0.25, duration: 8, trigger: { when: 'COMBAT_START' } },
      { kind: 'STAT_ADD', stat: 'abilityPower', value: 20, trigger: { when: 'AFTER_SECONDS', threshold: 8 } },
    ],
    description: '전투 시작 시 최대 체력 25% 보호막(8초). 보호막 종료 시 주문력 +20.' },
  { id: 'iron_horseshoe_resolve', name: '철편자의 결의', components: [AR, AS], stats: { armor: 20 }, pctStats: { attackSpeed: 0.1 },
    tags: ['TANK', 'DAMAGE'],
    effects: [
      { kind: 'STACKING_STAT', stat: 'attackDamage', value: 0.02, maxStacks: 25, tag: 'PCT', trigger: { when: 'ON_ATTACK' } },
      { kind: 'STACKING_STAT', stat: 'abilityPower', value: 0.02, maxStacks: 25, tag: 'PCT', trigger: { when: 'ON_ATTACK' } },
      { kind: 'STAT_ADD', stat: 'armor', value: 20, tag: 'AT_MAX_STACKS' },
      { kind: 'STAT_ADD', stat: 'magicResist', value: 20, tag: 'AT_MAX_STACKS' },
    ],
    description: '공격하거나 피해를 받으면 결의 1중첩(최대 25). 중첩당 공격력/주문력 +2%. 최대 중첩 시 방어력/마저 +20.' },
  { id: 'pre_race_vow', name: '출전 전 맹세', components: [AR, MN], stats: { armor: 20, startMana: 15 }, tags: ['TANK', 'MANA'],
    effects: [
      { kind: 'SHIELD_MAXHP_PCT', value: 0.25, duration: 5, oncePerCombat: true, trigger: { when: 'HP_BELOW', threshold: 0.4 } },
      { kind: 'STAT_ADD', stat: 'armor', value: 20, oncePerCombat: true, trigger: { when: 'HP_BELOW', threshold: 0.4 } },
      { kind: 'STAT_ADD', stat: 'magicResist', value: 20, oncePerCombat: true, trigger: { when: 'HP_BELOW', threshold: 0.4 } },
    ],
    description: '체력이 처음 40% 아래로 내려가면 최대 체력 25% 보호막(5초)과 방어력/마저 +20. 전투당 1회.' },
  { id: 'racecourse_stoneplate', name: '경주장 석갑', components: [AR, MR], stats: { armor: 20, magicResist: 20 }, tags: ['TANK'],
    effects: [
      { kind: 'STAT_ADD', stat: 'armor', value: 10, tag: 'PER_ATTACKER' },
      { kind: 'STAT_ADD', stat: 'magicResist', value: 10, tag: 'PER_ATTACKER' },
    ],
    description: '자신을 공격 대상으로 삼은 적 1명당 방어력/마저 +10.' },
  { id: 'steadfast_heart', name: '굳건한 하트', components: [AR, CR], stats: { armor: 20, critChance: 0.2 }, tags: ['TANK'],
    effects: [
      { kind: 'DAMAGE_REDUCTION', value: 0.08 },
      { kind: 'DAMAGE_REDUCTION', value: 0.07, trigger: { when: 'HP_ABOVE', threshold: 0.5 } },
    ],
    description: '받는 피해 8% 감소. 체력 50% 이상이면 15% 감소.' },

  // ---- 트레이닝 벨트 계열 ----
  { id: 'long_distance_training_coat', name: '장거리 훈련 코트', components: [HP, HP], stats: { hp: 600 }, pctStats: { hp: 0.12 },
    tags: ['TANK'], effects: [], description: '추가 체력 +600, 최대 체력 +12%.' },
  { id: 'burning_spirit_strategy', name: '타오르는 투지의 작전서', components: [HP, AP], stats: { hp: 150, abilityPower: 10 },
    tags: ['DAMAGE'],
    effects: [{ kind: 'BURN', value: 0.01, duration: 10, tag: 'ON_SKILL_DAMAGE', trigger: { when: 'ON_CAST' } }],
    description: '스킬 피해를 받은 적에게 10초 화상: 초당 최대 체력 1% 고정피해, 치유량 33% 감소.' },
  { id: 'pace_up_snack', name: '페이스 업 보급식', components: [HP, AS], stats: { hp: 150 }, pctStats: { attackSpeed: 0.1 },
    tags: ['DAMAGE'],
    effects: [{ kind: 'STAT_MUL', stat: 'attackSpeed', value: 0.4, duration: 5, trigger: { when: 'ON_CAST' } }],
    description: '스킬 사용 후 5초간 공격속도 +40%.' },
  { id: 'recovery_saddle', name: '회복의 안장', components: [HP, MN], stats: { hp: 150, startMana: 15 }, tags: ['TANK', 'MANA'],
    effects: [
      { kind: 'HEAL_SHIELD_AMP', value: 0.25 },
      { kind: 'HEAL_MAXHP_PCT', value: 0.025, interval: 5, trigger: { when: 'EVERY_SECONDS', threshold: 5 } },
    ],
    description: '받는 회복/보호막 +25%. 5초마다 최대 체력 2.5% 회복.' },
  { id: 'evening_race_armor', name: '야간 경주 갑주', components: [HP, MR], stats: { hp: 150, magicResist: 20 }, tags: ['TANK'],
    effects: [
      { kind: 'SUNDER_ARMOR_PCT', value: 0.2, radius: 2 },
      { kind: 'SHRED_MR_PCT', value: 0.2, radius: 2 },
      { kind: 'STAT_MUL', stat: 'hp', value: 0.1, duration: 10, trigger: { when: 'COMBAT_START' } },
    ],
    description: '2칸 내 적의 방어력/마저 20% 감소. 전투 시작 후 10초간 최대 체력 +10%.' },
  { id: 'frontline_retake_mallet', name: '선두 탈환 메달', components: [HP, CR], stats: { hp: 150, critChance: 0.2 }, tags: ['DAMAGE'],
    effects: [
      { kind: 'STACKING_STAT', stat: 'attackDamage', value: 0.015, maxStacks: 12, tag: 'PCT', trigger: { when: 'ON_ATTACK' } },
      { kind: 'STACKING_STAT', stat: 'abilityPower', value: 0.015, maxStacks: 12, tag: 'PCT', trigger: { when: 'ON_ATTACK' } },
      { kind: 'DAMAGE_AMP', value: 0.1, tag: 'AT_MAX_STACKS' },
    ],
    description: '피해를 받거나 입히면 추월 중첩(최대 12). 중첩당 공격력/주문력 +1.5%. 최대 중첩 시 피해 증폭 +10%.' },

  // ---- 작전 노트 계열 ----
  { id: 'genius_trainer_hat', name: '천재 트레이너 모자', components: [AP, AP], stats: { abilityPower: 70 }, tags: ['DAMAGE'],
    effects: [{ kind: 'SKILL_DAMAGE_AMP', value: 0.1 }],
    description: '주문력 +50 추가, 스킬 피해 +10%.' },
  { id: 'endless_spurt', name: '끝없는 스퍼트', components: [AP, AS], stats: { abilityPower: 10 }, pctStats: { attackSpeed: 0.1 },
    tags: ['DAMAGE'],
    effects: [{ kind: 'STACKING_STAT', stat: 'attackSpeed', value: 0.05, maxStacks: 12, trigger: { when: 'ON_ATTACK' } }],
    description: '기본 공격 시 공격속도 +5% 누적(최대 12중첩).' },
  { id: 'accumulated_fighting_spirit', name: '축적된 투지', components: [AP, MN], stats: { abilityPower: 10, startMana: 15 },
    tags: ['DAMAGE', 'MANA'],
    effects: [{ kind: 'STACKING_STAT', stat: 'abilityPower', value: 20, interval: 5, maxStacks: 99, trigger: { when: 'EVERY_SECONDS', threshold: 5 } }],
    description: '전투 시작 후 5초마다 주문력 +20.' },
  { id: 'gate_shock_device', name: '게이트 충격기', components: [AP, MR], stats: { abilityPower: 10, magicResist: 20 }, tags: ['DAMAGE', 'UTILITY'],
    effects: [
      { kind: 'SHRED_MR_PCT', value: 0.3, radius: 2 },
      { kind: 'DAMAGE', value: 1.6, damageType: 'MAGIC', tag: 'ENEMY_MAXMANA_ON_CAST', interval: 3 },
    ],
    description: '2칸 내 적의 마저 30% 감소. 적이 스킬을 쓰면 최대 마나의 160% 마법피해(대상별 3초 재사용).' },
  { id: 'jewel_race_glove', name: '보석 레이스 글러브', components: [AP, CR], stats: { abilityPower: 25, critChance: 0.2 }, tags: ['DAMAGE'],
    effects: [{ kind: 'SKILLS_CAN_CRIT', value: 1 }, { kind: 'CRIT_DAMAGE_ADD', value: 0.2 }],
    description: '스킬 치명타 가능. 치명타 피해 +20%, 주문력 +15 추가.' },

  // ---- 스퍼트 밴드 계열 ----
  { id: 'red_turf_booster', name: '레드 터프 부스터', components: [AS, AS], stats: {}, pctStats: { attackSpeed: 0.55 },
    tags: ['DAMAGE'],
    effects: [{ kind: 'BURN', value: 0.01, duration: 5, tag: 'ON_BASIC_ATTACK', trigger: { when: 'ON_ATTACK' } }],
    description: '공격속도 +35% 추가. 기본 공격이 5초간 화상을 남긴다.' },
  { id: 'corner_piercer', name: '코너 관통봉', components: [AS, MN], stats: { startMana: 15 }, pctStats: { attackSpeed: 0.1 },
    tags: ['DAMAGE', 'MANA'],
    effects: [
      { kind: 'SPLASH_ON_HIT', value: 0.45, radius: 1, damageType: 'PHYSICAL', trigger: { when: 'ON_ATTACK' } },
      { kind: 'ON_HIT_MANA', value: 2, trigger: { when: 'ON_ATTACK' } },
    ],
    description: '기본 공격 후 대상 주변 1칸의 적 1명에게 45% 물리피해. 공격 시 마나 +2.' },
  { id: 'breakaway_horseshoe', name: '파죽지세 편자', components: [AS, MR], stats: { magicResist: 20 }, pctStats: { attackSpeed: 0.1 },
    tags: ['DAMAGE'],
    effects: [
      { kind: 'ON_HIT_DAMAGE', value: 90, damageType: 'TRUE', trigger: { when: 'ON_NTH_ATTACK', threshold: 3 } },
      { kind: 'DAMAGE_MAXHP_PCT', value: 0.03, damageType: 'TRUE', trigger: { when: 'ON_NTH_ATTACK', threshold: 3 } },
    ],
    description: '같은 대상을 3회 공격할 때마다 90 고정피해 + 대상 최대 체력 3% 고정피해.' },
  { id: 'last_overtake', name: '최후의 추월', components: [AS, CR], stats: { critChance: 0.2 }, pctStats: { attackSpeed: 0.3 },
    tags: ['DAMAGE'],
    effects: [{ kind: 'SUNDER_ARMOR_PCT', value: 0.3, duration: 5, tag: 'ON_PHYSICAL_DAMAGE', trigger: { when: 'ON_ATTACK' } }],
    description: '물리 피해를 입히면 5초간 대상 방어력 30% 감소. 공격속도 +20% 추가.' },

  // ---- 집중의 물방울 계열 ----
  { id: 'blue_focus', name: '푸른 집중력', components: [MN, MN], stats: { startMana: 55 }, tags: ['MANA'],
    effects: [
      { kind: 'MANA_ADD', value: 10, trigger: { when: 'ON_CAST' } },
      { kind: 'MANA_ADD', value: 10, tag: 'IF_MAXMANA_AT_MOST_60', trigger: { when: 'ON_CAST' } },
    ],
    description: '시작 마나 +25 추가. 스킬 사용 후 마나 10 회복. 최대 마나 60 이하면 추가로 10 회복.' },
  { id: 'adaptive_headgear', name: '적응형 헤드기어', components: [MN, MR], stats: { startMana: 15, magicResist: 20 }, tags: ['MANA', 'TANK'],
    effects: [
      { kind: 'STAT_ADD', stat: 'armor', value: 35, trigger: { when: 'IN_FRONT_ROWS' } },
      { kind: 'STAT_ADD', stat: 'magicResist', value: 35, trigger: { when: 'IN_FRONT_ROWS' } },
      { kind: 'MANA_ADD', value: 10, interval: 3, trigger: { when: 'IN_BACK_ROWS' } },
    ],
    description: '앞 2열이면 방어력/마저 +35, 뒤 2열이면 3초마다 마나 +10.' },
  { id: 'hand_of_victory', name: '승리의 손길', components: [MN, CR], stats: { startMana: 15, critChance: 0.2 }, tags: ['DAMAGE', 'MANA'],
    effects: [
      { kind: 'STAT_MUL', stat: 'attackDamage', value: 0.15, tag: 'COINFLIP_A' },
      { kind: 'STAT_MUL', stat: 'abilityPower', value: 0.15, tag: 'COINFLIP_A' },
      { kind: 'OMNIVAMP', value: 0.15, tag: 'COINFLIP_B' },
    ],
    description: '전투 시작 시 두 효과 중 1개를 2배로 적용. 체력 50% 아래에서는 두 효과 모두 적용.' },

  // ---- 비바람 망토 / 레이스 글러브 계열 ----
  { id: 'stormproof_racing_cloak', name: '폭풍 방지 마의', components: [MR, MR], stats: { magicResist: 105 }, tags: ['TANK'],
    effects: [{ kind: 'HEAL_MAXHP_PCT', value: 0.025, interval: 2, trigger: { when: 'EVERY_SECONDS', threshold: 2 } }],
    description: '마법저항력 +65 추가. 2초마다 최대 체력 2.5% 회복.' },
  { id: 'composure_ribbon', name: '평정의 리본', components: [MR, CR], stats: { magicResist: 20, critChance: 0.2 }, pctStats: { attackSpeed: 0.2 },
    tags: ['TANK', 'DAMAGE'],
    effects: [{ kind: 'CC_IMMUNE', duration: 18, trigger: { when: 'COMBAT_START' } }],
    description: '전투 시작 후 18초간 군중제어 면역. 공격속도 +20% 추가.' },
  { id: 'trick_strategy_gloves', name: '변칙 작전 글러브', components: [CR, CR], stats: {}, tags: ['UTILITY'], unique: true, slotCost: 3,
    effects: [], description: '아이템 슬롯 3칸 사용. 매 준비 단계 종료 시 완성 아이템 2개를 무작위로 장착.' },

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
  { id: 'trainer_crown', name: '트레이너 왕관', components: [SP, SP], stats: {}, tags: ['TACTICIAN'], tactician: true, slotCost: 0,
    effects: [], description: '전략가 전용. 팀 최대 규모 +1. 유닛에게 장착하지 않는다.' },
  { id: 'trainer_cloak', name: '트레이너 망토', components: [SP, PN], stats: {}, tags: ['TACTICIAN'], tactician: true, slotCost: 0,
    effects: [{ kind: 'STAT_MUL', stat: 'moveSpeedHexPerSec', value: 0.1, duration: 10, target: 'ALL_ALLIES', trigger: { when: 'COMBAT_START' } }],
    description: '전략가 전용. 팀 최대 규모 +1. 전투 시작 시 아군 전체 이동속도 +10%(10초).' },
  { id: 'trainer_shield', name: '트레이너 방패', components: [PN, PN], stats: {}, tags: ['TACTICIAN'], tactician: true, slotCost: 0,
    effects: [], description: '전략가 전용. 팀 최대 규모 +1. 플레이어가 받는 라운드 피해 10% 감소(최소 1).' },
];

export const COMPLETED_ITEM_DEFS: ItemDef[] = RECIPES.map((r) => ({
  ...r,
  isComponent: false,
  slotCost: r.slotCost ?? 1,
  effects: r.effects as EffectDef[],
}));

export const ALL_ITEM_DEFS: ItemDef[] = [...COMPONENT_DEFS, ...COMPLETED_ITEM_DEFS];
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
