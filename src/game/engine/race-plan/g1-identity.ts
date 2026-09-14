/**
 * What each GⅠ actually feels like to race.
 *
 * One GⅠ is drawn per lobby and every player is entered for it, so the theme
 * was the most visible part of the system and the least consequential: a name
 * and a distance printed on a header. Now it carries a *과제* — a condition
 * every board on the board is racing under for the whole match.
 *
 * The identity is derived from the race's own shape rather than hand-written
 * 46 times, because the shape is what makes a race what it is: a 1200m sprint
 * down Nakayama's short straight is a different race from 3200m at Flemington
 * for reasons that are already in the data. Six templates cover the calendar,
 * and the handful of races with a character of their own override it.
 */
import type { EffectDef } from '../types';
import type { G1Theme, RaceCombatPhase } from './types';

export type G1Identity = {
  /** The 과제's name, shown next to the race on every race-plan screen. */
  nameKo: string;
  /** One line saying what this race asks of a board. */
  noteKo: string;
  /** Applied to every unit on both sides for the whole match. */
  effects: EffectDef[];
  /** Phases this race rewards; the offer scorer reads it. */
  favours: RaceCombatPhase[];
};

const inPhase = (phases: RaceCombatPhase[]) => ({ when: 'IN_RACE_PHASE' as const, phases });
const atStart = { when: 'COMBAT_START' as const };

/**
 * The six shapes.
 *
 * `SPRINT` and `LONG` are the two extremes and get the sharpest identities;
 * `DIRT` cuts across distance because the surface changes the race more than
 * the trip does; `SHORT_STRAIGHT` and `LONG_STRAIGHT` split the middle-distance
 * turf races by the only thing that separates them, which is how much room a
 * closer is given once it turns in.
 */
const SHAPES: Record<string, G1Identity> = {
  SPRINT: {
    nameKo: '단거리 결전',
    noteKo: '1200m 전후의 짧은 승부입니다. 발주가 곧 승부라 초반에 실린 힘이 그대로 결과가 됩니다.',
    favours: ['START', 'POSITIONING'],
    effects: [
      { kind: 'STAT_MUL', stat: 'attackSpeed', value: 0.1, trigger: atStart },
      { kind: 'DAMAGE_AMP', value: 0.08, trigger: inPhase(['START', 'POSITIONING']) },
      { kind: 'DAMAGE_AMP', value: -0.04, trigger: inPhase(['LAST_3F', 'OVERTIME']) },
    ],
  },
  LONG: {
    nameKo: '장거리 시련',
    noteKo: '3000m를 넘는 긴 여정입니다. 초반에는 아무 일도 일어나지 않고, 끝까지 남은 말만 상을 받습니다.',
    favours: ['LAST_3F', 'OVERTIME'],
    effects: [
      { kind: 'STAT_MUL', stat: 'hp', value: 0.08, trigger: atStart },
      { kind: 'DAMAGE_AMP', value: -0.06, trigger: inPhase(['START', 'POSITIONING']) },
      { kind: 'DAMAGE_AMP', value: 0.16, trigger: inPhase(['LAST_3F', 'OVERTIME']) },
      { kind: 'HEAL_MAXHP_PCT', value: 0.03, target: 'SELF', trigger: { when: 'EVERY_SECONDS', threshold: 7 } },
    ],
  },
  DIRT: {
    nameKo: '더트 혈전',
    noteKo: '모래를 뒤집어쓰며 밀고 들어가는 경주입니다. 스킬보다 몸으로 부딪치는 쪽이 셉니다.',
    favours: ['POSITIONING', 'LATE'],
    effects: [
      { kind: 'STAT_MUL', stat: 'attackDamage', value: 0.09, trigger: atStart },
      { kind: 'SKILL_DAMAGE_AMP', value: -0.05, trigger: atStart },
      { kind: 'DAMAGE_REDUCTION', value: 0.05, trigger: atStart },
    ],
  },
  SHORT_STRAIGHT: {
    nameKo: '급승부 코스',
    noteKo: '직선이 짧아 4코너를 돌자마자 승부가 납니다. 자리를 잡고 있던 쪽이 가져갑니다.',
    favours: ['LATE'],
    effects: [
      { kind: 'DAMAGE_AMP', value: 0.12, trigger: inPhase(['LATE']) },
      { kind: 'MANA_ADD', value: 20, oncePerCombat: true, trigger: { when: 'ON_RACE_PHASE', phase: 'LATE' } },
    ],
  },
  LONG_STRAIGHT: {
    nameKo: '대직선 코스',
    noteKo: '직선이 길어 뒤에서 오는 말에게도 충분한 시간이 있습니다. 마지막까지 뒤집힙니다.',
    favours: ['LAST_3F'],
    effects: [
      { kind: 'DAMAGE_AMP', value: 0.13, trigger: inPhase(['LAST_3F', 'OVERTIME']) },
      { kind: 'STAT_MUL', stat: 'moveSpeedHexPerSec', value: 0.12, trigger: atStart },
    ],
  },
  CLASSIC: {
    nameKo: '정통 중거리',
    noteKo: '어느 각질에게도 기회가 열려 있는 균형 잡힌 조건입니다. 보드가 가진 힘이 그대로 나옵니다.',
    favours: ['POSITIONING', 'LATE'],
    effects: [
      { kind: 'STAT_MUL', stat: 'abilityPower', value: 0.05, trigger: atStart },
      { kind: 'STAT_MUL', stat: 'attackDamage', value: 0.05, trigger: atStart },
    ],
  },
};

