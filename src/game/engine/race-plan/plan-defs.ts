/**
 * The base race plans, chosen at 2-5.
 *
 * A plan is not bound to a unit. It describes *when* this board wants to be
 * strong, and only becomes a unit's plan at the GⅠ entry in stage 4.
 */
import type { EffectDef } from '../types';
import type { RacePlanNode } from './types';

const mul = (stat: EffectDef['stat'], value: number, extra: Partial<EffectDef> = {}): EffectDef => ({
  kind: 'STAT_MUL', stat, value, ...extra,
});
const add = (stat: EffectDef['stat'], value: number, extra: Partial<EffectDef> = {}): EffectDef => ({
  kind: 'STAT_ADD', stat, value, ...extra,
});
const onStart = (extra: Partial<EffectDef>): EffectDef['trigger'] => ({ when: 'COMBAT_START', ...extra });
const atPhase = (phase: 'LATE' | 'LAST_3F' | 'POSITIONING', extra: Partial<EffectDef['trigger']> = {}) =>
  ({ when: 'ON_RACE_PHASE' as const, phase, ...extra });

/** Seconds a "first stretch" buff lasts. Deliberately clock-based: nothing dies this early. */
const EARLY = 9;

export const RACE_PLAN_DEFS: RacePlanNode[] = [
  // ------------------------------------------------------------ A. 하이 페이스
  {
    id: 'RP_HIGH_PACE_PRESSURE', kind: 'PLAN', category: 'HIGH_PACE',
    nameKo: '전반 압박', descriptionKo: '발주부터 몰아붙여 상대가 자리를 잡기 전에 흔듭니다.',
    majorTag: 'MORE_EARLY', tags: ['MORE_EARLY', 'BASIC_ATTACK'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { roles: ['AD_CARRY', 'BRUISER'], itemAxes: ['attackSpeed', 'ad'], styles: ['nige', 'senko'],
      aptitudeAxes: ['stylePct.nige'], phases: ['START', 'POSITIONING'] },
    vfx: { color: '#a53c31' },
    effects: [
      mul('attackSpeed', 0.12, { duration: EARLY, trigger: { when: 'COMBAT_START' } }),
      { kind: 'DAMAGE_AMP', value: 0.08, duration: 5, oncePerCombat: true, trigger: { when: 'ON_TAKEDOWN_ASSIST' } },
    ],
  },
  {
    id: 'RP_HIGH_PACE_GATE', kind: 'PLAN', category: 'HIGH_PACE',
    nameKo: '게이트 선점', descriptionKo: '출발과 동시에 앞으로 나가 첫 승부를 겁니다.',
    majorTag: 'MORE_EARLY', tags: ['MORE_EARLY', 'POSITION'], baseWeight: 1,
    guard: { appliesTo: 'MELEE' },
    fit: { roles: ['BRUISER', 'TANK'], itemAxes: ['ad', 'tank'], styles: ['nige'],
      aptitudeAxes: ['stylePct.nige'], phases: ['START'] },
    vfx: { color: '#a98b4b' },
    effects: [
      mul('moveSpeedHexPerSec', 0.25, { duration: 6, trigger: { when: 'COMBAT_START' } }),
      { kind: 'MANA_ADD', value: 8, oncePerCombat: true, trigger: { when: 'ON_ATTACK' } },
      add('armor', 10, { duration: 6, trigger: { when: 'ON_CAST' }, oncePerCombat: true }),
      add('magicResist', 10, { duration: 6, trigger: { when: 'ON_CAST' }, oncePerCombat: true }),
    ],
  },
  {
    id: 'RP_HIGH_PACE_BREAK', kind: 'PLAN', category: 'HIGH_PACE',
    nameKo: '선두 붕괴', descriptionKo: '한 명만 집요하게 노려 앞자리를 무너뜨립니다.',
    majorTag: 'PENETRATION', tags: ['MORE_EARLY', 'PENETRATION', 'BASIC_ATTACK'], baseWeight: 1,
    guard: { appliesTo: 'ANY', roles: ['AD_CARRY', 'AP_CARRY', 'BRUISER'] },
    fit: { roles: ['AD_CARRY', 'AP_CARRY'], itemAxes: ['ad', 'penetration'], phases: ['START', 'POSITIONING'] },
    vfx: { color: '#a53c31' },
    effects: [
      { kind: 'SUNDER_ARMOR_PCT', value: 0.12, duration: 4, target: 'CURRENT_TARGET',
        trigger: { when: 'ON_SAME_TARGET_NTH_ATTACK', threshold: 4 } },
      { kind: 'SHRED_MR_PCT', value: 0.12, duration: 4, target: 'CURRENT_TARGET',
        trigger: { when: 'ON_SAME_TARGET_NTH_ATTACK', threshold: 4 } },
    ],
  },

  // ------------------------------------------------------------ B. 선두 유지
  {
    id: 'RP_LEAD_CONTROL', kind: 'PLAN', category: 'LEAD_CONTROL',
    nameKo: '선두 고정', descriptionKo: '앞자리를 잡고 흔들리지 않게 버팁니다.',
    majorTag: 'SURVIVAL', tags: ['MORE_EARLY', 'SURVIVAL'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['tank', 'ad'], styles: ['nige', 'senko'], aptitudeAxes: ['stylePct.nige', 'stylePct.senko'],
      phases: ['START', 'POSITIONING'] },
    vfx: { color: '#3f785d' },
    effects: [
      { kind: 'DAMAGE_REDUCTION', value: 0.08, duration: 5, trigger: { when: 'COMBAT_START' } },
      mul('attackDamage', 0.06, { trigger: atPhase('POSITIONING') }),
      mul('abilityPower', 0.06, { trigger: atPhase('POSITIONING') }),
    ],
  },
  {
    id: 'RP_LEAD_RAIL', kind: 'PLAN', category: 'LEAD_CONTROL',
    nameKo: '내측 장악', descriptionKo: '옆의 아군과 붙어 안쪽 자리를 내주지 않습니다.',
    majorTag: 'TEAM_SUPPORT', tags: ['POSITION', 'TEAM_SUPPORT', 'SURVIVAL'], baseWeight: 1,
    guard: { appliesTo: 'ANY', needsAdjacentAlly: true },
    fit: { roles: ['TANK', 'BRUISER', 'SUPPORT'], itemAxes: ['tank'], phases: ['START', 'POSITIONING'] },
    vfx: { color: '#3d6679' },
    effects: [
      { kind: 'DAMAGE_REDUCTION', value: 0.05, duration: 6, trigger: { when: 'ADJACENT_ALLIES_AT_LEAST', threshold: 1 } },
      mul('attackSpeed', 0.08, { duration: 6, maxStacks: 2, trigger: { when: 'ON_SAME_TARGET_NTH_ATTACK', threshold: 5 } }),
    ],
  },
  {
    id: 'RP_LEAD_TEMPO', kind: 'PLAN', category: 'LEAD_CONTROL',
    nameKo: '일정한 랩', descriptionKo: '같은 속도를 유지하며 조금씩 앞서 나갑니다.',
    majorTag: 'STACK', tags: ['STACK', 'BASIC_ATTACK'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['attackSpeed', 'tank'], phases: ['POSITIONING', 'LATE'] },
    vfx: { color: '#3f785d' },
    effects: [
      { kind: 'STACKING_STAT', stat: 'attackSpeed', value: 0.03, tag: 'PCT', maxStacks: 4,
        trigger: { when: 'EVERY_SECONDS', threshold: 5 } },
      { kind: 'STACKING_STAT', stat: 'armor', value: 3, maxStacks: 4, trigger: { when: 'EVERY_SECONDS', threshold: 5 } },
      { kind: 'STACKING_STAT', stat: 'magicResist', value: 3, maxStacks: 4, trigger: { when: 'EVERY_SECONDS', threshold: 5 } },
    ],
  },

  // ------------------------------------------------------------ C. 미들 페이스
  {
    id: 'RP_MIDDLE_BALANCE', kind: 'PLAN', category: 'MIDDLE_PACE',
    nameKo: '왕도 전개', descriptionKo: '발주에는 버티고 중반에 붙었다가 4코너에서 올라탑니다.',
    majorTag: 'MORE_LATE', tags: ['MORE_EARLY', 'MORE_LATE', 'SURVIVAL'], baseWeight: 1.05,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['ad', 'ap', 'tank'], economy: ['FLEX', 'TEMPO', 'FAST_8'], phases: ['POSITIONING', 'LATE'] },
    vfx: { color: '#1e4938' },
    effects: [
      add('armor', 8, { duration: 5, trigger: { when: 'COMBAT_START' } }),
      add('magicResist', 8, { duration: 5, trigger: { when: 'COMBAT_START' } }),
      mul('attackDamage', 0.05, { trigger: atPhase('POSITIONING') }),
      mul('abilityPower', 0.05, { trigger: atPhase('POSITIONING') }),
      mul('attackSpeed', 0.1, { trigger: atPhase('LATE') }),
    ],
  },
  {
    id: 'RP_MIDDLE_CYCLE', kind: 'PLAN', category: 'MIDDLE_PACE',
    nameKo: '호흡 조절', descriptionKo: '스킬 사이의 호흡을 고르게 가져갑니다.',
    majorTag: 'CAST', tags: ['CAST', 'SUSTAIN'], baseWeight: 1,
    guard: { appliesTo: 'ANY', roles: ['AP_CARRY', 'SUPPORT', 'BRUISER'] },
    fit: { roles: ['AP_CARRY', 'SUPPORT'], itemAxes: ['mana', 'ap'], phases: ['POSITIONING'] },
    vfx: { color: '#3d6679' },
    effects: [
      { kind: 'MANA_ADD', value: 5, interval: 5, trigger: { when: 'ON_CAST' } },
      { kind: 'OMNIVAMP', value: 0.06, duration: 5, interval: 8, trigger: { when: 'ON_CAST' } },
    ],
  },
  {
    id: 'RP_MIDDLE_POSITION', kind: 'PLAN', category: 'MIDDLE_PACE',
    nameKo: '좋은 자리', descriptionKo: '무리하지 않고 좋은 위치를 유지합니다.',
    majorTag: 'POSITION', tags: ['POSITION', 'SURVIVAL', 'STACK'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['tank', 'sustain'], phases: ['POSITIONING', 'LATE'] },
    vfx: { color: '#3f785d' },
    effects: [
      { kind: 'STACKING_STAT', stat: 'attackDamage', value: 0.04, tag: 'PCT', maxStacks: 2,
        trigger: { when: 'EVERY_SECONDS', threshold: 8 } },
      { kind: 'STACKING_STAT', stat: 'abilityPower', value: 0.04, tag: 'PCT', maxStacks: 2,
        trigger: { when: 'EVERY_SECONDS', threshold: 8 } },
      { kind: 'HEAL_MAXHP_PCT', value: 0.08, target: 'SELF', trigger: atPhase('LATE') },
    ],
  },

  // ------------------------------------------------------------ D. 슬로 페이스
  {
    id: 'RP_SLOW_STORE', kind: 'PLAN', category: 'SLOW_PACE',
    nameKo: '힘 비축', descriptionKo: '발주를 아끼고 4코너에서 각력을 한 번에 풉니다.',
    majorTag: 'STACK', tags: ['MORE_LATE', 'STACK'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { roles: ['AD_CARRY', 'AP_CARRY', 'BRUISER'], itemAxes: ['ad', 'ap', 'sustain'],
      economy: ['FAST_8', 'FAST_9', 'FLEX'], styles: ['sashi', 'oikomi'],
      aptitudeAxes: ['stylePct.sashi', 'stylePct.oikomi', 'distancePct.long'], phases: ['LATE', 'LAST_3F'] },
    vfx: { color: '#a98b4b' },
    effects: [mul('attackSpeed', -0.05, { trigger: { when: 'COMBAT_START' } }), mul('attackSpeed', 0.05, { trigger: atPhase('LATE') })],
    resource: {
      kind: 'LEG', max: 5, gainPerSeconds: 2, payoutPhase: 'LATE', consume: false, label: '각력',
      perStack: [mul('attackDamage', 0.015), mul('abilityPower', 0.015)],
    },
  },
  {
    id: 'RP_SLOW_PATIENCE', kind: 'PLAN', category: 'SLOW_PACE',
    nameKo: '마각 대기', descriptionKo: '중반까지 아끼다가 4코너부터 상대를 갉아냅니다.',
    majorTag: 'PENETRATION', tags: ['MORE_LATE', 'PENETRATION', 'SURVIVAL'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['penetration', 'tank'], styles: ['sashi', 'oikomi'], phases: ['LATE', 'LAST_3F'] },
    vfx: { color: '#765844' },
    effects: [
      { kind: 'DAMAGE_REDUCTION', value: 0.05, duration: 15, trigger: { when: 'COMBAT_START' } },
      { kind: 'SUNDER_ARMOR_PCT', value: 0.08, duration: 4, target: 'CURRENT_TARGET', refresh: true,
        trigger: atPhase('LATE') },
      { kind: 'SHRED_MR_PCT', value: 0.08, duration: 4, target: 'CURRENT_TARGET', refresh: true,
        trigger: atPhase('LATE') },
    ],
  },
  {
    id: 'RP_SLOW_STAMINA', kind: 'PLAN', category: 'SLOW_PACE',
    nameKo: '지구력 보존', descriptionKo: '체력을 아껴 두었다가 4코너에 화력으로 바꿉니다.',
    majorTag: 'SUSTAIN', tags: ['SUSTAIN', 'MORE_LATE'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['sustain', 'tank'], distances: ['stayer'], aptitudeAxes: ['distancePct.long'],
      phases: ['POSITIONING', 'LATE'] },
    vfx: { color: '#3f785d' },
    effects: [
      { kind: 'HEAL_MAXHP_PCT', value: 0.025, target: 'SELF', trigger: { when: 'EVERY_SECONDS', threshold: 5 } },
      { kind: 'DAMAGE_AMP', value: 0.08, trigger: atPhase('LATE', { hpAbove: 0.6 }) },
    ],
  },

  // -------------------------------------------------------------- E. 추월 전개
  {
    id: 'RP_PASS_OUTSIDE', kind: 'PLAN', category: 'PASSING',
    nameKo: '외곽 추월', descriptionKo: '바깥으로 돌아 약한 상대부터 잡아냅니다.',
    majorTag: 'RESET', tags: ['RESET', 'EXECUTE', 'POSITION'], baseWeight: 1,
    guard: { appliesTo: 'RANGED' },
    fit: { roles: ['AD_CARRY', 'AP_CARRY'], itemAxes: ['ad', 'crit'], styles: ['sashi', 'oikomi'],
      aptitudeAxes: ['stylePct.oikomi'], phases: ['LATE'] },
    vfx: { color: '#3d6679' },
    effects: [
      { kind: 'DAMAGE_AMP', value: 0.14, duration: 5, trigger: atPhase('LATE') },
      mul('attackSpeed', 0.2, { duration: 5, trigger: atPhase('LATE') }),
    ],
  },
  {
    id: 'RP_PASS_GAP', kind: 'PLAN', category: 'PASSING',
    nameKo: '마군 돌파', descriptionKo: '틈이 열리는 순간 한 번에 파고듭니다.',
    majorTag: 'PENETRATION', tags: ['PENETRATION', 'RESET'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['penetration', 'ad'], phases: ['LATE'] },
    vfx: { color: '#a53c31' },
    effects: [
      { kind: 'SUNDER_ARMOR_PCT', value: 0.15, duration: 6, target: 'CURRENT_TARGET', oncePerCombat: true,
        trigger: { when: 'ON_TARGET_CHANGED' } },
      { kind: 'SHRED_MR_PCT', value: 0.15, duration: 6, target: 'CURRENT_TARGET', oncePerCombat: true,
        trigger: { when: 'ON_TARGET_CHANGED' } },
    ],
  },
  {
    id: 'RP_PASS_CHAIN', kind: 'PLAN', category: 'PASSING',
    nameKo: '연속 추월', descriptionKo: '한 명을 넘기면 그대로 다음 상대까지 갑니다.',
    majorTag: 'RESET', tags: ['RESET', 'EXECUTE'], baseWeight: 1,
    guard: { appliesTo: 'MELEE', needsTakedown: true },
    fit: { roles: ['BRUISER', 'AD_CARRY'], itemAxes: ['ad', 'attackSpeed'], phases: ['POSITIONING', 'LATE'] },
    vfx: { color: '#a98b4b' },
    effects: [
      mul('moveSpeedHexPerSec', 0.3, { duration: 4, maxStacks: 3, trigger: { when: 'ON_TAKEDOWN_ASSIST' } }),
      mul('attackSpeed', 0.1, { duration: 4, maxStacks: 3, trigger: { when: 'ON_TAKEDOWN_ASSIST' } }),
    ],
  },

  // -------------------------------------------------------------- F. 라스트 3F
  {
    id: 'RP_LAST3F_ACCEL', kind: 'PLAN', category: 'LAST_3F',
    nameKo: '종반 가속', descriptionKo: '4코너부터 두 번에 나눠 속도를 올립니다.',
    majorTag: 'MORE_LATE', tags: ['MORE_LATE'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    // Attack speed is deliberately not the axis here: overtime already multiplies
    // it by four against a cap of 5.0, so a late attack-speed bonus is worth ~0.
    fit: { itemAxes: ['ad', 'ap'], phases: ['LATE', 'LAST_3F'] },
    vfx: { color: '#e8c86a' },
    effects: [
      { kind: 'DAMAGE_AMP', value: 0.08, trigger: atPhase('LATE') },
      { kind: 'DAMAGE_AMP', value: 0.08, trigger: atPhase('LAST_3F') },
    ],
  },
  {
    id: 'RP_LAST3F_KICK', kind: 'PLAN', category: 'LAST_3F',
    nameKo: '끝걸음', descriptionKo: '마지막 직선에서 한 번 크게 뻗습니다.',
    majorTag: 'MORE_LATE', tags: ['MORE_LATE', 'SUSTAIN'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['ad', 'ap', 'sustain'], styles: ['oikomi'], aptitudeAxes: ['stylePct.oikomi'],
      phases: ['LAST_3F'] },
    vfx: { color: '#e8c86a' },
    effects: [
      mul('attackDamage', 0.18, { trigger: atPhase('LAST_3F') }),
      mul('abilityPower', 0.18, { trigger: atPhase('LAST_3F') }),
      { kind: 'OMNIVAMP', value: 0.08, trigger: atPhase('LAST_3F', { hpBelow: 0.5 }) },
    ],
  },
  {
    id: 'RP_LAST3F_FINISH', kind: 'PLAN', category: 'LAST_3F',
    nameKo: '결승선 집중', descriptionKo: '마지막 한 발에 모든 것을 싣습니다.',
    majorTag: 'CAST', tags: ['MORE_LATE', 'CAST'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { roles: ['AP_CARRY', 'AD_CARRY'], itemAxes: ['ap', 'mana'], phases: ['LAST_3F'] },
    vfx: { color: '#e8c86a' },
    effects: [{ kind: 'SKILL_DAMAGE_AMP', value: 0.2, trigger: atPhase('LAST_3F') }],
  },

  // --------------------------------------------------------------- G. 근성 승부
  {
    id: 'RP_GUTS_LOW_HP', kind: 'PLAN', category: 'GUTS',
    nameKo: '근성', descriptionKo: '몰려도 무너지지 않고 다시 밀어붙입니다.',
    majorTag: 'SURVIVAL', tags: ['SURVIVAL'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { roles: ['BRUISER', 'TANK', 'AD_CARRY'], itemAxes: ['tank', 'sustain'], phases: ['POSITIONING', 'LATE'] },
    vfx: { color: '#a53c31' },
    effects: [
      { kind: 'DAMAGE_REDUCTION', value: 0.25, duration: 2, oncePerCombat: true, trigger: { when: 'HP_BELOW', threshold: 0.35 } },
      mul('attackDamage', 0.07, { oncePerCombat: true, trigger: { when: 'HP_BELOW', threshold: 0.35 } }),
      mul('abilityPower', 0.07, { oncePerCombat: true, trigger: { when: 'HP_BELOW', threshold: 0.35 } }),
    ],
  },
  {
    id: 'RP_GUTS_DUEL', kind: 'PLAN', category: 'GUTS',
    nameKo: '목 차 승부', descriptionKo: '한 상대와 끝까지 붙어 승부를 봅니다.',
    majorTag: 'BASIC_ATTACK', tags: ['BASIC_ATTACK', 'EXECUTE'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['ad', 'crit'], phases: ['POSITIONING', 'LATE'] },
    vfx: { color: '#a53c31' },
    effects: [
      { kind: 'DAMAGE_AMP', value: 0.1, duration: 4, refresh: true,
        trigger: { when: 'ON_SAME_TARGET_NTH_ATTACK', threshold: 5 } },
    ],
  },
  {
    id: 'RP_GUTS_COMEBACK', kind: 'PLAN', category: 'GUTS',
    nameKo: '차이 좁히기', descriptionKo: '수가 밀리는 순간 한 번 몰아칩니다.',
    majorTag: 'SURVIVAL', tags: ['SURVIVAL', 'RESET'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['tank', 'ad'], economy: ['RECOVERY', 'FLEX'], phases: ['POSITIONING', 'LATE'] },
    vfx: { color: '#a53c31' },
    effects: [
      mul('attackSpeed', 0.15, { duration: 6, oncePerCombat: true, trigger: atPhase('LATE') }),
      add('armor', 12, { duration: 6, oncePerCombat: true, trigger: atPhase('LATE') }),
      add('magicResist', 12, { duration: 6, oncePerCombat: true, trigger: atPhase('LATE') }),
    ],
  },

  // --------------------------------------------------------------- H. 마장 적응
  {
    id: 'RP_TRACK_TURF', kind: 'PLAN', category: 'TRACK',
    nameKo: '잔디 리듬', descriptionKo: '발을 바꿀 때마다 리듬을 타고 가속합니다.',
    majorTag: 'POSITION', tags: ['POSITION', 'BASIC_ATTACK'], baseWeight: 1,
    guard: { appliesTo: 'MELEE' },
    fit: { roles: ['BRUISER', 'AD_CARRY'], itemAxes: ['attackSpeed'], surfaces: ['turf'],
      aptitudeAxes: ['surfacePct.turf'], phases: ['POSITIONING', 'LATE'] },
    vfx: { color: '#3f785d' },
    effects: [mul('attackSpeed', 0.1, { duration: 4, maxStacks: 2, trigger: { when: 'ON_TARGET_CHANGED' } })],
  },
  {
    id: 'RP_TRACK_DIRT', kind: 'PLAN', category: 'TRACK',
    nameKo: '모래 버티기', descriptionKo: '맞을수록 단단해지며 버팁니다.',
    majorTag: 'SURVIVAL', tags: ['SURVIVAL', 'STACK'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    // Dirt aptitude only tilts the weight: 93 of 145 units are dirt F, so a
    // requirement here would delete the plan from the game.
    fit: { itemAxes: ['tank'], surfaces: ['dirt'], aptitudeAxes: ['surfacePct.dirt'],
      phases: ['POSITIONING', 'LATE'] },
    vfx: { color: '#765844' },
    effects: [
      add('armor', 12, { duration: 5, maxStacks: 2, trigger: { when: 'ON_BASIC_HIT_TAKEN', threshold: 6 }, interval: 5 }),
      add('magicResist', 12, { duration: 5, maxStacks: 2, trigger: { when: 'ON_BASIC_HIT_TAKEN', threshold: 6 }, interval: 5 }),
    ],
  },
  {
    id: 'RP_TRACK_GOING', kind: 'PLAN', category: 'TRACK',
    nameKo: '마장 읽기', descriptionKo: '그날의 마장 상태에 맞춰 다르게 탑니다.',
    majorTag: 'STACK', tags: ['SURVIVAL', 'STACK', 'MORE_EARLY'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['tank', 'attackSpeed'], phases: ['START', 'POSITIONING', 'LATE'] },
    vfx: { color: '#765844' },
    // The track state is applied by the runtime; the shared part is a small
    // all-conditions floor so the card is never blank.
    effects: [add('armor', 4, { trigger: { when: 'COMBAT_START' } }), add('magicResist', 4, { trigger: { when: 'COMBAT_START' } })],
  },

  // ------------------------------------------------------- I. 페이스 판단
  // These read the field rather than committing to a section of the race, so
  // they are the plans that stay live when the round's pace is not what the
  // board wanted. Every one of them scales off something the fight is doing.
  {
    id: 'RP_PACE_READ_FIELD', kind: 'PLAN', category: 'PACE_READ',
    nameKo: '마군 파악', descriptionKo: '남아 있는 상대가 많을수록 몸을 두껍게 가져갑니다. 정리될수록 힘으로 바뀝니다.',
    majorTag: 'SURVIVAL', tags: ['SURVIVAL', 'STACK'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['tank'], phases: ['POSITIONING', 'LATE'] },
    vfx: { color: '#4a6b8a' },
    effects: [
      { kind: 'DAMAGE_REDUCTION', value: 0.013, scaleBy: 'ENEMIES_ALIVE', scaleCap: 6, trigger: { when: 'COMBAT_START' } },
      { kind: 'DAMAGE_AMP', value: 0.03, scaleBy: 'ENEMIES_DEAD', scaleCap: 5, trigger: { when: 'IN_RACE_PHASE', phases: ['LATE', 'LAST_3F', 'OVERTIME'] } },
    ],
  },
  {
    id: 'RP_PACE_READ_LAP', kind: 'PLAN', category: 'PACE_READ',
    nameKo: '랩 타임 읽기', descriptionKo: '경주가 길어질수록 조금씩 더 강해집니다. 짧게 끝나면 아무것도 아닙니다.',
    majorTag: 'STACK', tags: ['STACK', 'MORE_LATE'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['ad', 'ap'], economy: ['REROLL', 'TEMPO'], phases: ['LATE', 'LAST_3F'] },
    vfx: { color: '#4a6b8a' },
    effects: [
      { kind: 'DAMAGE_AMP', value: 0.14, scaleBy: 'RACE_PROGRESS', trigger: { when: 'IN_RACE_PHASE', phases: ['POSITIONING', 'LATE', 'LAST_3F', 'OVERTIME'] } },
    ],
  },
  {
    id: 'RP_PACE_READ_BREATH', kind: 'PLAN', category: 'PACE_READ',
    nameKo: '호흡 관리', descriptionKo: '구간이 바뀔 때마다 숨을 고릅니다. 페이스가 넘어가는 순간마다 기력이 돌아옵니다.',
    majorTag: 'CAST', tags: ['CAST', 'RESET'], baseWeight: 1,
    guard: { appliesTo: 'ANY', roles: ['AP_CARRY', 'SUPPORT', 'BRUISER'] },
    fit: { roles: ['AP_CARRY', 'SUPPORT'], itemAxes: ['mana', 'ap'], phases: ['POSITIONING', 'LATE', 'LAST_3F'] },
    vfx: { color: '#4a6b8a' },
    effects: [
      { kind: 'MANA_ADD', value: 22, trigger: atPhase('POSITIONING') },
      { kind: 'MANA_ADD', value: 22, trigger: atPhase('LATE') },
      { kind: 'MANA_ADD', value: 22, trigger: atPhase('LAST_3F') },
    ],
  },
  {
    id: 'RP_PACE_READ_SHADOW', kind: 'PLAN', category: 'PACE_READ',
    nameKo: '뒤에 붙기', descriptionKo: '앞선 말의 등 뒤에 숨어 바람을 피합니다. 뒷줄에 설수록 편하게 갑니다.',
    majorTag: 'POSITION', tags: ['POSITION', 'SURVIVAL'], baseWeight: 1,
    guard: { appliesTo: 'RANGED' },
    fit: { roles: ['AD_CARRY', 'AP_CARRY'], itemAxes: ['ad', 'ap'], styles: ['sashi', 'oikomi'],
      aptitudeAxes: ['stylePct.sashi'], phases: ['POSITIONING', 'LATE'] },
    vfx: { color: '#4a6b8a' },
    effects: [
      { kind: 'DAMAGE_REDUCTION', value: 0.09, trigger: { when: 'IN_BACK_ROWS' } },
      { kind: 'DAMAGE_AMP', value: 0.08, trigger: { when: 'IN_BACK_ROWS' } },
    ],
  },

  // ------------------------------------------------------- J. 승부수 전개
  // The high-variance line: every one of these gives something real away up
  // front. They should be the plans a player remembers losing to.
  {
    id: 'RP_GAMBLE_ALL_IN', kind: 'PLAN', category: 'GAMBLE',
    nameKo: '올인 전개', descriptionKo: '방어를 벗고 달립니다. 훨씬 세게 때리지만 훨씬 세게 맞습니다.',
    majorTag: 'EXECUTE', tags: ['EXECUTE', 'BASIC_ATTACK'], baseWeight: 0.9,
    guard: { appliesTo: 'ANY', roles: ['AD_CARRY', 'AP_CARRY', 'BRUISER'] },
    fit: { roles: ['AD_CARRY', 'AP_CARRY'], itemAxes: ['ad', 'ap', 'crit'], phases: ['POSITIONING', 'LATE'] },
    vfx: { color: '#7d3f6b' },
    effects: [
      { kind: 'DAMAGE_AMP', value: 0.2, trigger: { when: 'COMBAT_START' } },
      { kind: 'DAMAGE_REDUCTION', value: -0.12, trigger: { when: 'COMBAT_START' } },
    ],
  },
  {
    id: 'RP_GAMBLE_SPEND_LEGS', kind: 'PLAN', category: 'GAMBLE',
    nameKo: '각력 소진', descriptionKo: '4코너에서 남은 지구력을 전부 힘으로 바꿉니다. 그때부터는 맞으면 아픕니다.',
    majorTag: 'EXECUTE', tags: ['EXECUTE', 'MORE_LATE'], baseWeight: 0.9,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['tank', 'ad'], styles: ['sashi', 'oikomi'], phases: ['LATE', 'LAST_3F'] },
    vfx: { color: '#7d3f6b' },
    effects: [
      // Armour into attack damage, once, at the corner. A tanky carry turns into
      // a glass one exactly when the race stops rewarding patience.
      { kind: 'CONVERT_STAT', stat: 'attackDamage', tag: 'armor', value: 0.5, duration: 999,
        scaling: { cap: 1.4 }, oncePerCombat: true, trigger: atPhase('LATE') },
      { kind: 'DAMAGE_AMP', value: 0.08, trigger: { when: 'IN_RACE_PHASE', phases: ['LATE', 'LAST_3F', 'OVERTIME'] } },
    ],
  },
  {
    id: 'RP_GAMBLE_LATE_BREAK', kind: 'PLAN', category: 'GAMBLE',
    nameKo: '늦은 발주', descriptionKo: '일부러 뒤에서 출발합니다. 중반까지는 아무것도 못 하지만, 직선에서 한 번 더 나갑니다.',
    majorTag: 'MORE_LATE', tags: ['MORE_LATE', 'RESET'], baseWeight: 0.85,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['ap', 'mana'], styles: ['oikomi'], aptitudeAxes: ['stylePct.oikomi'],
      phases: ['LAST_3F'] },
    vfx: { color: '#7d3f6b' },
    effects: [
      { kind: 'DAMAGE_AMP', value: -0.06, trigger: { when: 'IN_RACE_PHASE', phases: ['START', 'POSITIONING'] } },
      // The payoff is a whole extra release, not a bigger number.
      { kind: 'RECAST_SKILL', oncePerCombat: true, trigger: atPhase('LAST_3F') },
      { kind: 'SKILL_DAMAGE_AMP', value: 0.25, trigger: { when: 'IN_RACE_PHASE', phases: ['LAST_3F', 'OVERTIME'] } },
    ],
  },
  {
    id: 'RP_GAMBLE_BLINKERS', kind: 'PLAN', category: 'GAMBLE',
    nameKo: '블링커 착용', descriptionKo: '눈가리개를 씌워 앞만 보게 합니다. 한 상대에게 집중하는 대신 곁은 보지 못합니다.',
    majorTag: 'PENETRATION', tags: ['PENETRATION', 'BASIC_ATTACK'], baseWeight: 0.95,
    guard: { appliesTo: 'ANY', roles: ['AD_CARRY', 'BRUISER'] },
    fit: { roles: ['AD_CARRY', 'BRUISER'], itemAxes: ['ad', 'penetration', 'attackSpeed'],
      phases: ['POSITIONING', 'LATE'] },
    vfx: { color: '#7d3f6b' },
    effects: [
      { kind: 'STACKING_STAT', stat: 'attackDamage', value: 3, maxStacks: 8, tag: 'FLAT',
        trigger: { when: 'ON_SAME_TARGET_NTH_ATTACK', threshold: 2 } },
      // Switching target throws the stacks away, which is the cost of blinkers.
      { kind: 'DAMAGE_AMP', value: -0.1, duration: 3, refresh: true, trigger: { when: 'ON_TARGET_CHANGED' } },
    ],
  },

  // ------------------------------------- additions to the existing categories
  {
    id: 'RP_HIGH_PACE_RUNAWAY', kind: 'PLAN', category: 'HIGH_PACE',
    nameKo: '대도주 선언', descriptionKo: '처음부터 끝까지 앞에서 끌고 갑니다. 앞에 남은 상대가 많을수록 세게 갑니다.',
    majorTag: 'MORE_EARLY', tags: ['MORE_EARLY', 'POSITION'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { roles: ['BRUISER', 'AD_CARRY'], itemAxes: ['attackSpeed', 'ad'], styles: ['nige'],
      aptitudeAxes: ['stylePct.nige'], phases: ['START', 'POSITIONING'] },
    vfx: { color: '#a53c31' },
    effects: [
      { kind: 'DAMAGE_AMP', value: 0.028, scaleBy: 'ENEMIES_ALIVE', scaleCap: 6,
        trigger: { when: 'IN_RACE_PHASE', phases: ['START', 'POSITIONING'] } },
      mul('moveSpeedHexPerSec', 0.18, { duration: 8, trigger: { when: 'COMBAT_START' } }),
    ],
  },
  {
    id: 'RP_LEAD_SLIPSTREAM', kind: 'PLAN', category: 'LEAD_CONTROL',
    nameKo: '선두 바람막이', descriptionKo: '앞에 선 기물이 바람을 받아 주고, 뒤에 선 기물이 그 덕을 봅니다.',
    majorTag: 'TEAM_SUPPORT', tags: ['TEAM_SUPPORT', 'POSITION'], baseWeight: 1,
    guard: { appliesTo: 'ANY', needsAdjacentAlly: true },
    fit: { roles: ['TANK', 'SUPPORT'], itemAxes: ['tank', 'mana'], phases: ['POSITIONING', 'LATE'] },
    vfx: { color: '#3f785d' },
    effects: [
      { kind: 'DAMAGE_REDUCTION', value: 0.07, target: 'ALL_ALLIES', trigger: { when: 'IN_FRONT_ROWS' } },
      { kind: 'DAMAGE_AMP', value: 0.06, target: 'ALL_ALLIES', trigger: { when: 'ADJACENT_ALLIES_AT_LEAST', threshold: 2 } },
    ],
  },
  {
    id: 'RP_MIDDLE_RHYTHM', kind: 'PLAN', category: 'MIDDLE_PACE',
    nameKo: '일정 리듬', descriptionKo: '흐트러지지 않는 페이스로 갑니다. 상대를 바꿔 잡을 때마다 다시 탄력이 붙습니다.',
    majorTag: 'RESET', tags: ['RESET', 'BASIC_ATTACK'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { roles: ['AD_CARRY', 'BRUISER'], itemAxes: ['attackSpeed'], phases: ['POSITIONING', 'LATE'] },
    vfx: { color: '#1e4938' },
    effects: [
      mul('attackSpeed', 0.14, { duration: 4, refresh: true, trigger: { when: 'ON_TARGET_CHANGED' } }),
      { kind: 'MANA_ADD', value: 6, interval: 2, trigger: { when: 'ON_TARGET_CHANGED' } },
    ],
  },
  {
    id: 'RP_SLOW_SAVE_LEGS', kind: 'PLAN', category: 'SLOW_PACE',
    nameKo: '다리 아껴 두기', descriptionKo: '아무도 가지 않는 흐름에 맞춰 다리를 아낍니다. 4코너에 기력이 가득 찬 채로 들어갑니다.',
    majorTag: 'CAST', tags: ['CAST', 'MORE_LATE'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { roles: ['AP_CARRY', 'SUPPORT'], itemAxes: ['mana', 'ap'], styles: ['sashi', 'oikomi'],
      phases: ['LATE', 'LAST_3F'] },
    vfx: { color: '#a98b4b' },
    effects: [
      { kind: 'MANA_FILL', value: 1, oncePerCombat: true, trigger: atPhase('LATE') },
      { kind: 'SKILL_DAMAGE_AMP', value: 0.12, trigger: { when: 'IN_RACE_PHASE', phases: ['LATE', 'LAST_3F', 'OVERTIME'] } },
    ],
  },
  {
    id: 'RP_PASS_RAIL_GAP', kind: 'PLAN', category: 'PASSING',
    nameKo: '내곽 한 줄', descriptionKo: '안쪽이 비는 순간 그 한 줄로 빠져나갑니다. 앞이 무너질수록 길이 열립니다.',
    majorTag: 'POSITION', tags: ['POSITION', 'MORE_LATE'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { roles: ['AD_CARRY', 'BRUISER'], itemAxes: ['ad', 'penetration'], styles: ['sashi'],
      aptitudeAxes: ['stylePct.sashi'], phases: ['LATE', 'LAST_3F'] },
    vfx: { color: '#3d6679' },
    effects: [
      { kind: 'STAT_MUL', stat: 'attackSpeed', value: 0.06, scaleBy: 'ENEMIES_DEAD', scaleCap: 4,
        duration: 999, refresh: true, trigger: atPhase('LATE') },
      { kind: 'SUNDER_ARMOR_PCT', value: 0.18, duration: 6, trigger: { when: 'ON_CAST' } },
    ],
  },
  {
    id: 'RP_LAST3F_SECOND_KICK', kind: 'PLAN', category: 'LAST_3F',
    nameKo: '두 번째 각', descriptionKo: '한 번 뻗고 끝나지 않습니다. 직선에서 승부수가 한 번 더 나갑니다.',
    majorTag: 'MORE_LATE', tags: ['MORE_LATE', 'CAST'], baseWeight: 0.9,
    guard: { appliesTo: 'ANY', roles: ['AP_CARRY', 'AD_CARRY', 'BRUISER'] },
    fit: { roles: ['AP_CARRY'], itemAxes: ['ap', 'mana'], phases: ['LAST_3F'] },
    vfx: { color: '#e8c86a' },
    effects: [
      { kind: 'RECAST_SKILL', oncePerCombat: true, trigger: atPhase('LAST_3F') },
    ],
  },
  {
    id: 'RP_GUTS_LAST_GASP', kind: 'PLAN', category: 'GUTS',
    nameKo: '마지막 한 발', descriptionKo: '잃은 체력이 많을수록 세게 때립니다. 몰릴수록 위험해지는 쪽은 상대입니다.',
    majorTag: 'EXECUTE', tags: ['EXECUTE', 'SURVIVAL'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { roles: ['BRUISER', 'TANK'], itemAxes: ['tank', 'sustain'], phases: ['LATE', 'LAST_3F'] },
    vfx: { color: '#a53c31' },
    effects: [
      { kind: 'DAMAGE_AMP', value: 0.3, scaleBy: 'SELF_MISSING_HP_PCT', trigger: { when: 'COMBAT_START' } },
      { kind: 'OMNIVAMP', value: 0.1, trigger: { when: 'HP_BELOW', threshold: 0.5 } },
    ],
  },
  {
    id: 'RP_TRACK_WEATHER', kind: 'PLAN', category: 'TRACK',
    nameKo: '날씨 적응', descriptionKo: '오늘의 하늘에 맞춰 갑니다. 거친 날씨일수록 흔들리지 않습니다.',
    majorTag: 'SURVIVAL', tags: ['SURVIVAL', 'STACK'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['tank', 'sustain'], phases: ['POSITIONING', 'LATE'] },
    vfx: { color: '#765844' },
    effects: [
      { kind: 'CC_RESIST', value: 0.25, trigger: { when: 'COMBAT_START' } },
      { kind: 'HEAL_MAXHP_PCT', value: 0.04, target: 'SELF', trigger: { when: 'EVERY_SECONDS', threshold: 6 } },
      add('armor', 8, { trigger: { when: 'COMBAT_START' } }),
      add('magicResist', 8, { trigger: { when: 'COMBAT_START' } }),
    ],
  },
];

/** Extra effects layered on RP_TRACK_GOING by the round's shared going. */
export const TRACK_STATE_EFFECTS: Record<'FAST' | 'STANDARD' | 'HEAVY', EffectDef[]> = {
  FAST: [mul('attackSpeed', 0.12, { duration: EARLY, trigger: { when: 'COMBAT_START' } })],
  STANDARD: [
    mul('attackDamage', 0.07, { trigger: atPhase('POSITIONING') }),
    mul('abilityPower', 0.07, { trigger: atPhase('POSITIONING') }),
  ],
  HEAVY: [
    { kind: 'DAMAGE_REDUCTION', value: 0.06, trigger: { when: 'COMBAT_START' } },
    { kind: 'HEAL_MAXHP_PCT', value: 0.04, target: 'SELF', trigger: { when: 'EVERY_SECONDS', threshold: 8 } },
  ],
};

export const TRACK_STATE_LABEL: Record<'FAST' | 'STANDARD' | 'HEAVY', string> = {
  FAST: '양호', STANDARD: '중', HEAVY: '불량',
};

export { onStart };
