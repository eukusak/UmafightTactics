/**
 * Finishing moves: 26 generic + 16 signature.
 *
 * Three are offered once the GⅠ entry is registered, and the three always carry
 * different `finishingCategory` values — that is what keeps an offer from being
 * "more damage late" printed three times.
 *
 * Eight generic moves carry no guard at all (FM_EVEN_PACE, FM_SECOND_WIND,
 * FM_LONG_SPURT, FM_LAST_3F, FM_HEART, FM_PHOTO_FINISH, FM_ONE_TARGET,
 * FM_STAYER). They span five categories, so every unit in the roster can always
 * be handed three legal, non-overlapping cards.
 */
import type { EffectDef } from '../types';
import type { RacePlanNode } from './types';

const mul = (stat: EffectDef['stat'], value: number, extra: Partial<EffectDef> = {}): EffectDef => ({
  kind: 'STAT_MUL', stat, value, ...extra,
});
const add = (stat: EffectDef['stat'], value: number, extra: Partial<EffectDef> = {}): EffectDef => ({
  kind: 'STAT_ADD', stat, value, ...extra,
});
const atPhase = (phase: 'LATE' | 'LAST_3F' | 'POSITIONING' | 'OVERTIME', extra: Partial<EffectDef['trigger']> = {}) =>
  ({ when: 'ON_RACE_PHASE' as const, phase, ...extra });

type Fm = Omit<RacePlanNode, 'kind'> & { finishingCategory: NonNullable<RacePlanNode['finishingCategory']> };
const fm = (node: Fm): RacePlanNode => ({ ...node, kind: 'FINISHING' });

