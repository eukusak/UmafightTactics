import type { AugmentDef, EffectDef } from '../types';
const add = (stat: EffectDef['stat'], value: number): EffectDef => ({ kind: 'STAT_ADD', stat, value });
const mul = (stat: EffectDef['stat'], value: number): EffectDef => ({ kind: 'STAT_MUL', stat, value });
const event = (kind: EffectDef['kind'], value: number, when: NonNullable<EffectDef['trigger']>['when'], extra: Partial<EffectDef> = {}): EffectDef => ({ kind, value, trigger: { when }, ...extra });
const hero = (unitId: string, name: string, description: string, upgrade: NonNullable<AugmentDef['skillUpgrade']>, extra: Partial<AugmentDef> = {}): AugmentDef => ({
  id: 'hero_' + unitId, grade: 'G', iconId: 'combat_first_cast', name, description,
  filter: { unitIds: [unitId] }, teamEffects: [], skillUpgrade: upgrade, grants: { unitId }, ...extra,
});

/** Adapted mechanics from the supplied TFT sets 6–9, using UFT's costs and combat rules. */
export const EXPANSION_AUGMENTS: AugmentDef[] = [
  { id: 'rookie_rhythm', grade: 'S', iconId: 'shop_low_cost', name: '신예의 박자', description: '1·2코스트 아군 공격속도 +12%.', filter: { maxCost: 2 }, teamEffects: [mul('attackSpeed', .12)] },
  { id: 'middle_class', grade: 'S', iconId: 'combat_front_guard', name: '중견의 저력', description: '3코스트 아군 체력 +100, 시작 마나 +8.', filter: { minCost: 3, maxCost: 3 }, teamEffects: [add('hp', 100), add('startMana', 8)] },
  { id: 'unburdened', grade: 'S', iconId: 'combat_isolated', name: '맨몸의 자신감', description: '장비 없는 아군 공격속도 +15%, 방어력·마저 +12.', filter: { maxItems: 0 }, teamEffects: [mul('attackSpeed', .15), add('armor', 12), add('magicResist', 12)] },
  { id: 'team_diversity', grade: 'S', iconId: 'combat_all_stats', name: '다채로운 팀워크', description: '활성 특성 하나당 아군 공격력·주문력 +2. 특성 10개까지 적용.', activeTraitScaling: true, teamEffects: [add('attackDamage', 2), add('abilityPower', 2)] },
  { id: 'finisher_recovery', grade: 'S', iconId: 'healing_small', name: '승리의 숨 고르기', description: '처치 관여 시 자신의 잃은 체력 10% 회복.', teamEffects: [event('HEAL_MISSING_PCT', .1, 'ON_TAKEDOWN_ASSIST')] },
  { id: 'finisher_mana', grade: 'S', iconId: 'combat_back_focus', name: '다음 작전', description: '처치 관여 시 마나 +8.', teamEffects: [event('MANA_ADD', 8, 'ON_TAKEDOWN_ASSIST')] },
  { id: 'emergency_padding', grade: 'S', iconId: 'combat_front_guard', name: '비상 완충복', description: '체력 35% 미만일 때 전투당 한 번, 4초 동안 최대 체력 12% 보호막.', teamEffects: [{ kind: 'SHIELD_MAXHP_PCT', value: .12, duration: 4, oncePerCombat: true, trigger: { when: 'HP_BELOW', threshold: .35 } }] },
  { id: 'clear_stable', grade: 'S', iconId: 'xp_small', name: '정돈된 마방', description: 'PvP 종료 시 대기석이 비어 있으면 경험치 +2. 장비·기물은 발주 당시 기준.', teamEffects: [], roundReward: { condition: 'EMPTY_BENCH', xp: 2 } },
  { id: 'crowded_stable', grade: 'G', iconId: 'bench_expand', name: '북적이는 훈련장', description: 'PvP 종료 시 대기석에 기물이 5명 이상이면 경험치 +3. 발주 당시 기준.', teamEffects: [], roundReward: { condition: 'FULL_BENCH', xp: 3 } },
  { id: 'calculated_defeat', grade: 'S', iconId: 'economy_streak', name: '패배의 복기', description: 'PvP에서 패배하면 추가 2골드. 무승부 제외.', teamEffects: [], roundReward: { condition: 'LOSS', gold: 2 } },
  { id: 'victory_sponsor', grade: 'G', iconId: 'economy_rich', name: '승전 후원', description: '즉시 6골드. PvP에서 승리하면 추가 2골드.', teamEffects: [], economy: { instantGold: 6 }, roundReward: { condition: 'WIN', gold: 2 } },
  { id: 'spell_jewel', grade: 'G', iconId: 'crit_small', name: '재능의 섬광', description: '스킬에 치명타 적용. 아군 치명타 확률 +10%.', teamEffects: [{ kind: 'SKILLS_CAN_CRIT', value: 1 }, { kind: 'CRIT_CHANCE_ADD', value: .1 }] },
  { id: 'armor_lesson', grade: 'G', iconId: 'combat_execute', name: '약점 분석', description: '기본 공격이 4초 동안 대상 방어력을 15% 낮춥니다.', teamEffects: [event('SUNDER_ARMOR_PCT', .15, 'ON_ATTACK', { duration: 4, target: 'CURRENT_TARGET' })] },
  { id: 'spell_wound', grade: 'G', iconId: 'combat_first_cast', name: '회복 차단 작전', description: '스킬 적중 시 대상의 회복을 4초 동안 25% 줄입니다.', teamEffects: [event('WOUND', .25, 'ON_SKILL_HIT', { duration: 4, target: 'CURRENT_TARGET' })] },
  { id: 'relay_baton', grade: 'G', iconId: 'combat_adjacent', name: '이어지는 바통', description: '아군 사망 시 체력이 가장 낮은 생존 아군에게 5초 보호막 100과 마나 10을 전달합니다.', teamEffects: [event('SHIELD_FLAT', 100, 'ON_DEATH', { duration: 5, target: 'LOWEST_HP_ALLY', excludeSelf: true }), event('MANA_ADD', 10, 'ON_DEATH', { target: 'LOWEST_HP_ALLY', excludeSelf: true })] },
  { id: 'outsider', grade: 'G', iconId: 'combat_isolated', name: '독자적인 길', description: '자신에게 활성 특성이 없는 아군 체력 +300, 공격속도 +30%.', filter: { noActiveTrait: true }, teamEffects: [add('hp', 300), mul('attackSpeed', .3)] },
  { id: 'equipment_pair', grade: 'G', iconId: 'item_complete_anvil', name: '장비 호흡', description: '아이템 2개 이상을 든 아군 피해 +10%, 받는 피해 8% 감소.', filter: { minItems: 2 }, teamEffects: [{ kind: 'DAMAGE_AMP', value: .1 }, { kind: 'DAMAGE_REDUCTION', value: .08 }] },
  { id: 'trophy_memory', grade: 'P', iconId: 'item_radiant', name: '영구 트로피 진열장', description: '연승 사냥꾼의 트로피 1개 획득. PvP에서 트로피가 달성한 최고 중첩(최대 4)을 팀 기록으로 보존하며, 모든 트로피 보유자가 다음 전투를 그 중첩으로 시작합니다. 중첩 상한은 유지됩니다.', teamEffects: [], grants: { itemId: 'champion_trophy' }, rememberItem: 'champion_trophy' },
  { id: 'cast_memory', grade: 'P', iconId: 'combat_mana', name: '영구 작전 기록', description: '축적형 스타트 작전 1개 획득. PvP에서 달성한 이 장비의 최고 중첩(최대 4)을 팀 기록으로 보존하며, 보유자가 다음 전투를 그 중첩으로 시작합니다.', teamEffects: [], grants: { itemId: 'start_dash_plan' }, rememberItem: 'start_dash_plan' },
  { id: 'trophy_mastery', grade: 'G', iconId: 'item_complete_anvil', name: '트로피의 메아리', description: '연승 사냥꾼의 트로피 보유자의 처치 관여가 자신의 잃은 체력 15%를 회복합니다. 트로피 1개 획득.', filter: { itemId: 'champion_trophy' }, teamEffects: [event('HEAL_MISSING_PCT', .15, 'ON_TAKEDOWN_ASSIST')], grants: { itemId: 'champion_trophy' } },
  { id: 'full_kit', grade: 'P', iconId: 'combat_all_stats', name: '완전 무장', description: '아이템 3개를 든 아군 최대 체력 +20%, 피해 +18%.', filter: { minItems: 3 }, teamEffects: [mul('hp', .2), { kind: 'DAMAGE_AMP', value: .18 }] },
  { id: 'spell_echo', grade: 'P', iconId: 'combat_first_cast', name: '마력의 잔향', description: '스킬 사용 시 대상과 주변 1칸 적에게 마법 피해 70을 추가로 가합니다.', teamEffects: [event('PROC_DAMAGE', 70, 'ON_CAST', { damageType: 'MAGIC', radius: 1, target: 'CURRENT_TARGET' })] },
  { id: 'duel_training', grade: 'G', iconId: 'combat_last_stand', name: '실전 성장 훈련', description: 'PvP 처치 1회당 모든 아군 공격력 +1을 영구 획득. 라운드당 최대 3, 총 20중첩. 소환수 제외.', teamEffects: [], growth: { stat: 'attackDamage', value: 1, maxStacks: 20, perRoundCap: 3, event: 'KILL' } },
  { id: 'supply_bundle', grade: 'G', iconId: 'item_component_choice', name: '맞춤형 보급 상자', description: '재료 선택 모루 2개와 제거기 1개 획득.', teamEffects: [], grants: { componentChoice: 2, removers: 1 } },
  hero('haru_urara', '우라라의 응원', '하루 우라라 1명 획득. 스킬에 체력이 가장 낮은 아군의 잃은 체력 15% 회복 추가. PvP 시전마다 자신의 체력 +12 영구 획득(라운드당 3, 최대 20중첩).', { append: [{ kind: 'HEAL_MISSING_PCT', value: .15, target: 'LOWEST_HP_ALLY' }] }, { growth: { stat: 'hp', value: 12, maxStacks: 20, perRoundCap: 3, event: 'CAST' } }),
  hero('rice_shower', '라이스의 검은 가시', '라이스 샤워 1명 획득. 스킬에 자신 주변 1칸 적의 방어력 20% 감소(5초)와 마법 피해 70 추가.', { append: [{ kind: 'SUNDER_ARMOR_PCT', value: .2, duration: 5, radius: 1, target: 'ALL_ENEMIES' }, { kind: 'DAMAGE', value: 70, damageType: 'MAGIC', radius: 1, target: 'ALL_ENEMIES' }] }),
  hero('gold_ship', '골드 쉽의 난파선', '골드 쉽 1명 획득. 스킬에 대상 주변 1칸 물리 피해 80 추가. PvP 처치마다 자신의 공격력 +2 영구 획득(라운드당 2, 최대 15중첩).', { append: [{ kind: 'DAMAGE', value: 80, damageType: 'PHYSICAL', target: 'CURRENT_TARGET', radius: 1 }] }, { growth: { stat: 'attackDamage', value: 2, maxStacks: 15, perRoundCap: 2, event: 'KILL' } }),
  hero('agnes_digital', '디지털의 교차 사격', '아그네스 디지털 1명 획득. 스킬에 가장 먼 적을 향한 두 발의 마법 탄환(각 45) 추가.', { append: [{ kind: 'DAMAGE', value: 45, damageType: 'MAGIC', target: 'FARTHEST_ENEMY' }, { kind: 'DAMAGE', value: 45, damageType: 'MAGIC', target: 'FARTHEST_ENEMY', delay: .3 }] }),
  hero('twin_turbo', '터보의 한계 돌파', '트윈 터보 1명 획득. 스킬 사용 후 4초 동안 공격속도 +40%, 모든 피해 흡혈 +12%.', { append: [{ ...mul('attackSpeed', .4), duration: 4, refresh: true, target: 'SELF' }, { kind: 'OMNIVAMP', value: .12, duration: 4, refresh: true, target: 'SELF' }] }),
  hero('nice_nature', '네이처의 빈틈 공략', '나이스 네이처 1명 획득. 스킬에 대상 마저 25% 감소(5초)와 마나 12 감소 추가.', { append: [{ kind: 'SHRED_MR_PCT', value: .25, duration: 5, target: 'CURRENT_TARGET' }, { kind: 'MANA_DRAIN', value: 12, target: 'CURRENT_TARGET' }] }),
  hero('sakura_bakushin_o', '바쿠신의 선두 명령', '사쿠라 바쿠신 오 1명 획득. 스킬에 인접 아군의 공격속도 +18%(4초) 추가.', { append: [{ ...mul('attackSpeed', .18), duration: 4, refresh: true, radius: 1, target: 'ALL_ALLIES' }] }),
  hero('king_halo', '킹의 품격', '킹 헤일로 1명 획득. 스킬에 체력이 가장 낮은 아군의 방해 효과 해제와 4초 보호막 110 추가.', { append: [{ kind: 'CLEANSE', target: 'LOWEST_HP_ALLY' }, { kind: 'SHIELD_FLAT', value: 110, duration: 4, target: 'LOWEST_HP_ALLY' }] }),
  hero('matikanefukukitaru', '후쿠키타루의 길운', '마치카네 후쿠키타루 1명 획득. 스킬에 체력이 가장 낮은 아군 마나 15 회복 추가. 자신의 회복·보호막 +20%.', { append: [{ kind: 'MANA_ADD', value: 15, target: 'LOWEST_HP_ALLY' }] }, { teamEffects: [{ kind: 'HEAL_SHIELD_AMP', value: .2 }] }),
  hero('hishi_akebono', '아케보노의 큰 품', '히시 아케보노 1명 획득. 스킬 사용 시 자신에게 5초 동안 최대 체력 15% 보호막. 시작 체력 +150.', { append: [{ kind: 'SHIELD_MAXHP_PCT', value: .15, duration: 5, target: 'SELF' }] }, { teamEffects: [add('hp', 150)] }),
  hero('silence_suzuka', '스즈카의 독주', '사일런스 스즈카 1명 획득. 자신의 스킬 피해 +20%. 스킬에 현재 대상 2초 침묵 추가.', { damageMultiplier: 1.2, append: [{ kind: 'APPLY_STATUS', status: 'SILENCE', duration: 2, target: 'CURRENT_TARGET' }] }),
  hero('daiichi_ruby', '루비의 보석 연쇄', '다이이치 루비 1명 획득. 스킬에 적 최대 3명을 튕기는 마법 피해 45의 연쇄 추가.', { append: [{ kind: 'DAMAGE', value: 45, damageType: 'MAGIC', target: 'CURRENT_TARGET', shape: 'CHAIN', maxTargets: 3, radius: 2 }] }),
];
