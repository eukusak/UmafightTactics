/**
 * The 24 stage-3 evolutions.
 *
 * An evolution sharpens the plan already chosen: it attaches through
 * `requires`, which is matched against the plan's tags, so a slow-pace plan
 * never branches into a gate-rush.
 */
import type { EffectDef } from '../types';
import type { RacePlanNode } from './types';

const mul = (stat: EffectDef['stat'], value: number, extra: Partial<EffectDef> = {}): EffectDef => ({
  kind: 'STAT_MUL', stat, value, ...extra,
});
const add = (stat: EffectDef['stat'], value: number, extra: Partial<EffectDef> = {}): EffectDef => ({
  kind: 'STAT_ADD', stat, value, ...extra,
});
const atPhase = (phase: 'LATE' | 'LAST_3F' | 'POSITIONING', extra: Partial<EffectDef['trigger']> = {}) =>
  ({ when: 'ON_RACE_PHASE' as const, phase, ...extra });

export const RACE_EVOLUTION_DEFS: RacePlanNode[] = [
  {
    id: 'EV_EARLY_OVERPACE', kind: 'EVOLUTION', nameKo: '오버페이스',
    descriptionKo: '템에 더 밀어붙이는 대신 승부처에서 숨이 찹니다.',
    majorTag: 'MORE_EARLY', tags: ['MORE_EARLY'], requires: ['MORE_EARLY', 'BASIC_ATTACK'], baseWeight: 1,
    guard: { appliesTo: 'ANY' }, fit: { phases: ['START', 'POSITIONING'] },
    effects: [
      mul('attackSpeed', 0.14, { duration: 12, trigger: { when: 'COMBAT_START' } }),
      mul('attackSpeed', -0.07, { trigger: atPhase('LATE') }),
    ],
  },
  {
    id: 'EV_EARLY_CLEAN_START', kind: 'EVOLUTION', nameKo: '호발',
    descriptionKo: '출발이 깔끔하면 곧바로 몸을 감쌉니다.',
    majorTag: 'SURVIVAL', tags: ['MORE_EARLY', 'SURVIVAL', 'CAST'], requires: ['MORE_EARLY', 'CAST', 'SURVIVAL'], baseWeight: 1,
    guard: { appliesTo: 'ANY' }, fit: { phases: ['START'] },
    effects: [{ kind: 'SHIELD_MAXHP_PCT', value: 0.1, duration: 8, target: 'SELF', oncePerCombat: true, trigger: { when: 'ON_CAST' } }],
  },
  {
    id: 'EV_EARLY_FRONT_LOCK', kind: 'EVOLUTION', nameKo: '선두 고정',
    descriptionKo: '처음 잡은 상대를 놓지 않습니다.',
    majorTag: 'BASIC_ATTACK', tags: ['MORE_EARLY', 'BASIC_ATTACK'], requires: ['MORE_EARLY', 'BASIC_ATTACK', 'PENETRATION'], baseWeight: 1,
    guard: { appliesTo: 'ANY' }, fit: { phases: ['START', 'POSITIONING'] },
    effects: [{ kind: 'DAMAGE_AMP', value: 0.1, duration: 8, oncePerCombat: true, trigger: { when: 'COMBAT_START' } }],
  },
  {
    id: 'EV_MID_EFFICIENT', kind: 'EVOLUTION', nameKo: '효율적인 랩',
    descriptionKo: '도중 구간의 스킬 비용을 줄입니다.',
    majorTag: 'CAST', tags: ['CAST'], requires: ['CAST', 'STACK', 'MORE_LATE'], baseWeight: 1,
    guard: { appliesTo: 'ANY', roles: ['AP_CARRY', 'SUPPORT', 'BRUISER'] }, fit: { phases: ['POSITIONING'] },
    effects: [{ kind: 'MANA_ADD', value: 5, trigger: { when: 'ON_CAST' } }],
  },
  {
    id: 'EV_MID_SECOND_WIND', kind: 'EVOLUTION', nameKo: '두 번째 호흡',
    descriptionKo: '도중에 한 번 숨을 고릅니다.',
    majorTag: 'SUSTAIN', tags: ['SUSTAIN', 'SURVIVAL'], requires: ['SUSTAIN', 'SURVIVAL', 'STACK'], baseWeight: 1,
    guard: { appliesTo: 'ANY' }, fit: { phases: ['POSITIONING'] },
    effects: [
      { kind: 'HEAL_MAXHP_PCT', value: 0.1, target: 'SELF', oncePerCombat: true, trigger: atPhase('POSITIONING') },
      { kind: 'MANA_ADD', value: 10, oncePerCombat: true, trigger: atPhase('LATE') },
    ],
  },
  {
    id: 'EV_MID_FORMATION', kind: 'EVOLUTION', nameKo: '대열 유지',
    descriptionKo: '옆의 아군과 서로를 지킵니다.',
    majorTag: 'TEAM_SUPPORT', tags: ['POSITION', 'SURVIVAL', 'TEAM_SUPPORT'], requires: ['POSITION', 'SURVIVAL', 'TEAM_SUPPORT'], baseWeight: 1,
    guard: { appliesTo: 'ANY', needsAdjacentAlly: true }, fit: { phases: ['POSITIONING'] },
    effects: [{ kind: 'DAMAGE_REDUCTION', value: 0.06, trigger: { when: 'ADJACENT_ALLIES_AT_LEAST', threshold: 1 } }],
  },
  {
    id: 'EV_LATE_SAVE_LEGS', kind: 'EVOLUTION', nameKo: '각력 온존',
    descriptionKo: '승부처 전까지 아끼고 그 뒤에 몰아 씁니다.',
    majorTag: 'MORE_LATE', tags: ['MORE_LATE', 'STACK'], requires: ['MORE_LATE', 'STACK', 'SUSTAIN'], baseWeight: 1,
    guard: { appliesTo: 'ANY' }, fit: { phases: ['LATE', 'LAST_3F'] },
    effects: [
      mul('attackSpeed', -0.04, { trigger: { when: 'COMBAT_START' } }),
      mul('attackSpeed', 0.22, { trigger: atPhase('LATE') }),
    ],
  },
  {
    id: 'EV_LATE_LONG_SPURT', kind: 'EVOLUTION', nameKo: '롱 스퍼트',
    descriptionKo: '승부처부터 마지막까지 계속 뻗어 나갑니다.',
    majorTag: 'MORE_LATE', tags: ['MORE_LATE'], requires: ['MORE_LATE', 'STACK', 'SURVIVAL'], baseWeight: 1,
    guard: { appliesTo: 'ANY' }, fit: { phases: ['LATE', 'LAST_3F'] },
    effects: [
      mul('attackSpeed', 0.12, { trigger: atPhase('LATE') }),
      mul('attackSpeed', 0.12, { trigger: atPhase('LAST_3F') }),
    ],
  },
  {
    id: 'EV_LATE_ONE_KICK', kind: 'EVOLUTION', nameKo: '한 번의 끝걸음',
    descriptionKo: '마지막 직선의 한 방만 노립니다.',
    majorTag: 'CAST', tags: ['MORE_LATE', 'CAST'], requires: ['MORE_LATE', 'CAST'], baseWeight: 1,
    guard: { appliesTo: 'ANY' }, fit: { phases: ['LAST_3F'] },
    effects: [{ kind: 'SKILL_DAMAGE_AMP', value: 0.3, trigger: atPhase('LAST_3F') }],
  },
  {
    id: 'EV_PASS_WEAK', kind: 'EVOLUTION', nameKo: '약자 추월',
    descriptionKo: '약해진 상대를 먼저 넘어갑니다.',
    majorTag: 'EXECUTE', tags: ['EXECUTE', 'RESET'], requires: ['EXECUTE', 'RESET', 'MORE_LATE'], baseWeight: 1,
    guard: { appliesTo: 'ANY' }, fit: { phases: ['LATE', 'LAST_3F'] },
    effects: [{ kind: 'DAMAGE_AMP', value: 0.12, trigger: { when: 'TARGET_HP_BELOW', threshold: 0.5 } }],
  },
  {
    id: 'EV_PASS_BACKLINE', kind: 'EVOLUTION', nameKo: '외곽 진로',
    descriptionKo: '바깥으로 크게 돌아 뒤쪽을 노립니다.',
    majorTag: 'POSITION', tags: ['POSITION', 'RESET'], requires: ['POSITION', 'RESET'], baseWeight: 1,
    guard: { appliesTo: 'RANGED' }, fit: { roles: ['AD_CARRY', 'AP_CARRY'], phases: ['LATE'] },
    effects: [{ kind: 'DAMAGE_AMP', value: 0.12, duration: 6, oncePerCombat: true, trigger: atPhase('LATE') }],
  },
  {
    id: 'EV_PASS_ARMOR', kind: 'EVOLUTION', nameKo: '마군 개방',
    descriptionKo: '새 상대에게 붙을 때마다 방어를 벗겨냅니다.',
    majorTag: 'PENETRATION', tags: ['PENETRATION', 'RESET'], requires: ['PENETRATION', 'RESET', 'BASIC_ATTACK'], baseWeight: 1,
    guard: { appliesTo: 'ANY' }, fit: { phases: ['POSITIONING', 'LATE'] },
    effects: [
      { kind: 'SUNDER_ARMOR_PCT', value: 0.12, duration: 5, target: 'CURRENT_TARGET', interval: 6, trigger: { when: 'ON_TARGET_CHANGED' } },
      { kind: 'SHRED_MR_PCT', value: 0.12, duration: 5, target: 'CURRENT_TARGET', interval: 6, trigger: { when: 'ON_TARGET_CHANGED' } },
    ],
  },
  {
    id: 'EV_GUTS_SHIELD', kind: 'EVOLUTION', nameKo: '버티기',
    descriptionKo: '무너지기 직전에 한 번 몸을 감쌉니다.',
    majorTag: 'SURVIVAL', tags: ['SURVIVAL'], requires: ['SURVIVAL', 'SUSTAIN'], baseWeight: 1,
    guard: { appliesTo: 'ANY' }, fit: { phases: ['POSITIONING', 'LATE'] },
    effects: [{ kind: 'SHIELD_MAXHP_PCT', value: 0.12, duration: 5, target: 'SELF', oncePerCombat: true, trigger: { when: 'HP_BELOW', threshold: 0.35 } }],
  },
  {
    id: 'EV_GUTS_HEAL', kind: 'EVOLUTION', nameKo: '재가속',
    descriptionKo: '저체력에서 되살아나 다시 붙습니다.',
    majorTag: 'SUSTAIN', tags: ['SURVIVAL', 'SUSTAIN'], requires: ['SURVIVAL', 'SUSTAIN'], baseWeight: 1,
    guard: { appliesTo: 'ANY' }, fit: { phases: ['LATE', 'LAST_3F'] },
    effects: [{ kind: 'OMNIVAMP', value: 0.08, duration: 6, oncePerCombat: true, trigger: { when: 'HP_BELOW', threshold: 0.35 } }],
  },
  {
    id: 'EV_GUTS_LAST', kind: 'EVOLUTION', nameKo: '마지막 한 걸음',
    descriptionKo: '쓰러지기 직전 한 걸음을 더 갑니다.',
    majorTag: 'SURVIVAL', tags: ['SURVIVAL'], requires: ['SURVIVAL', 'MORE_LATE'], baseWeight: 0.9,
    guard: { appliesTo: 'ANY' }, fit: { phases: ['LATE', 'LAST_3F'] },
    effects: [
      { kind: 'SURVIVE_LETHAL', value: 1.25, oncePerCombat: true, tag: 'RACE_PLAN' },
      mul('attackSpeed', 0.2, { duration: 1.25, oncePerCombat: true, trigger: { when: 'HP_BELOW', threshold: 0.15 } }),
    ],
  },
  {
    id: 'EV_CAST_RHYTHM', kind: 'EVOLUTION', nameKo: '호흡',
    descriptionKo: '두 번째 스킬부터 마나를 조금 돌려받습니다.',
    majorTag: 'CAST', tags: ['CAST'], requires: ['CAST', 'STACK'], baseWeight: 1,
    guard: { appliesTo: 'ANY', roles: ['AP_CARRY', 'SUPPORT', 'BRUISER', 'TANK'] }, fit: { phases: ['POSITIONING', 'LATE'] },
    effects: [{ kind: 'MANA_ADD', value: 6, trigger: { when: 'ON_CAST' } }],
  },
  {
    id: 'EV_CAST_FINISH', kind: 'EVOLUTION', nameKo: '결승선 스킬',
    descriptionKo: '마지막 직선의 스킬이 더 무겁게 들어갑니다.',
    majorTag: 'CAST', tags: ['CAST', 'MORE_LATE'], requires: ['CAST', 'MORE_LATE'], baseWeight: 1,
    guard: { appliesTo: 'ANY' }, fit: { phases: ['LAST_3F'] },
    effects: [{ kind: 'SKILL_DAMAGE_AMP', value: 0.15, trigger: atPhase('LAST_3F') }],
  },
  {
    id: 'EV_ATTACK_RHYTHM', kind: 'EVOLUTION', nameKo: '보폭',
    descriptionKo: '일정한 보폭으로 속도를 쌓습니다.',
    majorTag: 'BASIC_ATTACK', tags: ['BASIC_ATTACK'], requires: ['BASIC_ATTACK', 'STACK', 'MORE_EARLY'], baseWeight: 1,
    guard: { appliesTo: 'ANY' }, fit: { phases: ['POSITIONING', 'LATE'] },
    effects: [mul('attackSpeed', 0.1, { duration: 5, refresh: true, trigger: { when: 'ON_NTH_ATTACK', threshold: 5 } })],
  },
  {
    id: 'EV_ATTACK_PRESSURE', kind: 'EVOLUTION', nameKo: '압박',
    descriptionKo: '같은 상대를 계속 때려 방어를 깎습니다.',
    majorTag: 'PENETRATION', tags: ['BASIC_ATTACK', 'PENETRATION'], requires: ['BASIC_ATTACK', 'PENETRATION'], baseWeight: 1,
    guard: { appliesTo: 'ANY' }, fit: { phases: ['POSITIONING', 'LATE'] },
    effects: [
      { kind: 'SUNDER_ARMOR_PCT', value: 0.1, duration: 4, target: 'CURRENT_TARGET', trigger: { when: 'ON_SAME_TARGET_NTH_ATTACK', threshold: 6 } },
      { kind: 'SHRED_MR_PCT', value: 0.1, duration: 4, target: 'CURRENT_TARGET', trigger: { when: 'ON_SAME_TARGET_NTH_ATTACK', threshold: 6 } },
    ],
  },
  {
    id: 'EV_TEAM_PACE', kind: 'EVOLUTION', nameKo: '페이스 메이커',
    descriptionKo: '출주마의 스킬이 옆의 아군까지 끌어올립니다.',
    majorTag: 'TEAM_SUPPORT', tags: ['TEAM_SUPPORT', 'CAST'], requires: ['TEAM_SUPPORT', 'CAST', 'POSITION'], baseWeight: 1,
    guard: { appliesTo: 'ANY', needsAdjacentAlly: true }, fit: { roles: ['SUPPORT', 'AP_CARRY', 'TANK'], phases: ['POSITIONING', 'LATE'] },
    effects: [mul('attackSpeed', 0.08, { duration: 4, target: 'LOWEST_HP_ALLIES', maxTargets: 2, trigger: { when: 'ON_CAST' } })],
  },
  {
    id: 'EV_STAMINA_BANK', kind: 'EVOLUTION', nameKo: '지구력 비축',
    descriptionKo: '버틴 만큼 단단해집니다.',
    majorTag: 'STACK', tags: ['STACK', 'SUSTAIN'], requires: ['STACK', 'SUSTAIN', 'SURVIVAL'], baseWeight: 1,
    guard: { appliesTo: 'ANY' }, fit: { phases: ['LATE'] },
    effects: [],
    resource: {
      kind: 'STAMINA', max: 6, gainPerSeconds: 5, payoutPhase: 'LATE', label: '지구력',
      perStack: [add('armor', 3), add('magicResist', 3)],
    },
  },
  {
    id: 'EV_STAMINA_CONVERT', kind: 'EVOLUTION', nameKo: '지구력 전환',
    descriptionKo: '남은 지구력을 화력으로 바꿉니다.',
    majorTag: 'STACK', tags: ['STACK', 'SUSTAIN', 'MORE_LATE'], requires: ['STACK', 'SUSTAIN', 'MORE_LATE'], baseWeight: 1,
    guard: { appliesTo: 'ANY' }, fit: { phases: ['LATE', 'LAST_3F'] },
    effects: [],
    resource: {
      kind: 'STAMINA', max: 6, gainPerSeconds: 5, payoutPhase: 'LATE', consume: true, label: '지구력',
      perStack: [add('attackDamage', 7), add('abilityPower', 7)],
    },
  },
  {
    id: 'EV_TRACK_ADAPT', kind: 'EVOLUTION', nameKo: '마장 적응',
    descriptionKo: '그날의 마장에 맞춰 총량은 같게, 방향만 바꿉니다.',
    majorTag: 'STACK', tags: ['STACK', 'SURVIVAL', 'MORE_EARLY'], requires: [
      'STACK', 'SURVIVAL', 'MORE_EARLY', 'MORE_LATE', 'BASIC_ATTACK', 'CAST',
      'POSITION', 'PENETRATION', 'SUSTAIN', 'TEAM_SUPPORT', 'EXECUTE', 'RESET',
    ], baseWeight: 0.95,
    guard: { appliesTo: 'ANY' }, fit: { phases: ['START', 'POSITIONING', 'LATE'] },
    effects: [],
  },
  {
    id: 'EV_COURSE_SENSE', kind: 'EVOLUTION', nameKo: '코스 감각',
    descriptionKo: '익숙한 코스에서 한 발 앞서 움직입니다.',
    majorTag: 'POSITION', tags: ['POSITION', 'MORE_LATE'], requires: [
      'STACK', 'SURVIVAL', 'MORE_EARLY', 'MORE_LATE', 'BASIC_ATTACK', 'CAST',
      'POSITION', 'PENETRATION', 'SUSTAIN', 'TEAM_SUPPORT', 'EXECUTE', 'RESET',
    ], baseWeight: 0.95,
    guard: { appliesTo: 'ANY' }, fit: { aptitudeAxes: ['surfacePct.turf'], phases: ['LATE'] },
    // The course bonus is capped at 5% on purpose: a real-world course record is
    // flavour, never a power source.
    effects: [
      mul('attackDamage', 0.05, { trigger: atPhase('LATE') }),
      mul('abilityPower', 0.05, { trigger: atPhase('LATE') }),
    ],
  },
];
