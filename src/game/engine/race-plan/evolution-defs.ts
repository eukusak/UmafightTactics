/**
 * The stage-3 evolutions.
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
const atPhase = (phase: 'LATE' | 'LAST_3F' | 'POSITIONING' | 'OVERTIME', extra: Partial<EffectDef['trigger']> = {}) =>
  ({ when: 'ON_RACE_PHASE' as const, phase, ...extra });

export const RACE_EVOLUTION_DEFS: RacePlanNode[] = [
  {
    id: 'EV_EARLY_OVERPACE', kind: 'EVOLUTION', nameKo: '오버페이스',
    descriptionKo: '발주에 더 밀어붙이는 대신 4코너에서 숨이 찹니다.',
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
    descriptionKo: '중반 내내 스킬을 더 자주 돌립니다.',
    majorTag: 'CAST', tags: ['CAST'], requires: ['CAST', 'STACK', 'MORE_LATE'], baseWeight: 1,
    guard: { appliesTo: 'ANY', roles: ['AP_CARRY', 'SUPPORT', 'BRUISER'] }, fit: { phases: ['POSITIONING'] },
    effects: [{ kind: 'MANA_ADD', value: 5, trigger: { when: 'ON_CAST' } }],
  },
  {
    id: 'EV_MID_SECOND_WIND', kind: 'EVOLUTION', nameKo: '두 번째 호흡',
    descriptionKo: '중반에 한 번 숨을 고릅니다.',
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
    descriptionKo: '4코너 전까지 아끼고 그 뒤에 몰아 씁니다.',
    majorTag: 'MORE_LATE', tags: ['MORE_LATE', 'STACK'], requires: ['MORE_LATE', 'STACK', 'SUSTAIN'], baseWeight: 1,
    guard: { appliesTo: 'ANY' }, fit: { phases: ['LATE', 'LAST_3F'] },
    effects: [
      mul('attackSpeed', -0.04, { trigger: { when: 'COMBAT_START' } }),
      mul('attackSpeed', 0.22, { trigger: atPhase('LATE') }),
    ],
  },
  {
    id: 'EV_LATE_LONG_SPURT', kind: 'EVOLUTION', nameKo: '롱 스퍼트',
    descriptionKo: '4코너부터 마지막까지 계속 뻗어 나갑니다.',
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

  // ------------------------------------------------ additions for this patch
  // These lean on the new primitives: an evolution that buys a whole extra
  // release, one that trades a stat away, and several that read the field.
  {
    id: 'EV_ENCORE_CORNER', kind: 'EVOLUTION', nameKo: '재각',
    descriptionKo: '4코너를 돌면서 승부수가 한 번 더 나갑니다.',
    majorTag: 'CAST', tags: ['CAST', 'MORE_LATE'], requires: ['CAST', 'MORE_LATE', 'RESET'], baseWeight: 0.85,
    guard: { appliesTo: 'ANY', roles: ['AP_CARRY', 'AD_CARRY', 'BRUISER', 'SUPPORT'] },
    fit: { phases: ['LATE'] },
    effects: [
      { kind: 'RECAST_SKILL', oncePerCombat: true, trigger: atPhase('LATE') },
      { kind: 'SKILL_DAMAGE_AMP', value: 0.12, trigger: { when: 'IN_RACE_PHASE', phases: ['LATE', 'LAST_3F', 'OVERTIME'] } },
    ],
  },
  {
    id: 'EV_SPEND_GUTS', kind: 'EVOLUTION', nameKo: '근성 환산',
    descriptionKo: '최종 직선에서 남은 방어를 전부 힘으로 바꿉니다.',
    majorTag: 'EXECUTE', tags: ['EXECUTE', 'MORE_LATE'], requires: ['EXECUTE', 'MORE_LATE', 'SURVIVAL'], baseWeight: 0.9,
    guard: { appliesTo: 'ANY' }, fit: { phases: ['LAST_3F'] },
    effects: [
      { kind: 'CONVERT_STAT', stat: 'abilityPower', tag: 'magicResist', value: 0.6, duration: 999,
        scaling: { cap: 2.2 }, oncePerCombat: true, trigger: atPhase('LAST_3F') },
    ],
  },
  {
    id: 'EV_FIELD_READ', kind: 'EVOLUTION', nameKo: '마군 읽기',
    descriptionKo: '앞이 정리될수록 잘 뻗습니다.',
    majorTag: 'STACK', tags: ['STACK', 'MORE_LATE'], requires: ['STACK', 'MORE_LATE', 'EXECUTE'], baseWeight: 1,
    guard: { appliesTo: 'ANY' }, fit: { phases: ['LATE', 'LAST_3F'] },
    effects: [
      { kind: 'DAMAGE_AMP', value: 0.032, scaleBy: 'ENEMIES_DEAD', scaleCap: 5,
        trigger: { when: 'IN_RACE_PHASE', phases: ['LATE', 'LAST_3F', 'OVERTIME'] } },
    ],
  },
  {
    id: 'EV_DEEP_BREATH', kind: 'EVOLUTION', nameKo: '깊은 호흡',
    descriptionKo: '최종 직선에 들어서는 순간 기력이 가득 찹니다.',
    majorTag: 'CAST', tags: ['CAST', 'RESET'], requires: ['CAST', 'RESET', 'MORE_LATE'], baseWeight: 0.95,
    guard: { appliesTo: 'ANY' }, fit: { phases: ['LAST_3F'] },
    effects: [{ kind: 'MANA_FILL', value: 1, oncePerCombat: true, trigger: atPhase('LAST_3F') }],
  },
  {
    id: 'EV_WIND_SHADOW', kind: 'EVOLUTION', nameKo: '바람 그늘',
    descriptionKo: '뒷줄에 서 있는 동안에는 훨씬 덜 다칩니다.',
    majorTag: 'POSITION', tags: ['POSITION', 'SURVIVAL'], requires: ['POSITION', 'SURVIVAL', 'MORE_LATE'], baseWeight: 1,
    guard: { appliesTo: 'RANGED' }, fit: { phases: ['START', 'POSITIONING'] },
    effects: [{ kind: 'DAMAGE_REDUCTION', value: 0.11, trigger: { when: 'IN_BACK_ROWS' } }],
  },
  {
    id: 'EV_RAIL_RIDE', kind: 'EVOLUTION', nameKo: '내곽 주파',
    descriptionKo: '앞줄에서 안쪽을 파고들며 거리를 아낍니다.',
    majorTag: 'POSITION', tags: ['POSITION', 'BASIC_ATTACK'], requires: ['POSITION', 'BASIC_ATTACK', 'MORE_EARLY'], baseWeight: 1,
    guard: { appliesTo: 'MELEE' }, fit: { phases: ['START', 'POSITIONING'] },
    effects: [
      mul('attackSpeed', 0.1, { trigger: { when: 'IN_FRONT_ROWS' } }),
      { kind: 'DAMAGE_REDUCTION', value: 0.06, trigger: { when: 'IN_FRONT_ROWS' } },
    ],
  },
  {
    id: 'EV_TARGET_SWITCH', kind: 'EVOLUTION', nameKo: '진로 변경',
    descriptionKo: '상대를 바꿔 잡을 때마다 한 번 더 탄력이 붙습니다.',
    majorTag: 'RESET', tags: ['RESET', 'BASIC_ATTACK'], requires: ['RESET', 'BASIC_ATTACK', 'PENETRATION'], baseWeight: 1,
    guard: { appliesTo: 'ANY' }, fit: { phases: ['POSITIONING', 'LATE'] },
    effects: [
      mul('attackSpeed', 0.16, { duration: 3, refresh: true, trigger: { when: 'ON_TARGET_CHANGED' } }),
    ],
  },
  {
    id: 'EV_SPENT_LEGS', kind: 'EVOLUTION', nameKo: '다리가 남았다',
    descriptionKo: '체력을 잃을수록 세게 때립니다.',
    majorTag: 'EXECUTE', tags: ['EXECUTE', 'SURVIVAL'], requires: ['EXECUTE', 'SURVIVAL', 'SUSTAIN'], baseWeight: 1,
    guard: { appliesTo: 'ANY' }, fit: { phases: ['LATE', 'LAST_3F'] },
    effects: [{ kind: 'DAMAGE_AMP', value: 0.24, scaleBy: 'SELF_MISSING_HP_PCT', trigger: { when: 'COMBAT_START' } }],
  },
  {
    id: 'EV_PACE_UP', kind: 'EVOLUTION', nameKo: '페이스 업',
    descriptionKo: '경주가 길어질수록 조금씩 더 빨라집니다.',
    majorTag: 'STACK', tags: ['STACK', 'BASIC_ATTACK'], requires: ['STACK', 'BASIC_ATTACK', 'MORE_LATE'], baseWeight: 1,
    guard: { appliesTo: 'ANY' }, fit: { phases: ['POSITIONING', 'LATE'] },
    effects: [
      { kind: 'DAMAGE_AMP', value: 0.11, scaleBy: 'RACE_PROGRESS',
        trigger: { when: 'IN_RACE_PHASE', phases: ['POSITIONING', 'LATE', 'LAST_3F', 'OVERTIME'] } },
    ],
  },
  {
    id: 'EV_TEAM_SLIPSTREAM', kind: 'EVOLUTION', nameKo: '대열 정비',
    descriptionKo: '옆에 붙어 달리는 동료가 있을 때 둘 다 편해집니다.',
    majorTag: 'TEAM_SUPPORT', tags: ['TEAM_SUPPORT', 'POSITION'], requires: ['TEAM_SUPPORT', 'POSITION', 'SURVIVAL'], baseWeight: 1,
    guard: { appliesTo: 'ANY', needsAdjacentAlly: true }, fit: { phases: ['POSITIONING'] },
    effects: [
      { kind: 'DAMAGE_REDUCTION', value: 0.08, trigger: { when: 'ADJACENT_ALLIES_AT_LEAST', threshold: 1 } },
      { kind: 'DAMAGE_AMP', value: 0.07, trigger: { when: 'ADJACENT_ALLIES_AT_LEAST', threshold: 2 } },
    ],
  },
  {
    id: 'EV_LONE_RUN', kind: 'EVOLUTION', nameKo: '홀로 앞서기',
    descriptionKo: '옆에 아무도 없을 때 가장 잘 달립니다.',
    majorTag: 'POSITION', tags: ['POSITION', 'MORE_EARLY'], requires: ['POSITION', 'MORE_EARLY', 'BASIC_ATTACK'], baseWeight: 1,
    guard: { appliesTo: 'ANY' }, fit: { phases: ['START', 'POSITIONING'] },
    effects: [
      { kind: 'DAMAGE_AMP', value: 0.13, trigger: { when: 'NO_ADJACENT_ALLIES' } },
      mul('moveSpeedHexPerSec', 0.15, { trigger: { when: 'NO_ADJACENT_ALLIES' } }),
    ],
  },
  {
    id: 'EV_MUDDER', kind: 'EVOLUTION', nameKo: '진창 특기',
    descriptionKo: '무거운 마장에서도 흔들리지 않고 계속 회복합니다.',
    majorTag: 'SUSTAIN', tags: ['SUSTAIN', 'SURVIVAL'], requires: ['SUSTAIN', 'SURVIVAL', 'STACK'], baseWeight: 1,
    guard: { appliesTo: 'ANY' }, fit: { surfaces: ['dirt'], phases: ['POSITIONING', 'LATE'] },
    effects: [
      { kind: 'CC_RESIST', value: 0.3, trigger: { when: 'COMBAT_START' } },
      { kind: 'HEAL_MAXHP_PCT', value: 0.035, target: 'SELF', trigger: { when: 'EVERY_SECONDS', threshold: 5 } },
    ],
  },
  {
    id: 'EV_LATE_SURGE', kind: 'EVOLUTION', nameKo: '막판 가속',
    descriptionKo: '최종 직선에서 남은 상대 수만큼 발이 빨라집니다.',
    majorTag: 'MORE_LATE', tags: ['MORE_LATE', 'BASIC_ATTACK'], requires: ['MORE_LATE', 'BASIC_ATTACK', 'EXECUTE'], baseWeight: 1,
    guard: { appliesTo: 'ANY' }, fit: { phases: ['LAST_3F'] },
    effects: [
      { kind: 'STAT_MUL', stat: 'attackSpeed', value: 0.055, scaleBy: 'ENEMIES_ALIVE', scaleCap: 6,
        duration: 999, oncePerCombat: true, trigger: atPhase('LAST_3F') },
    ],
  },
  {
    id: 'EV_HARD_MOUTH', kind: 'EVOLUTION', nameKo: '고집',
    descriptionKo: '한 상대를 계속 잡고 있을수록 방어를 더 벗겨냅니다.',
    majorTag: 'PENETRATION', tags: ['PENETRATION', 'STACK'], requires: ['PENETRATION', 'STACK', 'BASIC_ATTACK'], baseWeight: 1,
    guard: { appliesTo: 'ANY' }, fit: { phases: ['POSITIONING', 'LATE'] },
    effects: [
      { kind: 'SUNDER_ARMOR_PCT', value: 0.08, duration: 5, refresh: true,
        trigger: { when: 'ON_SAME_TARGET_NTH_ATTACK', threshold: 3 } },
    ],
  },
  {
    id: 'EV_PHOTO_FINISH', kind: 'EVOLUTION', nameKo: '결승선까지 버티기',
    descriptionKo: '결승선 접전까지 가면 한 번은 쓰러지지 않고 버팁니다.',
    majorTag: 'SURVIVAL', tags: ['SURVIVAL', 'MORE_LATE'], requires: ['SURVIVAL', 'MORE_LATE', 'SUSTAIN'], baseWeight: 0.9,
    guard: { appliesTo: 'ANY' }, fit: { phases: ['LAST_3F', 'OVERTIME'] },
    effects: [
      { kind: 'SURVIVE_LETHAL', value: 0.25, oncePerCombat: true, trigger: atPhase('LAST_3F') },
    ],
  },
  {
    id: 'EV_ROUGH_RIDE', kind: 'EVOLUTION', nameKo: '몸싸움',
    descriptionKo: '붙어서 부딪칠수록 강해집니다. 맞을 때마다 조금씩 단단해집니다.',
    majorTag: 'SURVIVAL', tags: ['SURVIVAL', 'STACK'], requires: ['SURVIVAL', 'STACK', 'TEAM_SUPPORT'], baseWeight: 1,
    guard: { appliesTo: 'MELEE' }, fit: { phases: ['POSITIONING', 'LATE'] },
    effects: [
      { kind: 'STACKING_STAT', stat: 'armor', value: 3, maxStacks: 12, tag: 'FLAT', trigger: { when: 'ON_HIT_TAKEN' } },
      { kind: 'STACKING_STAT', stat: 'magicResist', value: 3, maxStacks: 12, tag: 'FLAT', trigger: { when: 'ON_HIT_TAKEN' } },
    ],
  },
];