/**
 * The races with a character the shape cannot capture.
 *
 * Each of these is remembered for one specific thing, and that thing is what
 * the entry is built around: 아리마기념 for its winter grind, 개선문상 for the
 * bog at Longchamp, 다카라즈카기념 for a summer field that arrives half-spent.
 */
const OVERRIDES: Record<string, G1Identity> = {
  ARIMA: {
    nameKo: '겨울의 그랑프리',
    noteKo: '한 해의 마지막, 모두가 지친 채로 모입니다. 아무도 온전하지 않고, 끝까지 서 있는 쪽이 이깁니다.',
    favours: ['LAST_3F', 'OVERTIME'],
    effects: [
      { kind: 'STAT_MUL', stat: 'hp', value: -0.05, trigger: atStart },
      { kind: 'DAMAGE_AMP', value: 0.1, trigger: inPhase(['LATE', 'LAST_3F', 'OVERTIME']) },
      // The grind pays whoever is still upright: the further into the red, the harder it hits.
      { kind: 'DAMAGE_AMP', value: 0.14, scaleBy: 'SELF_MISSING_HP_PCT', trigger: inPhase(['LAST_3F', 'OVERTIME']) },
    ],
  },
  ARC: {
    nameKo: '개선문의 진창',
    noteKo: '가을비에 젖은 롱샹입니다. 시계는 늦고 발은 무겁습니다. 힘으로 밀어붙이는 말만 남습니다.',
    favours: ['LATE', 'LAST_3F'],
    effects: [
      { kind: 'STAT_MUL', stat: 'attackSpeed', value: -0.1, trigger: atStart },
      { kind: 'STAT_MUL', stat: 'attackDamage', value: 0.12, trigger: atStart },
      { kind: 'STAT_MUL', stat: 'abilityPower', value: 0.12, trigger: atStart },
      { kind: 'DAMAGE_REDUCTION', value: 0.06, trigger: atStart },
    ],
  },
  TAKARAZUKA: {
    nameKo: '한여름의 그랑프리',
    noteKo: '더위에 모두가 숨이 찹니다. 기력은 잘 돌지 않지만, 한 번 터지면 크게 터집니다.',
    favours: ['LATE'],
    effects: [
      { kind: 'MANA_ADD', value: -3, trigger: { when: 'EVERY_SECONDS', threshold: 5 } },
      { kind: 'SKILL_DAMAGE_AMP', value: 0.16, trigger: atStart },
    ],
  },
  TENNO_SPRING: {
    nameKo: '최장거리의 권위',
    noteKo: '3200m, 한 해에 한 번뿐인 거리입니다. 절반이 지나기 전에는 아무것도 정해지지 않습니다.',
    favours: ['LAST_3F', 'OVERTIME'],
    effects: [
      { kind: 'STAT_MUL', stat: 'hp', value: 0.12, trigger: atStart },
      { kind: 'DAMAGE_AMP', value: -0.1, trigger: inPhase(['START', 'POSITIONING']) },
      { kind: 'DAMAGE_AMP', value: 0.22, trigger: inPhase(['LAST_3F', 'OVERTIME']) },
    ],
  },
  DERBY: {
    nameKo: '세대의 정점',
    noteKo: '한 세대에 단 한 번뿐인 경주입니다. 모두가 가진 것을 전부 내놓고 달립니다.',
    favours: ['LATE', 'LAST_3F'],
    effects: [
      { kind: 'STAT_MUL', stat: 'attackDamage', value: 0.07, trigger: atStart },
      { kind: 'STAT_MUL', stat: 'abilityPower', value: 0.07, trigger: atStart },
      { kind: 'DAMAGE_REDUCTION', value: -0.04, trigger: atStart },
      { kind: 'MANA_FILL', value: 0.5, oncePerCombat: true, trigger: { when: 'ON_RACE_PHASE', phase: 'LATE' } },
    ],
  },
  JAPAN_CUP: {
    nameKo: '국제 초청',
    noteKo: '세계에서 모여든 상대입니다. 상대가 많이 남아 있는 동안에는 누구도 쉽게 빠져나오지 못합니다.',
    favours: ['LAST_3F'],
    effects: [
      { kind: 'DAMAGE_AMP', value: 0.045, scaleBy: 'ENEMIES_DEAD', scaleCap: 5, trigger: atStart },
      { kind: 'STAT_MUL', stat: 'armor', value: 0.08, trigger: atStart },
      { kind: 'STAT_MUL', stat: 'magicResist', value: 0.08, trigger: atStart },
    ],
  },
  DUBAI_WORLD_CUP: {
    nameKo: '야간 조명 아래',
    noteKo: '조명 아래 모래를 밟고 달립니다. 눈이 부셔 멀리는 잘 보이지 않고, 붙어 있는 쪽이 셉니다.',
    favours: ['POSITIONING', 'LATE'],
    effects: [
      { kind: 'DAMAGE_AMP', value: 0.09, tag: 'MELEE_ONLY', trigger: atStart },
      { kind: 'CRIT_CHANCE_ADD', value: 0.1, trigger: atStart },
      { kind: 'STAT_MUL', stat: 'attackDamage', value: 0.06, trigger: atStart },
    ],
  },
  MELBOURNE_CUP: {
    nameKo: '나라를 멈추는 경주',
    noteKo: '3200m에 스무 마리 넘게 나섭니다. 대열이 풀리기 전에는 누구도 제 힘을 못 씁니다.',
    favours: ['LAST_3F', 'OVERTIME'],
    effects: [
      { kind: 'DAMAGE_AMP', value: -0.025, scaleBy: 'ENEMIES_ALIVE', scaleCap: 6, trigger: atStart },
      { kind: 'DAMAGE_AMP', value: 0.2, trigger: inPhase(['LAST_3F', 'OVERTIME']) },
      { kind: 'STAT_MUL', stat: 'hp', value: 0.1, trigger: atStart },
    ],
  },
  NAKAYAMA_GRAND_JUMP: {
    nameKo: '장애 대비',
    noteKo: '4250m에 장애물이 놓입니다. 한 번씩 크게 넘어야 해서 흐름이 계속 끊기고, 끊길 때마다 다시 붙습니다.',
    favours: ['POSITIONING', 'LATE'],
    effects: [
      { kind: 'STAT_MUL', stat: 'attackSpeed', value: -0.12, trigger: atStart },
      { kind: 'STAT_MUL', stat: 'hp', value: 0.14, trigger: atStart },
      { kind: 'CC_RESIST', value: 0.25, trigger: atStart },
      // Each fence is a reset: the field re-forms and everyone gets another run at it.
      { kind: 'MANA_FILL', value: 0.7, oncePerCombat: true, trigger: { when: 'ON_RACE_PHASE', phase: 'POSITIONING' } },
      { kind: 'MANA_FILL', value: 0.7, oncePerCombat: true, trigger: { when: 'ON_RACE_PHASE', phase: 'LATE' } },
    ],
  },
  NAKAYAMA_DAISHOGAI: {
    nameKo: '대장애의 겨울',
    noteKo: '한 해에 두 번뿐인 대장애입니다. 넘다 무너지는 말이 나오고, 무너진 자리를 밟고 가는 말이 상을 받습니다.',
    favours: ['LATE', 'LAST_3F'],
    effects: [
      { kind: 'STAT_MUL', stat: 'hp', value: 0.12, trigger: atStart },
      { kind: 'DAMAGE_AMP', value: 0.06, scaleBy: 'ENEMIES_DEAD', scaleCap: 4, trigger: atStart },
      { kind: 'SURVIVE_LETHAL', value: 0.18, oncePerCombat: true, trigger: atStart },
    ],
  },
};

/** Long enough that a closer has room; Tokyo's 525m is the benchmark. */
const LONG_STRAIGHT_M = 460;
const SHORT_STRAIGHT_M = 330;

/** The 과제 this GⅠ sets, from its own shape unless it has a character of its own. */
export function g1Identity(theme: G1Theme): G1Identity {
  const named = OVERRIDES[theme.id];
  if (named) return named;
  if (theme.distanceClass === 'SPRINT') return SHAPES.SPRINT;
  if (theme.distanceClass === 'LONG') return SHAPES.LONG;
  if (theme.surface === 'DIRT') return SHAPES.DIRT;
  const straight = theme.straightM ?? 400;
  if (straight >= LONG_STRAIGHT_M) return SHAPES.LONG_STRAIGHT;
  if (straight <= SHORT_STRAIGHT_M) return SHAPES.SHORT_STRAIGHT;
  return SHAPES.CLASSIC;
}

export const G1_SHAPES = SHAPES;
export const G1_OVERRIDES = OVERRIDES;