export const FINISHING_MOVE_DEFS: RacePlanNode[] = [
  // ------------------------------------------------------------- FRONTRUN
  fm({
    id: 'FM_BREAKAWAY', finishingCategory: 'FRONTRUN', nameKo: '단독 선두',
    descriptionKo: '발주에서 앞으로 빠져나가 그대로 굳힙니다.',
    majorTag: 'MORE_EARLY', tags: ['MORE_EARLY'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['attackSpeed', 'ad'], styles: ['nige'], aptitudeAxes: ['stylePct.nige'], phases: ['START'] },
    vfx: { color: '#a53c31' },
    effects: [
      mul('attackSpeed', 0.22, { duration: 8, trigger: { when: 'COMBAT_START' } }),
      mul('attackDamage', 0.08, { trigger: atPhase('POSITIONING') }),
      mul('abilityPower', 0.08, { trigger: atPhase('POSITIONING') }),
    ],
  }),
  fm({
    id: 'FM_GATE_BURST', finishingCategory: 'FRONTRUN', nameKo: '게이트 폭발',
    descriptionKo: '게이트가 열리자마자 뛰쳐나갑니다.',
    majorTag: 'MORE_EARLY', tags: ['MORE_EARLY', 'CAST'], baseWeight: 1,
    guard: { appliesTo: 'MELEE' },
    fit: { roles: ['BRUISER', 'TANK'], itemAxes: ['mana', 'ad'], styles: ['nige'], phases: ['START'] },
    vfx: { color: '#a98b4b' },
    effects: [
      { kind: 'MANA_ADD', value: 20, trigger: { when: 'COMBAT_START' } },
      mul('moveSpeedHexPerSec', 0.35, { duration: 5, trigger: { when: 'COMBAT_START' } }),
      { kind: 'SKILL_DAMAGE_AMP', value: 0.15, duration: 8, trigger: { when: 'COMBAT_START' } },
    ],
  }),
  fm({
    id: 'FM_FRONT_COMMAND', finishingCategory: 'FRONTRUN', nameKo: '선두 지휘',
    descriptionKo: '앞에서 팀 전체의 페이스를 끌어올립니다.',
    majorTag: 'TEAM_SUPPORT', tags: ['TEAM_SUPPORT', 'CAST'], baseWeight: 1,
    guard: { appliesTo: 'ANY', needsAdjacentAlly: true },
    fit: { roles: ['SUPPORT', 'TANK', 'AP_CARRY'], itemAxes: ['mana', 'utility'], phases: ['POSITIONING'] },
    vfx: { color: '#3d6679' },
    effects: [mul('attackSpeed', 0.1, { duration: 5, target: 'LOWEST_HP_ALLIES', maxTargets: 2, interval: 8, trigger: { when: 'ON_CAST' } })],
  }),

  // -------------------------------------------------------------- SUSTAIN
  fm({
    id: 'FM_STAYER', finishingCategory: 'SUSTAIN', nameKo: '스테이어',
    descriptionKo: '오래 달릴수록 단단해지고, 마지막에 힘으로 바뀝니다.',
    majorTag: 'STACK', tags: ['STACK', 'SUSTAIN', 'MORE_LATE'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['tank', 'sustain'], distances: ['stayer'], aptitudeAxes: ['distancePct.long'], phases: ['LATE', 'LAST_3F'] },
    vfx: { color: '#3f785d' },
    effects: [],
    resource: {
      kind: 'STAMINA', max: 6, gainPerSeconds: 5, label: '지구력',
      perStack: [{ kind: 'DAMAGE_REDUCTION', value: 0.02 }],
    },
  }),
  fm({
    id: 'FM_HEART', finishingCategory: 'SUSTAIN', nameKo: '근성',
    descriptionKo: '무너지기 직전에 버티고 되살아납니다.',
    majorTag: 'SURVIVAL', tags: ['SURVIVAL', 'SUSTAIN'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['tank', 'sustain'], phases: ['POSITIONING', 'LATE'] },
    vfx: { color: '#a53c31' },
    effects: [
      { kind: 'DAMAGE_REDUCTION', value: 0.4, duration: 2, oncePerCombat: true, trigger: { when: 'HP_BELOW', threshold: 0.3 } },
      { kind: 'OMNIVAMP', value: 0.12, duration: 8, oncePerCombat: true, trigger: { when: 'HP_BELOW', threshold: 0.3 } },
    ],
  }),
  fm({
    id: 'FM_PHOTO_FINISH', finishingCategory: 'SUSTAIN', nameKo: '사진 판정',
    descriptionKo: '코 차이로 남아 결승선을 넘습니다.',
    majorTag: 'SURVIVAL', tags: ['SURVIVAL'], baseWeight: 0.95,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['tank'], phases: ['LATE', 'LAST_3F'] },
    vfx: { color: '#e8c86a' },
    effects: [
      { kind: 'SURVIVE_LETHAL', value: 1, oncePerCombat: true, tag: 'RACE_PLAN' },
      { kind: 'HEAL_MAXHP_PCT', value: 0.15, target: 'SELF', oncePerCombat: true, trigger: { when: 'ON_TAKEDOWN_ASSIST' } },
    ],
  }),
  fm({
    id: 'FM_HEAVY_GOING', finishingCategory: 'SUSTAIN', nameKo: '중마장',
    descriptionKo: '무거운 마장에서도 발이 죽지 않습니다.',
    majorTag: 'SUSTAIN', tags: ['SUSTAIN', 'SURVIVAL'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['tank', 'sustain'], surfaces: ['dirt'], aptitudeAxes: ['surfacePct.dirt'], phases: ['POSITIONING', 'LATE'] },
    vfx: { color: '#765844' },
    effects: [
      { kind: 'CC_RESIST', value: 0.35 },
      { kind: 'HEAL_MAXHP_PCT', value: 0.05, target: 'SELF', trigger: { when: 'EVERY_SECONDS', threshold: 10 } },
    ],
  }),

  // ----------------------------------------------------------------- BURST
  fm({
    id: 'FM_TURN_OF_FOOT', finishingCategory: 'BURST', nameKo: '순간 가속',
    descriptionKo: '4코너에서 한 번 크게 튀어 나갑니다.',
    majorTag: 'MORE_LATE', tags: ['MORE_LATE'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['attackSpeed', 'ad'], phases: ['LATE'] },
    vfx: { color: '#e8c86a' },
    effects: [mul('attackSpeed', 0.35, { duration: 6, trigger: atPhase('LATE') })],
  }),
  fm({
    id: 'FM_LONG_SPURT', finishingCategory: 'BURST', nameKo: '롱 스퍼트',
    descriptionKo: '멀리서부터 길게 밀어붙입니다.',
    majorTag: 'MORE_LATE', tags: ['MORE_LATE', 'STACK'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['ad', 'ap'], distances: ['stayer'], aptitudeAxes: ['distancePct.long'], phases: ['LATE', 'LAST_3F'] },
    vfx: { color: '#e8c86a' },
    effects: [
      mul('attackSpeed', 0.15, { trigger: atPhase('LATE') }),
      mul('attackSpeed', 0.15, { trigger: atPhase('LAST_3F') }),
      mul('attackDamage', 0.06, { trigger: atPhase('LATE') }),
      mul('attackDamage', 0.06, { trigger: atPhase('LAST_3F') }),
      mul('abilityPower', 0.06, { trigger: atPhase('LATE') }),
      mul('abilityPower', 0.06, { trigger: atPhase('LAST_3F') }),
    ],
  }),
  fm({
    id: 'FM_LAST_3F', finishingCategory: 'BURST', nameKo: '라스트 3F',
    descriptionKo: '마지막 600m, 모든 것을 겁니다.',
    majorTag: 'MORE_LATE', tags: ['MORE_LATE'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['ad', 'ap'], styles: ['oikomi', 'sashi'], aptitudeAxes: ['stylePct.oikomi'], phases: ['LAST_3F'] },
    vfx: { color: '#e8c86a' },
    effects: [
      { kind: 'DAMAGE_AMP', value: 0.12, trigger: atPhase('LAST_3F') },
      mul('attackSpeed', 0.25, { trigger: atPhase('LAST_3F') }),
    ],
  }),
  fm({
    id: 'FM_FINAL_KICK', finishingCategory: 'BURST', nameKo: '끝걸음',
    descriptionKo: '마지막 스킬 한 발에 승부를 겁니다.',
    majorTag: 'CAST', tags: ['MORE_LATE', 'CAST'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { roles: ['AP_CARRY', 'AD_CARRY'], itemAxes: ['ap', 'mana'], phases: ['LAST_3F'] },
    vfx: { color: '#e8c86a' },
    effects: [{ kind: 'SKILL_DAMAGE_AMP', value: 0.35, trigger: atPhase('LAST_3F') }],
  }),
  fm({
    id: 'FM_SAVE_LEGS', finishingCategory: 'BURST', nameKo: '각력 온존',
    descriptionKo: '아껴 둔 각력을 마지막 직선에 전부 씁니다.',
    majorTag: 'STACK', tags: ['STACK', 'MORE_LATE'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['ad', 'ap'], styles: ['sashi', 'oikomi'], aptitudeAxes: ['stylePct.sashi', 'stylePct.oikomi'], phases: ['LAST_3F'] },
    vfx: { color: '#a98b4b' },
    effects: [],
    resource: {
      kind: 'LEG', max: 10, gainOnAttack: 1, gainOnCast: 2, payoutPhase: 'LAST_3F', consume: true, label: '각력',
      perStack: [mul('attackDamage', 0.02, { duration: 6 }), mul('abilityPower', 0.02, { duration: 6 })],
    },
  }),

  // ----------------------------------------------------------------- SPELL
  fm({
    id: 'FM_SECOND_WIND', finishingCategory: 'SPELL', nameKo: '두 번째 호흡',
    descriptionKo: '중반과 4코너에서 한 번씩 숨을 고릅니다.',
    majorTag: 'SUSTAIN', tags: ['SUSTAIN', 'CAST'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['mana', 'sustain'], phases: ['POSITIONING', 'LATE'] },
    vfx: { color: '#3d6679' },
    effects: [
      { kind: 'HEAL_MAXHP_PCT', value: 0.08, target: 'SELF', oncePerCombat: true, trigger: atPhase('POSITIONING') },
      { kind: 'HEAL_MAXHP_PCT', value: 0.08, target: 'SELF', oncePerCombat: true, trigger: atPhase('LATE') },
      { kind: 'MANA_ADD', value: 10, oncePerCombat: true, trigger: atPhase('LATE') },
    ],
  }),
  fm({
    id: 'FM_PACE_MAKER', finishingCategory: 'SPELL', nameKo: '페이스 메이커',
    descriptionKo: '아군이 같은 상대를 노리면 마나가 돌아옵니다.',
    majorTag: 'CAST', tags: ['CAST', 'TEAM_SUPPORT'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { roles: ['AP_CARRY', 'SUPPORT'], itemAxes: ['mana'], phases: ['POSITIONING', 'LATE'] },
    vfx: { color: '#3d6679' },
    effects: [{ kind: 'ON_HIT_MANA', value: 2, trigger: { when: 'ON_ATTACK' } }],
  }),
  fm({
    id: 'FM_RHYTHM_CAST', finishingCategory: 'SPELL', nameKo: '리듬 시전',
    descriptionKo: '시전을 거듭할수록 스킬이 무거워집니다.',
    majorTag: 'CAST', tags: ['CAST', 'STACK'], baseWeight: 1,
    guard: { appliesTo: 'ANY', roles: ['AP_CARRY', 'SUPPORT'] },
    fit: { roles: ['AP_CARRY', 'SUPPORT'], itemAxes: ['ap', 'mana'], phases: ['POSITIONING', 'LATE'] },
    vfx: { color: '#3d6679' },
    effects: [
      { kind: 'MANA_ADD', value: 8, interval: 4, trigger: { when: 'ON_CAST' } },
      { kind: 'STACKING_STAT', stat: 'abilityPower', value: 0.08, tag: 'PCT', maxStacks: 3, trigger: { when: 'ON_CAST' } },
    ],
  }),

  // ----------------------------------------------------------------- TEMPO
  fm({
    id: 'FM_EVEN_PACE', finishingCategory: 'TEMPO', nameKo: '정속 주행',
    descriptionKo: '흔들리지 않는 랩으로 끝까지 갑니다.',
    majorTag: 'STACK', tags: ['STACK'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['ad', 'tank'], phases: ['POSITIONING', 'LATE'] },
    vfx: { color: '#3f785d' },
    effects: [
      { kind: 'STACKING_STAT', stat: 'attackDamage', value: 0.03, tag: 'PCT', maxStacks: 4, trigger: { when: 'EVERY_SECONDS', threshold: 5 } },
      { kind: 'STACKING_STAT', stat: 'abilityPower', value: 0.03, tag: 'PCT', maxStacks: 4, trigger: { when: 'EVERY_SECONDS', threshold: 5 } },
      { kind: 'STACKING_STAT', stat: 'armor', value: 3, maxStacks: 4, trigger: { when: 'EVERY_SECONDS', threshold: 5 } },
      { kind: 'STACKING_STAT', stat: 'magicResist', value: 3, maxStacks: 4, trigger: { when: 'EVERY_SECONDS', threshold: 5 } },
    ],
  }),
  fm({
    id: 'FM_TURF_STRIDE', finishingCategory: 'TEMPO', nameKo: '잔디 보폭',
    descriptionKo: '발을 바꿀 때마다 보폭이 커집니다.',
    majorTag: 'BASIC_ATTACK', tags: ['BASIC_ATTACK', 'POSITION'], baseWeight: 1,
    guard: { appliesTo: 'MELEE' },
    fit: { roles: ['BRUISER', 'AD_CARRY'], itemAxes: ['attackSpeed'], surfaces: ['turf'], phases: ['POSITIONING', 'LATE'] },
    vfx: { color: '#3f785d' },
    effects: [mul('attackSpeed', 0.2, { duration: 3, refresh: true, trigger: { when: 'ON_TARGET_CHANGED' } })],
  }),
  fm({
    id: 'FM_DIRT_GRIND', finishingCategory: 'TEMPO', nameKo: '모래 싸움',
    descriptionKo: '맞을수록 두꺼워지고, 두꺼워질수록 되돌려줍니다.',
    majorTag: 'STACK', tags: ['STACK', 'SURVIVAL', 'PENETRATION'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['tank'], surfaces: ['dirt'], aptitudeAxes: ['surfacePct.dirt'], phases: ['POSITIONING', 'LATE'] },
    vfx: { color: '#765844' },
    effects: [
      { kind: 'STACKING_STAT', stat: 'armor', value: 8, maxStacks: 3, trigger: { when: 'ON_BASIC_HIT_TAKEN', threshold: 5 } },
      { kind: 'STACKING_STAT', stat: 'magicResist', value: 8, maxStacks: 3, trigger: { when: 'ON_BASIC_HIT_TAKEN', threshold: 5 } },
      { kind: 'SUNDER_ARMOR_PCT', value: 0.1, duration: 5, target: 'CURRENT_TARGET', interval: 5, trigger: { when: 'ON_ATTACK' } },
    ],
  }),

  // --------------------------------------------------------------- AMPLIFY
  fm({
    id: 'FM_CHASER', finishingCategory: 'AMPLIFY', nameKo: '추격자',
    descriptionKo: '앞선 상대를 하나씩 잡아 넘깁니다.',
    majorTag: 'EXECUTE', tags: ['EXECUTE', 'RESET'], baseWeight: 1,
    guard: { appliesTo: 'ANY', needsTakedown: true },
    fit: { itemAxes: ['ad', 'crit'], styles: ['oikomi'], aptitudeAxes: ['stylePct.oikomi'], phases: ['LATE', 'LAST_3F'] },
    vfx: { color: '#a53c31' },
    effects: [
      { kind: 'DAMAGE_AMP', value: 0.1, trigger: { when: 'TARGET_HP_BELOW', threshold: 0.6 } },
      mul('attackSpeed', 0.1, { duration: 4, trigger: { when: 'ON_TAKEDOWN_ASSIST' } }),
      mul('moveSpeedHexPerSec', 0.2, { duration: 4, trigger: { when: 'ON_TAKEDOWN_ASSIST' } }),
    ],
  }),
  fm({
    id: 'FM_ONE_TARGET', finishingCategory: 'AMPLIFY', nameKo: '일대일 승부',
    descriptionKo: '한 상대만 보고 끝까지 갑니다.',
    majorTag: 'BASIC_ATTACK', tags: ['BASIC_ATTACK'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['ad', 'ap'], phases: ['POSITIONING', 'LATE'] },
    vfx: { color: '#a53c31' },
    effects: [{ kind: 'DAMAGE_AMP', value: 0.15, duration: 4, refresh: true, trigger: { when: 'ON_SAME_TARGET_NTH_ATTACK', threshold: 6 } }],
  }),
  fm({
    id: 'FM_COURSE_SPECIALIST', finishingCategory: 'AMPLIFY', nameKo: '코스 전문가',
    descriptionKo: '손에 익은 코스에서 흔들림이 없습니다.',
    majorTag: 'POSITION', tags: ['POSITION', 'MORE_LATE'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['ad', 'ap', 'tank'], phases: ['POSITIONING', 'LATE'] },
    vfx: { color: '#a98b4b' },
    effects: [
      mul('attackDamage', 0.08, { trigger: atPhase('POSITIONING') }),
      mul('abilityPower', 0.08, { trigger: atPhase('POSITIONING') }),
      add('armor', 8, { trigger: atPhase('LATE') }),
      add('magicResist', 8, { trigger: atPhase('LATE') }),
    ],
  }),
  fm({
    id: 'FM_RACE_READ', finishingCategory: 'AMPLIFY', nameKo: '전개 읽기',
    descriptionKo: '4코너에서 수가 밀리면 버티고, 아니면 갑니다. 둘 중 하나만 남습니다.',
    majorTag: 'RESET', tags: ['RESET', 'SURVIVAL'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['ad', 'tank'], phases: ['LATE'] },
    vfx: { color: '#3d6679' },
    // Both branches are printed on the card. The runtime picks one at LATE and
    // keeps it; nothing here silently optimises itself.
    effects: [],
  }),

  // --------------------------------------------------------------- PASSING
  fm({
    id: 'FM_OUTSIDE_PASS', finishingCategory: 'PASSING', nameKo: '외곽 추월',
    descriptionKo: '바깥으로 크게 돌아 단숨에 제칩니다.',
    majorTag: 'RESET', tags: ['RESET', 'POSITION'], baseWeight: 1,
    guard: { appliesTo: 'RANGED' },
    fit: { roles: ['AD_CARRY', 'AP_CARRY'], itemAxes: ['ad', 'crit'], phases: ['LATE'] },
    vfx: { color: '#3d6679' },
    effects: [
      { kind: 'DAMAGE_REDUCTION', value: 0.25, duration: 3, oncePerCombat: true, trigger: atPhase('LATE') },
      mul('attackSpeed', 0.2, { duration: 5, oncePerCombat: true, trigger: atPhase('LATE') }),
    ],
  }),
  fm({
    id: 'FM_GAP_SHOT', finishingCategory: 'PASSING', nameKo: '마군 돌파',
    descriptionKo: '열린 틈으로 그대로 파고듭니다.',
    majorTag: 'PENETRATION', tags: ['PENETRATION', 'RESET'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['penetration', 'ad'], phases: ['LATE'] },
    vfx: { color: '#a53c31' },
    effects: [
      { kind: 'SUNDER_ARMOR_PCT', value: 0.2, duration: 5, target: 'CURRENT_TARGET', interval: 6, trigger: { when: 'ON_TARGET_CHANGED' } },
      { kind: 'SHRED_MR_PCT', value: 0.2, duration: 5, target: 'CURRENT_TARGET', interval: 6, trigger: { when: 'ON_TARGET_CHANGED' } },
    ],
  }),

  // ------------------------------------------------------------ SUPPORT/CRIT
  fm({
    id: 'FM_LEFT_HAND', finishingCategory: 'SUPPORT', nameKo: '좌회전 적응',
    descriptionKo: '코너마다 한 발씩 앞서 나갑니다.',
    majorTag: 'POSITION', tags: ['POSITION', 'TEAM_SUPPORT'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['attackSpeed', 'utility'], phases: ['POSITIONING', 'LATE'] },
    vfx: { color: '#3f785d' },
    effects: [
      mul('attackSpeed', 0.12, { duration: 4, oncePerCombat: true, trigger: atPhase('POSITIONING') }),
      mul('attackSpeed', 0.12, { duration: 4, oncePerCombat: true, trigger: atPhase('LATE') }),
    ],
  }),
  fm({
    id: 'FM_PHOTO_EDGE', finishingCategory: 'CRIT', nameKo: '종반 집중',
    descriptionKo: '4코너부터 한 방 한 방이 날카로워집니다.',
    majorTag: 'MORE_LATE', tags: ['MORE_LATE', 'BASIC_ATTACK'], baseWeight: 1,
    guard: { appliesTo: 'ANY', roles: ['AD_CARRY', 'BRUISER'] },
    fit: { roles: ['AD_CARRY', 'BRUISER'], itemAxes: ['crit', 'ad'], phases: ['LATE', 'LAST_3F'] },
    vfx: { color: '#e8c86a' },
    effects: [
      { kind: 'CRIT_CHANCE_ADD', value: 0.25, trigger: atPhase('LATE') },
      { kind: 'CRIT_DAMAGE_ADD', value: 0.15, trigger: atPhase('LATE') },
    ],
  }),

  // --------------------------------------------------------------- ENCORE
  // Moves that buy another release of the unit's own skill. They are the
  // strongest thing in the pool on a big spell and nearly nothing on a unit
  // that never casts, which is exactly the read they are meant to ask for.
  fm({
    id: 'FM_ENCORE_STRAIGHT', finishingCategory: 'ENCORE', nameKo: '직선 재각',
    descriptionKo: '최종 직선에서 승부수가 한 번 더 나갑니다.',
    majorTag: 'CAST', tags: ['CAST', 'MORE_LATE'], baseWeight: 0.85,
    guard: { appliesTo: 'ANY', roles: ['AP_CARRY', 'AD_CARRY', 'BRUISER', 'SUPPORT'] },
    fit: { itemAxes: ['ap', 'mana'], phases: ['LAST_3F'] },
    vfx: { color: '#e8c86a', accent: '#fff3c4' },
    effects: [
      { kind: 'RECAST_SKILL', oncePerCombat: true, trigger: atPhase('LAST_3F') },
      { kind: 'SKILL_DAMAGE_AMP', value: 0.2, trigger: { when: 'IN_RACE_PHASE', phases: ['LATE', 'LAST_3F', 'OVERTIME'] } },
    ],
  }),
  fm({
    id: 'FM_ENCORE_DOUBLE', finishingCategory: 'ENCORE', nameKo: '연속 승부',
    descriptionKo: '4코너와 최종 직선에서 각각 한 번씩, 승부수가 두 번 더 나갑니다. 대신 평소 기력이 잘 돌지 않습니다.',
    majorTag: 'CAST', tags: ['CAST', 'MORE_LATE', 'RESET'], baseWeight: 0.75,
    guard: { appliesTo: 'ANY', roles: ['AP_CARRY', 'SUPPORT'] },
    fit: { roles: ['AP_CARRY'], itemAxes: ['ap', 'mana'], phases: ['LATE', 'LAST_3F'] },
    vfx: { color: '#7d3f6b', accent: '#d9a8ce' },
    effects: [
      { kind: 'RECAST_SKILL', oncePerCombat: true, trigger: atPhase('LATE') },
      { kind: 'RECAST_SKILL', oncePerCombat: true, trigger: atPhase('LAST_3F') },
      add('maxMana', 20, { trigger: { when: 'COMBAT_START' } }),
    ],
  }),
  fm({
    id: 'FM_ENCORE_KILL', finishingCategory: 'ENCORE', nameKo: '연쇄 승부수',
    descriptionKo: '상대를 쓰러뜨리면 그 자리에서 승부수가 다시 나갑니다.',
    majorTag: 'RESET', tags: ['RESET', 'CAST', 'EXECUTE'], baseWeight: 0.8,
    guard: { appliesTo: 'ANY', roles: ['AP_CARRY', 'AD_CARRY'], needsTakedown: true },
    fit: { roles: ['AP_CARRY', 'AD_CARRY'], itemAxes: ['ap', 'ad'], phases: ['LATE', 'LAST_3F'] },
    vfx: { color: '#a53c31', accent: '#ffd9b0' },
    effects: [
      { kind: 'RECAST_SKILL', interval: 6, trigger: { when: 'ON_KILL' } },
    ],
  }),

  // ----------------------------------------------------------- CONVERSION
  // Each of these takes something real away and hands back something else.
  // They should read as a decision, never as a free upgrade.
  fm({
    id: 'FM_CONVERT_GUTS', finishingCategory: 'CONVERSION', nameKo: '각력 전환',
    descriptionKo: '4코너에서 남은 방어를 힘으로 바꿉니다. 그때부터는 맞으면 아픕니다.',
    majorTag: 'EXECUTE', tags: ['EXECUTE', 'MORE_LATE'], baseWeight: 0.9,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['tank', 'ad'], phases: ['LATE', 'LAST_3F'] },
    vfx: { color: '#7d3f6b' },
    effects: [
      { kind: 'CONVERT_STAT', stat: 'attackDamage', tag: 'armor', value: 0.55, duration: 999,
        scaling: { cap: 1.5 }, oncePerCombat: true, trigger: atPhase('LATE') },
    ],
  }),
  fm({
    id: 'FM_CONVERT_SPELL', finishingCategory: 'CONVERSION', nameKo: '기술로 바꾼다',
    descriptionKo: '최종 직선에서 남은 마법 저항을 전부 기술로 바꿉니다.',
    majorTag: 'EXECUTE', tags: ['EXECUTE', 'CAST'], baseWeight: 0.9,
    guard: { appliesTo: 'ANY', roles: ['AP_CARRY', 'SUPPORT', 'BRUISER'] },
    fit: { roles: ['AP_CARRY'], itemAxes: ['ap', 'tank'], phases: ['LAST_3F'] },
    vfx: { color: '#7d3f6b' },
    effects: [
      { kind: 'CONVERT_STAT', stat: 'abilityPower', tag: 'magicResist', value: 0.7, duration: 999,
        scaling: { cap: 2.4 }, oncePerCombat: true, trigger: atPhase('LAST_3F') },
    ],
  }),
  fm({
    id: 'FM_CONVERT_BODY', finishingCategory: 'CONVERSION', nameKo: '몸을 아끼지 않는다',
    descriptionKo: '발주부터 방어를 벗고 달립니다. 훨씬 세게 때리고 훨씬 세게 맞습니다.',
    majorTag: 'EXECUTE', tags: ['EXECUTE', 'BASIC_ATTACK'], baseWeight: 0.85,
    guard: { appliesTo: 'ANY', roles: ['AD_CARRY', 'AP_CARRY'] },
    fit: { roles: ['AD_CARRY', 'AP_CARRY'], itemAxes: ['ad', 'crit'], phases: ['START', 'POSITIONING'] },
    vfx: { color: '#7d3f6b' },
    effects: [
      { kind: 'DAMAGE_AMP', value: 0.24, trigger: { when: 'COMBAT_START' } },
      { kind: 'DAMAGE_REDUCTION', value: -0.15, trigger: { when: 'COMBAT_START' } },
    ],
  }),

  // ------------------------------- additions to the existing categories
  fm({
    id: 'FM_FRONT_WIRE', finishingCategory: 'FRONTRUN', nameKo: '와이어 투 와이어',
    descriptionKo: '앞에 남은 상대가 많을수록 세게 끌고 갑니다. 정리될수록 힘이 빠집니다.',
    majorTag: 'MORE_EARLY', tags: ['MORE_EARLY', 'POSITION'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['attackSpeed', 'ad'], styles: ['nige'], aptitudeAxes: ['stylePct.nige'], phases: ['START', 'POSITIONING'] },
    vfx: { color: '#a53c31' },
    effects: [
      { kind: 'DAMAGE_AMP', value: 0.035, scaleBy: 'ENEMIES_ALIVE', scaleCap: 6,
        trigger: { when: 'IN_RACE_PHASE', phases: ['START', 'POSITIONING'] } },
      mul('moveSpeedHexPerSec', 0.2, { duration: 8, trigger: { when: 'COMBAT_START' } }),
    ],
  }),
  fm({
    id: 'FM_SUSTAIN_STAYER', finishingCategory: 'SUSTAIN', nameKo: '스테이어의 심장',
    descriptionKo: '경주가 길어질수록 회복이 빨라집니다. 짧게 끝나면 아무것도 아닙니다.',
    majorTag: 'SUSTAIN', tags: ['SUSTAIN', 'STACK'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['sustain', 'tank'], distances: ['stayer'], phases: ['LATE', 'LAST_3F'] },
    vfx: { color: '#3f785d' },
    effects: [
      { kind: 'HEAL_MAXHP_PCT', value: 0.035, target: 'SELF', trigger: { when: 'EVERY_SECONDS', threshold: 4 } },
      { kind: 'OMNIVAMP', value: 0.14, trigger: { when: 'IN_RACE_PHASE', phases: ['LATE', 'LAST_3F', 'OVERTIME'] } },
    ],
  }),
  fm({
    id: 'FM_BURST_PHOTO', finishingCategory: 'BURST', nameKo: '결승선 접전',
    descriptionKo: '연장 승부까지 끌고 가면 거기서부터가 진짜입니다. 한 번은 쓰러지지 않고 버팁니다.',
    majorTag: 'MORE_LATE', tags: ['MORE_LATE', 'SURVIVAL'], baseWeight: 0.9,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['tank', 'ad'], phases: ['LAST_3F', 'OVERTIME'] },
    vfx: { color: '#e8c86a' },
    effects: [
      { kind: 'SURVIVE_LETHAL', value: 0.3, oncePerCombat: true, trigger: atPhase('LAST_3F') },
      { kind: 'DAMAGE_AMP', value: 0.18, trigger: { when: 'IN_RACE_PHASE', phases: ['OVERTIME'] } },
    ],
  }),
  fm({
    id: 'FM_SPELL_CADENCE', finishingCategory: 'SPELL', nameKo: '일정한 각',
    descriptionKo: '구간이 넘어갈 때마다 기력이 크게 돌아옵니다. 그만큼 승부수가 자주 나갑니다.',
    majorTag: 'CAST', tags: ['CAST', 'RESET'], baseWeight: 1,
    guard: { appliesTo: 'ANY', roles: ['AP_CARRY', 'SUPPORT', 'BRUISER'] },
    fit: { roles: ['AP_CARRY', 'SUPPORT'], itemAxes: ['mana', 'ap'], phases: ['POSITIONING', 'LATE', 'LAST_3F'] },
    vfx: { color: '#3d6679' },
    effects: [
      { kind: 'MANA_ADD', value: 25, trigger: atPhase('POSITIONING') },
      { kind: 'MANA_ADD', value: 25, trigger: atPhase('LATE') },
      { kind: 'MANA_ADD', value: 25, trigger: atPhase('LAST_3F') },
    ],
  }),
  fm({
    id: 'FM_TEMPO_SWITCH', finishingCategory: 'TEMPO', nameKo: '진로 전환',
    descriptionKo: '상대를 바꿔 잡을 때마다 발이 빨라지고 다음 한 방이 무거워집니다.',
    majorTag: 'RESET', tags: ['RESET', 'BASIC_ATTACK'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['attackSpeed', 'ad'], phases: ['POSITIONING', 'LATE'] },
    vfx: { color: '#1e4938' },
    effects: [
      mul('attackSpeed', 0.18, { duration: 3, refresh: true, trigger: { when: 'ON_TARGET_CHANGED' } }),
      { kind: 'DAMAGE_AMP', value: 0.09, duration: 3, refresh: true, trigger: { when: 'ON_TARGET_CHANGED' } },
    ],
  }),
  fm({
    id: 'FM_AMPLIFY_PROGRESS', finishingCategory: 'AMPLIFY', nameKo: '후반형',
    descriptionKo: '경주가 진행될수록 계속 세집니다. 끝까지 가면 가장 셉니다.',
    majorTag: 'STACK', tags: ['STACK', 'MORE_LATE'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['ad', 'ap'], phases: ['LATE', 'LAST_3F'] },
    vfx: { color: '#a98b4b' },
    effects: [
      { kind: 'DAMAGE_AMP', value: 0.19, scaleBy: 'RACE_PROGRESS',
        trigger: { when: 'IN_RACE_PHASE', phases: ['POSITIONING', 'LATE', 'LAST_3F', 'OVERTIME'] } },
    ],
  }),
  fm({
    id: 'FM_PASS_THREAD', finishingCategory: 'PASSING', nameKo: '말군 돌파',
    descriptionKo: '최종 직선에서 앞에 남은 상대 수만큼 발이 빨라집니다.',
    majorTag: 'MORE_LATE', tags: ['MORE_LATE', 'POSITION'], baseWeight: 1,
    guard: { appliesTo: 'ANY' },
    fit: { itemAxes: ['attackSpeed', 'ad'], styles: ['sashi', 'oikomi'],
      aptitudeAxes: ['stylePct.sashi', 'stylePct.oikomi'], phases: ['LAST_3F'] },
    vfx: { color: '#3d6679' },
    effects: [
      { kind: 'STAT_MUL', stat: 'attackSpeed', value: 0.07, scaleBy: 'ENEMIES_ALIVE', scaleCap: 6,
        duration: 999, oncePerCombat: true, trigger: atPhase('LAST_3F') },
      { kind: 'DAMAGE_AMP', value: 0.1, trigger: { when: 'IN_RACE_PHASE', phases: ['LAST_3F', 'OVERTIME'] } },
    ],
  }),
  fm({
    id: 'FM_SUPPORT_PACEMAKER', finishingCategory: 'SUPPORT', nameKo: '페이스메이커',
    descriptionKo: '앞에서 바람을 받아 주는 대신, 뒤의 동료들이 훨씬 편하게 갑니다.',
    majorTag: 'TEAM_SUPPORT', tags: ['TEAM_SUPPORT', 'POSITION'], baseWeight: 1,
    guard: { appliesTo: 'MELEE', needsAdjacentAlly: true },
    fit: { roles: ['TANK', 'BRUISER'], itemAxes: ['tank'], phases: ['POSITIONING', 'LATE'] },
    vfx: { color: '#3f785d' },
    effects: [
      { kind: 'DAMAGE_AMP', value: 0.08, target: 'ALL_ALLIES', excludeSelf: true, trigger: { when: 'COMBAT_START' } },
      { kind: 'DAMAGE_REDUCTION', value: -0.06, trigger: { when: 'COMBAT_START' } },
      add('armor', 18, { trigger: { when: 'COMBAT_START' } }),
    ],
  }),
  fm({
    id: 'FM_CRIT_CLOSER', finishingCategory: 'CRIT', nameKo: '한 방 노림',
    descriptionKo: '뒷줄에서 기다렸다가 직선에 들어서면 치명타만 노립니다.',
    majorTag: 'MORE_LATE', tags: ['MORE_LATE', 'POSITION'], baseWeight: 1,
    guard: { appliesTo: 'RANGED', roles: ['AD_CARRY'] },
    fit: { roles: ['AD_CARRY'], itemAxes: ['crit', 'ad'], phases: ['LAST_3F'] },
    vfx: { color: '#e8c86a' },
    effects: [
      { kind: 'CRIT_CHANCE_ADD', value: 0.2, trigger: { when: 'IN_BACK_ROWS' } },
      { kind: 'CRIT_DAMAGE_ADD', value: 0.3, trigger: { when: 'IN_RACE_PHASE', phases: ['LAST_3F', 'OVERTIME'] } },
      { kind: 'SKILLS_CAN_CRIT', value: 1, trigger: { when: 'COMBAT_START' } },
    ],
  }),
];

/** LATE branch for FM_RACE_READ: outnumbered holds, otherwise pushes. */
export const RACE_READ_BRANCHES: { hold: EffectDef[]; push: EffectDef[] } = {
  hold: [add('armor', 20), add('magicResist', 20), { kind: 'DAMAGE_REDUCTION', value: 0.08 }],
  push: [{ kind: 'DAMAGE_AMP', value: 0.12 }],
};

/**
 * Signature moves, one per unit, all verified present in all-units.json.
 *
 * Historic standing never buys extra numbers: these sit in the same power band
 * as the generic pool and differ only in how and when they fire. Guards are set
 * from the unit's real `attackRange`, not its reputation — 사일런스 스즈카 races
 * as a nige horse but is built here as a range-4 AP carry, so her move never
 * touches movement speed.
 */
export const SIGNATURE_MOVE_DEFS: RacePlanNode[] = [
  fm({
    id: 'FM_SIG_KITASAN_BLACK', signatureUnitId: 'kitasan_black', finishingCategory: 'SUSTAIN',
    nameKo: '개선문의 왕도', descriptionKo: '4코너에 몸을 두껍게 하고, 남은 것을 힘으로 바꿉니다.',
    majorTag: 'SURVIVAL', tags: ['SURVIVAL', 'MORE_LATE'], baseWeight: 1,
    guard: { appliesTo: 'MELEE' }, fit: { phases: ['LATE', 'LAST_3F'] }, vfx: { color: '#a98b4b' },
    effects: [
      { kind: 'SHIELD_MAXHP_PCT', value: 0.12, duration: 6, target: 'SELF', oncePerCombat: true, trigger: atPhase('LATE') },
      add('attackDamage', 45, { oncePerCombat: true, trigger: atPhase('LAST_3F') }),
    ],
  }),
  fm({
    id: 'FM_SIG_SYMBOLI_RUDOLF', signatureUnitId: 'symboli_rudolf', finishingCategory: 'SUPPORT',
    nameKo: '황제의 완전무결', descriptionKo: '받아낸 방해만큼 단단해지고, 그것을 팀에 나눕니다.',
    majorTag: 'TEAM_SUPPORT', tags: ['SURVIVAL', 'TEAM_SUPPORT', 'STACK'], baseWeight: 1,
    guard: { appliesTo: 'MELEE' }, fit: { phases: ['POSITIONING', 'LAST_3F'] }, vfx: { color: '#a98b4b' },
    effects: [
      { kind: 'STACKING_STAT', stat: 'armor', value: 6, maxStacks: 5, trigger: { when: 'ON_CC_APPLIED' } },
      { kind: 'STACKING_STAT', stat: 'magicResist', value: 6, maxStacks: 5, trigger: { when: 'ON_CC_APPLIED' } },
      { kind: 'DAMAGE_REDUCTION', value: 0.06, duration: 3, target: 'ALL_ALLIES', trigger: atPhase('LAST_3F') },
    ],
  }),
  fm({
    id: 'FM_SIG_SPECIAL_WEEK', signatureUnitId: 'special_week', finishingCategory: 'PASSING',
    nameKo: '일본 제일의 각력', descriptionKo: '4코너에 방어를 벗겨내고, 잡아내면 마지막까지 뻗습니다.',
    majorTag: 'PENETRATION', tags: ['PENETRATION', 'MORE_LATE'], baseWeight: 1,
    guard: { appliesTo: 'RANGED' }, fit: { phases: ['LATE', 'LAST_3F'] }, vfx: { color: '#8de2ff' },
    effects: [
      { kind: 'SUNDER_ARMOR_PCT', value: 0.18, duration: 5, target: 'CURRENT_TARGET', trigger: atPhase('LATE') },
      { kind: 'SHRED_MR_PCT', value: 0.18, duration: 5, target: 'CURRENT_TARGET', trigger: atPhase('LATE') },
      mul('attackDamage', 0.15, { oncePerCombat: true, trigger: atPhase('LAST_3F') }),
    ],
  }),
  fm({
    id: 'FM_SIG_DAIWA_SCARLET', signatureUnitId: 'daiwa_scarlet', finishingCategory: 'FRONTRUN',
    nameKo: '무너지지 않는 선두', descriptionKo: '템을 온전히 넘기면 그대로 굳어집니다.',
    majorTag: 'MORE_EARLY', tags: ['MORE_EARLY', 'SURVIVAL'], baseWeight: 1,
    guard: { appliesTo: 'RANGED' }, fit: { phases: ['START', 'POSITIONING'] }, vfx: { color: '#a53c31' },
    effects: [
      { kind: 'DAMAGE_REDUCTION', value: 0.12, duration: 5, trigger: { when: 'COMBAT_START' } },
      mul('abilityPower', 0.22, { trigger: atPhase('POSITIONING', { hpAbove: 0.8 }) }),
    ],
  }),
  fm({
    id: 'FM_SIG_TAIKI_SHUTTLE', signatureUnitId: 'taiki_shuttle', finishingCategory: 'SPELL',
    nameKo: '국제선의 마일러', descriptionKo: '시전 뒤의 기본 공격이 뒤까지 꿰뚫습니다.',
    majorTag: 'CAST', tags: ['CAST', 'BASIC_ATTACK'], baseWeight: 1,
    guard: { appliesTo: 'RANGED' }, fit: { phases: ['POSITIONING', 'LATE'] }, vfx: { color: '#3d6679' },
    effects: [
      { kind: 'SPLASH_ON_HIT', value: 0.4, duration: 3, maxStacks: 6, trigger: { when: 'ON_CAST' } },
      { kind: 'MANA_ADD', value: 6, interval: 4, trigger: { when: 'ON_CAST' } },
    ],
  }),
  fm({
    id: 'FM_SIG_MIHONO_BOURBON', signatureUnitId: 'mihono_bourbon', finishingCategory: 'TEMPO',
    nameKo: '사이보그의 랩', descriptionKo: '무슨 일이 있어도 랩이 흐트러지지 않습니다.',
    majorTag: 'STACK', tags: ['STACK'], baseWeight: 1,
    guard: { appliesTo: 'RANGED' }, fit: { phases: ['POSITIONING', 'LATE'] }, vfx: { color: '#3d6679' },
    effects: [
      { kind: 'STACKING_STAT', stat: 'abilityPower', value: 7, maxStacks: 5, trigger: { when: 'EVERY_SECONDS', threshold: 4 } },
      { kind: 'STACKING_STAT', stat: 'armor', value: 4, maxStacks: 5, trigger: { when: 'EVERY_SECONDS', threshold: 4 } },
      { kind: 'STACKING_STAT', stat: 'magicResist', value: 4, maxStacks: 5, trigger: { when: 'EVERY_SECONDS', threshold: 4 } },
    ],
  }),
  fm({
    id: 'FM_SIG_OGURI_CAP', signatureUnitId: 'oguri_cap', finishingCategory: 'AMPLIFY',
    nameKo: '괴물의 말각', descriptionKo: '4코너 이후 새 상대를 볼 때마다 더 무겁게 때립니다.',
    majorTag: 'RESET', tags: ['RESET', 'MORE_LATE'], baseWeight: 1,
    guard: { appliesTo: 'RANGED' }, fit: { phases: ['LATE', 'LAST_3F'] }, vfx: { color: '#a98b4b' },
    effects: [
      { kind: 'STACKING_STAT', stat: 'abilityPower', value: 0.08, tag: 'PCT', maxStacks: 3, trigger: { when: 'ON_TARGET_CHANGED' } },
      { kind: 'MANA_ADD', value: 15, trigger: { when: 'ON_TAKEDOWN_ASSIST' } },
    ],
  }),
  fm({
    id: 'FM_SIG_ORFEVRE', signatureUnitId: 'orfevre', finishingCategory: 'BURST',
    nameKo: '폭주하는 황금', descriptionKo: '몰릴수록 빨라지지만, 그만큼 무방비해집니다.',
    majorTag: 'SURVIVAL', tags: ['SURVIVAL', 'MORE_LATE'], baseWeight: 1,
    guard: { appliesTo: 'RANGED' }, fit: { phases: ['LATE', 'LAST_3F'] }, vfx: { color: '#e8c86a' },
    effects: [
      mul('attackSpeed', 0.25, { oncePerCombat: true, trigger: { when: 'HP_BELOW', threshold: 0.6 } }),
      { kind: 'DAMAGE_REDUCTION', value: -0.08, oncePerCombat: true, trigger: { when: 'HP_BELOW', threshold: 0.6 } },
      { kind: 'DAMAGE_REDUCTION', value: 0.08, oncePerCombat: true, trigger: atPhase('LAST_3F') },
    ],
  }),
  fm({
    id: 'FM_SIG_SMART_FALCON', signatureUnitId: 'smart_falcon', finishingCategory: 'TEMPO',
    nameKo: '모래의 선두', descriptionKo: '모래를 뒤집어쓸수록 발이 살아납니다.',
    majorTag: 'STACK', tags: ['STACK', 'PENETRATION'], baseWeight: 1,
    guard: { appliesTo: 'RANGED' }, fit: { surfaces: ['dirt'], aptitudeAxes: ['surfacePct.dirt'], phases: ['POSITIONING', 'LATE'] },
    vfx: { color: '#765844' },
    effects: [
      { kind: 'STACKING_STAT', stat: 'abilityPower', value: 8, maxStacks: 8, trigger: { when: 'ON_HIT_TAKEN' } },
      { kind: 'SUNDER_ARMOR_PCT', value: 0.15, duration: 4, target: 'CURRENT_TARGET', interval: 6, trigger: atPhase('LATE') },
    ],
  }),
  fm({
    id: 'FM_SIG_MARUZENSKY', signatureUnitId: 'maruzensky', finishingCategory: 'SUPPORT',
    nameKo: '슈퍼카의 선행', descriptionKo: '팀 전체의 첫 스킬을 앞당깁니다.',
    majorTag: 'TEAM_SUPPORT', tags: ['TEAM_SUPPORT', 'CAST'], baseWeight: 1,
    guard: { appliesTo: 'ANY' }, fit: { phases: ['START', 'POSITIONING'] }, vfx: { color: '#3d6679' },
    effects: [
      { kind: 'MANA_ADD', value: 8, target: 'ALL_ALLIES', trigger: { when: 'COMBAT_START' } },
      { kind: 'MANA_ADD', value: 6, target: 'LOWEST_HP_ALLY', interval: 4, trigger: { when: 'ON_CAST' } },
    ],
  }),
  fm({
    id: 'FM_SIG_GOLD_SHIP', signatureUnitId: 'gold_ship', finishingCategory: 'BURST',
    nameKo: '파천황의 롱 스퍼트', descriptionKo: '무엇을 하든 각력이 쌓이고, 어느 순간 전부 터집니다.',
    majorTag: 'STACK', tags: ['STACK', 'MORE_LATE'], baseWeight: 1,
    guard: { appliesTo: 'MELEE' }, fit: { styles: ['oikomi'], aptitudeAxes: ['stylePct.oikomi'], phases: ['LATE', 'LAST_3F'] },
    vfx: { color: '#ad9bff' },
    effects: [],
    resource: {
      kind: 'LEG', max: 10, gainOnAttack: 1, gainOnCast: 1, gainOnHitTaken: 1,
      payoutPhase: 'LATE', consume: true, label: '각력',
      perStack: [mul('attackDamage', 0.03, { duration: 6 })],
    },
  }),
  fm({
    id: 'FM_SIG_GRASS_WONDER', signatureUnitId: 'grass_wonder', finishingCategory: 'PASSING',
    nameKo: '불굴의 그래스', descriptionKo: '한 번 물면 놓지 않고, 넘어가면 그대로 다음으로.',
    majorTag: 'PENETRATION', tags: ['PENETRATION', 'BASIC_ATTACK'], baseWeight: 1,
    guard: { appliesTo: 'RANGED' }, fit: { phases: ['POSITIONING', 'LATE'] }, vfx: { color: '#3f785d' },
    effects: [
      { kind: 'SUNDER_ARMOR_PCT', value: 0.12, duration: 4, target: 'CURRENT_TARGET', trigger: { when: 'ON_SAME_TARGET_NTH_ATTACK', threshold: 3 } },
      mul('attackSpeed', 0.12, { duration: 4, trigger: { when: 'ON_TAKEDOWN_ASSIST' } }),
    ],
  }),
  fm({
    id: 'FM_SIG_SUPER_CREEK', signatureUnitId: 'super_creek', finishingCategory: 'SUSTAIN',
    nameKo: '불침의 스테이어', descriptionKo: '오래 버틸수록 회복과 방어가 함께 붙습니다.',
    majorTag: 'STACK', tags: ['STACK', 'SUSTAIN'], baseWeight: 1,
    guard: { appliesTo: 'MELEE' }, fit: { distances: ['stayer'], aptitudeAxes: ['distancePct.long'], phases: ['LATE'] },
    vfx: { color: '#3f785d' },
    effects: [],
    resource: {
      kind: 'STAMINA', max: 6, gainPerSeconds: 5, payoutPhase: 'LATE', label: '지구력',
      perStack: [add('armor', 4), add('magicResist', 4), { kind: 'HEAL_MAXHP_PCT', value: 0.02, target: 'SELF' }],
    },
  }),
  fm({
    id: 'FM_SIG_COPANO_RICKEY', signatureUnitId: 'copano_rickey', finishingCategory: 'AMPLIFY',
    nameKo: '더트의 대기록', descriptionKo: '한 번 잡을 때마다 기록이 쌓이고, 쌓일수록 넓어집니다.',
    majorTag: 'EXECUTE', tags: ['EXECUTE', 'STACK'], baseWeight: 1,
    guard: { appliesTo: 'RANGED', needsTakedown: true },
    fit: { surfaces: ['dirt'], aptitudeAxes: ['surfacePct.dirt'], phases: ['POSITIONING', 'LATE'] },
    vfx: { color: '#765844' },
    effects: [
      { kind: 'STACKING_STAT', stat: 'attackDamage', value: 0.06, tag: 'PCT', maxStacks: 5, trigger: { when: 'ON_TAKEDOWN_ASSIST' } },
      { kind: 'SPLASH_ON_HIT', value: 0.35, trigger: { when: 'ON_TAKEDOWN_ASSIST' } },
    ],
  }),
  fm({
    id: 'FM_SIG_HOKKO_TARUMAE', signatureUnitId: 'hokko_tarumae', finishingCategory: 'SPELL',
    nameKo: '모래 위의 지구력', descriptionKo: '스킬로 준 만큼 돌려받고, 4코너엔 두 배로 받습니다.',
    majorTag: 'SUSTAIN', tags: ['SUSTAIN', 'CAST'], baseWeight: 1,
    guard: { appliesTo: 'RANGED' },
    fit: { surfaces: ['dirt'], aptitudeAxes: ['surfacePct.dirt'], phases: ['POSITIONING', 'LATE'] },
    vfx: { color: '#765844' },
    effects: [
      { kind: 'OMNIVAMP', value: 0.12, trigger: { when: 'COMBAT_START' } },
      { kind: 'OMNIVAMP', value: 0.12, trigger: atPhase('LATE') },
    ],
  }),
  fm({
    id: 'FM_SIG_SILENCE_SUZUKA', signatureUnitId: 'silence_suzuka', finishingCategory: 'FRONTRUN',
    nameKo: '이차원의 도주', descriptionKo: '중반까지 앞서 있으면 아무도 따라오지 못합니다.',
    majorTag: 'MORE_EARLY', tags: ['MORE_EARLY'], baseWeight: 1,
    // Built as a range-4 AP carry: she never walks, so nothing here touches
    // movement speed even though her recorded style is nige.
    guard: { appliesTo: 'RANGED' }, fit: { styles: ['nige'], aptitudeAxes: ['stylePct.nige'], phases: ['START', 'POSITIONING'] },
    vfx: { color: '#8de2ff' },
    effects: [
      mul('attackSpeed', 0.28, { duration: 10, trigger: { when: 'COMBAT_START' } }),
      mul('abilityPower', 0.18, { trigger: atPhase('POSITIONING') }),
      { kind: 'DAMAGE_REDUCTION', value: -0.05, trigger: atPhase('POSITIONING') },
    ],
  }),
];

export const ALL_FINISHING_DEFS: RacePlanNode[] = [...FINISHING_MOVE_DEFS, ...SIGNATURE_MOVE_DEFS];
