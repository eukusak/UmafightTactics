/**
 * 레이스 컨디션 — the ground everyone races on, rolled fresh each round.
 *
 * The going used to be a footnote: three values that only two plan cards ever
 * read. That is backwards for a system built around horse racing, where the
 * condition of the track is the first thing anyone checks and routinely decides
 * the race before it is run. So the condition is now a property of the round
 * itself, applied to every unit on both sides, and it is built out of four
 * independent axes that each do a visibly different job:
 *
 *  - **마장 (going)** — how much the ground gives. Four states, and it taxes
 *    speed or rewards staying power. Everyone feels this one.
 *  - **페이스 (pace)** — how hard the race is run. This is the axis that matters
 *    most, because it does not add a number: it *bends the 각질 curve itself*.
 *    A 하이페이스 burns the front-runners out and hands the race to the closers;
 *    a 슬로우페이스 lets the leaders steal it. This is the single biggest
 *    interaction in real racing and it is now the single biggest one here.
 *  - **날씨 (weather)** — one distinctive effect each, and the place where the
 *    odd, memorable conditions live.
 *  - **개최 특례 (special clause)** — a rare extra clause, roughly one round in
 *    three, that changes a rule rather than a number.
 *
 * Every axis is rolled from the round's own deterministic stream and is shared
 * by the whole lobby, so both sides of every fight race identical ground.
 */
import type { Rng } from '../rng';
import type { EffectDef, RunStyle } from '../types';
import type { RaceCombatPhase } from './types';

// --------------------------------------------------------------------- going

export type Going = 'FIRM' | 'GOOD' | 'YIELDING' | 'SOFT';

export type GoingDef = {
  id: Going;
  nameKo: string;
  /** What a player should take away in one line. */
  noteKo: string;
  weight: number;
  effects: EffectDef[];
};

export const GOING_DEFS: GoingDef[] = [
  {
    id: 'FIRM', nameKo: '양호', weight: 30,
    noteKo: '땅이 단단해 시계가 빠릅니다. 모두 발이 가볍습니다.',
    effects: [
      { kind: 'STAT_MUL', stat: 'attackSpeed', value: 0.08, trigger: { when: 'COMBAT_START' } },
      { kind: 'STAT_MUL', stat: 'moveSpeedHexPerSec', value: 0.1, trigger: { when: 'COMBAT_START' } },
    ],
  },
  {
    id: 'GOOD', nameKo: '약간 습윤', weight: 32,
    noteKo: '적당히 물기가 있어 힘 있는 말이 조금 유리합니다.',
    effects: [
      { kind: 'STAT_MUL', stat: 'attackDamage', value: 0.05, trigger: { when: 'COMBAT_START' } },
      { kind: 'STAT_MUL', stat: 'abilityPower', value: 0.05, trigger: { when: 'COMBAT_START' } },
    ],
  },
  {
    id: 'YIELDING', nameKo: '습윤', weight: 23,
    noteKo: '발이 무거워 시계가 늦습니다. 대신 맞아도 덜 밀립니다.',
    effects: [
      { kind: 'STAT_MUL', stat: 'attackSpeed', value: -0.06, trigger: { when: 'COMBAT_START' } },
      { kind: 'DAMAGE_REDUCTION', value: 0.05, trigger: { when: 'COMBAT_START' } },
    ],
  },
  {
    id: 'SOFT', nameKo: '불량', weight: 15,
    noteKo: '진창입니다. 시계는 크게 늦어지고, 버티는 말만 남습니다.',
    effects: [
      { kind: 'STAT_MUL', stat: 'attackSpeed', value: -0.11, trigger: { when: 'COMBAT_START' } },
      { kind: 'DAMAGE_REDUCTION', value: 0.09, trigger: { when: 'COMBAT_START' } },
      { kind: 'HEAL_MAXHP_PCT', value: 0.03, target: 'SELF', trigger: { when: 'EVERY_SECONDS', threshold: 6 } },
    ],
  },
];

// ---------------------------------------------------------------------- pace

export type Pace = 'HIGH' | 'MIDDLE' | 'SLOW';

/**
 * How hard a pace pulls each style's curve.
 *
 * A value of 1 leaves the style's own curve alone. Above 1 the style's *whole*
 * curve is amplified, below 1 it is flattened toward nothing — so a 하이페이스
 * does not merely nerf 도주, it takes away the early lead that the style's
 * entire game plan is built on, while making the closers' late payout bigger
 * than they could ever buy themselves.
 */
export type PaceDef = {
  id: Pace;
  nameKo: string;
  noteKo: string;
  weight: number;
  /** Per-style multiplier on the 각질 curve. */
  styleScale: Record<RunStyle, number>;
  /** Extra effects for everyone, on top of the curve bend. */
  effects: EffectDef[];
};

export const PACE_DEFS: PaceDef[] = [
  {
    id: 'HIGH', nameKo: '하이페이스', weight: 27,
    noteKo: '앞이 무리하게 끌고 갑니다. 도주는 직선에서 무너지고, 뒤에서 오는 말이 살아납니다.',
    styleScale: { nige: 0.55, senko: 0.9, sashi: 1.25, oikomi: 1.45 },
    // A hard pace burns everyone: the whole field takes more and gives more.
    effects: [
      { kind: 'STAT_MUL', stat: 'attackSpeed', value: 0.07, trigger: { when: 'COMBAT_START' } },
      { kind: 'DAMAGE_AMP', value: 0.04, trigger: { when: 'IN_RACE_PHASE', phases: ['LAST_3F', 'OVERTIME'] } },
    ],
  },
  {
    id: 'MIDDLE', nameKo: '미들페이스', weight: 44,
    noteKo: '무리 없는 흐름입니다. 각질이 제 값대로 나옵니다.',
    styleScale: { nige: 1, senko: 1, sashi: 1, oikomi: 1 },
    effects: [],
  },
  {
    id: 'SLOW', nameKo: '슬로우페이스', weight: 29,
    noteKo: '아무도 가지 않아 대열이 뭉칩니다. 앞에 선 말이 그대로 끌고 들어갑니다.',
    styleScale: { nige: 1.45, senko: 1.2, sashi: 0.85, oikomi: 0.6 },
    // Nobody committed, so the whole field arrives at the corner with legs left:
    // the straight becomes a sprint everyone contests at once.
    effects: [
      { kind: 'MANA_ADD', value: 15, trigger: { when: 'ON_RACE_PHASE', phase: 'LATE' } },
      { kind: 'DAMAGE_REDUCTION', value: 0.04, trigger: { when: 'IN_RACE_PHASE', phases: ['START', 'POSITIONING'] } },
    ],
  },
];

// ------------------------------------------------------------------- weather

export type Weather = 'CLEAR' | 'CLOUDY' | 'RAIN' | 'SNOW' | 'GALE';

export type WeatherDef = {
  id: Weather;
  nameKo: string;
  noteKo: string;
  weight: number;
  /** Going states this weather can appear with. Rain never falls on firm ground. */
  goings: Going[];
  effects: EffectDef[];
};

export const WEATHER_DEFS: WeatherDef[] = [
  {
    id: 'CLEAR', nameKo: '맑음', weight: 38, goings: ['FIRM', 'GOOD'],
    noteKo: '시야가 트여 앞이 훤히 보입니다. 승부수가 더 날카롭게 들어갑니다.',
    effects: [{ kind: 'SKILL_DAMAGE_AMP', value: 0.05, trigger: { when: 'COMBAT_START' } }],
  },
  {
    id: 'CLOUDY', nameKo: '흐림', weight: 30, goings: ['FIRM', 'GOOD', 'YIELDING'],
    noteKo: '해가 없어 서늘합니다. 숨이 덜 차 기력이 꾸준히 돕니다.',
    effects: [{ kind: 'MANA_ADD', value: 4, trigger: { when: 'EVERY_SECONDS', threshold: 5 } }],
  },
  {
    id: 'RAIN', nameKo: '비', weight: 22, goings: ['YIELDING', 'SOFT'],
    noteKo: '빗발에 앞이 흐립니다. 멀리 있는 상대는 잘 보이지 않고, 붙어 있는 쪽이 편합니다.',
    // A genuine rule bend rather than a number: range is worth less in the wet.
    effects: [
      { kind: 'DAMAGE_AMP', value: 0.07, tag: 'MELEE_ONLY', trigger: { when: 'COMBAT_START' } },
      { kind: 'DAMAGE_AMP', value: -0.05, tag: 'RANGED_ONLY', trigger: { when: 'COMBAT_START' } },
    ],
  },
  {
    id: 'SNOW', nameKo: '눈', weight: 5, goings: ['YIELDING', 'SOFT'],
    noteKo: '눈이 쌓여 아무도 속도를 내지 못합니다. 대신 넘어져도 쉽게 일어납니다.',
    effects: [
      { kind: 'STAT_MUL', stat: 'attackSpeed', value: -0.08, trigger: { when: 'COMBAT_START' } },
      { kind: 'HEAL_MAXHP_PCT', value: 0.05, target: 'SELF', oncePerCombat: true, trigger: { when: 'ON_RACE_PHASE', phase: 'LATE' } },
      { kind: 'CC_RESIST', value: 0.2, trigger: { when: 'COMBAT_START' } },
    ],
  },
  {
    id: 'GALE', nameKo: '강풍', weight: 5, goings: ['FIRM', 'GOOD', 'YIELDING', 'SOFT'],
    noteKo: '맞바람이 정면으로 붑니다. 앞에 나선 말이 바람을 다 받고, 뒤에 숨은 말은 덜 받습니다.',
    // Front rows pay for the lead; back rows ride the slipstream.
    effects: [
      { kind: 'DAMAGE_REDUCTION', value: -0.05, trigger: { when: 'IN_FRONT_ROWS' } },
      { kind: 'DAMAGE_AMP', value: 0.08, trigger: { when: 'IN_BACK_ROWS' } },
    ],
  },
];

// ------------------------------------------------------------- 개최 특례

export type SpecialClause =
  | 'NONE' | 'LARGE_FIELD' | 'INNER_RAIL' | 'OUTER_LANE' | 'LONG_STRAIGHT'
  | 'FALSE_START' | 'HEAD_ON_HEAD' | 'TAILWIND_HOME' | 'TIGHT_CORNER';

export type ClauseDef = {
  id: SpecialClause;
  nameKo: string;
  noteKo: string;
  weight: number;
  effects: EffectDef[];
  /** Phase weights this clause shifts, for the offer scorer to read. */
  favours?: RaceCombatPhase[];
};

/**
 * The rare clauses.
 *
 * These are deliberately the odd ones: each changes a rule of the fight rather
 * than a stat line, so a round that draws one plays differently instead of
 * playing the same with different numbers. Roughly one round in three draws
 * something; the rest run NONE.
 */
export const CLAUSE_DEFS: ClauseDef[] = [
  {
    id: 'NONE', nameKo: '특례 없음', weight: 210,
    noteKo: '평범한 개최입니다.',
    effects: [],
  },
  {
    id: 'LARGE_FIELD', nameKo: '다두수 편성', weight: 14,
    noteKo: '출주두수가 많습니다. 상대가 많이 남아 있는 동안에는 모두가 서로를 방해합니다.',
    favours: ['LAST_3F'],
    effects: [
      // Everyone is boxed in while the field is full, and it opens up as the
      // race thins out. scaleBy does the counting.
      { kind: 'DAMAGE_AMP', value: -0.02, scaleBy: 'ENEMIES_ALIVE', scaleCap: 6, trigger: { when: 'COMBAT_START' } },
      { kind: 'DAMAGE_AMP', value: 0.05, scaleBy: 'ENEMIES_DEAD', scaleCap: 5, trigger: { when: 'IN_RACE_PHASE', phases: ['LATE', 'LAST_3F', 'OVERTIME'] } },
    ],
  },
  {
    id: 'INNER_RAIL', nameKo: '내곽 유리', weight: 14,
    noteKo: '안쪽 경제 코스가 열려 있습니다. 앞줄에 선 말이 거리를 아낍니다.',
    effects: [
      { kind: 'DAMAGE_REDUCTION', value: 0.07, trigger: { when: 'IN_FRONT_ROWS' } },
      { kind: 'STAT_MUL', stat: 'attackSpeed', value: 0.07, trigger: { when: 'IN_FRONT_ROWS' } },
    ],
  },
  {
    id: 'OUTER_LANE', nameKo: '외곽 신장', weight: 14,
    noteKo: '바깥쪽 마장이 잘 뻗습니다. 뒤에서 밖으로 돌아 나오는 말이 삽니다.',
    effects: [
      { kind: 'DAMAGE_AMP', value: 0.09, trigger: { when: 'IN_BACK_ROWS' } },
      { kind: 'CRIT_CHANCE_ADD', value: 0.08, trigger: { when: 'IN_BACK_ROWS' } },
    ],
  },
  {
    id: 'LONG_STRAIGHT', nameKo: '장직선 개최', weight: 14,
    noteKo: '직선이 유독 깁니다. 마지막 구간이 길어져 뒤에서 오는 말에게 시간이 남습니다.',
    favours: ['LAST_3F'],
    effects: [
      { kind: 'DAMAGE_AMP', value: 0.1, trigger: { when: 'IN_RACE_PHASE', phases: ['LAST_3F', 'OVERTIME'] } },
      { kind: 'MANA_FILL', value: 0.6, oncePerCombat: true, trigger: { when: 'ON_RACE_PHASE', phase: 'LAST_3F' } },
    ],
  },
  {
    id: 'FALSE_START', nameKo: '발주 불안', weight: 12,
    noteKo: '게이트가 말썽입니다. 출발이 엉켜 모두가 한 박자 늦게 나갑니다. 대신 한 번 정리되면 흐름이 빨라집니다.',
    favours: ['POSITIONING'],
    effects: [
      { kind: 'STAT_MUL', stat: 'attackSpeed', value: -0.14, duration: 6, trigger: { when: 'COMBAT_START' } },
      { kind: 'MANA_ADD', value: 25, oncePerCombat: true, trigger: { when: 'ON_RACE_PHASE', phase: 'POSITIONING' } },
    ],
  },
  {
    id: 'HEAD_ON_HEAD', nameKo: '경합 격화', weight: 12,
    noteKo: '앞에서 둘이 서로 물러서지 않습니다. 상대를 바꿀 때마다 힘이 더 실립니다.',
    effects: [
      { kind: 'DAMAGE_AMP', value: 0.06, duration: 4, refresh: true, trigger: { when: 'ON_TARGET_CHANGED' } },
    ],
  },
  {
    id: 'TAILWIND_HOME', nameKo: '직선 뒷바람', weight: 12,
    noteKo: '직선에 뒷바람이 붑니다. 마지막에 모두가 한 번씩 더 뻗습니다.',
    favours: ['LAST_3F'],
    effects: [
      { kind: 'RECAST_SKILL', oncePerCombat: true, trigger: { when: 'ON_RACE_PHASE', phase: 'LAST_3F' } },
    ],
  },
  {
    id: 'TIGHT_CORNER', nameKo: '급코너 개최', weight: 12,
    noteKo: '코너가 급해 4코너에서 대열이 한 번 무너집니다. 그 순간을 잡는 쪽이 가져갑니다.',
    favours: ['LATE'],
    effects: [
      { kind: 'DAMAGE_AMP', value: 0.12, duration: 5, trigger: { when: 'ON_RACE_PHASE', phase: 'LATE' } },
      { kind: 'DAMAGE_REDUCTION', value: -0.05, duration: 5, trigger: { when: 'ON_RACE_PHASE', phase: 'LATE' } },
    ],
  },
];

// ------------------------------------------------------------------- rolling

export type RaceConditions = {
  going: Going;
  pace: Pace;
  weather: Weather;
  clause: SpecialClause;
};

export const DEFAULT_CONDITIONS: RaceConditions = {
  going: 'GOOD', pace: 'MIDDLE', weather: 'CLOUDY', clause: 'NONE',
};

function weighted<T extends { weight: number }>(rng: Rng, pool: T[]): T {
  const total = pool.reduce((n, d) => n + d.weight, 0);
  let roll = rng.next() * total;
  for (const def of pool) {
    roll -= def.weight;
    if (roll < 0) return def;
  }
  return pool[pool.length - 1];
}

/**
 * Rolls one round's ground.
 *
 * Weather is drawn from the subset compatible with the going that was rolled
 * first, so the board never announces clear skies on a bog.
 */
export function rollRaceConditions(rng: Rng): RaceConditions {
  const going = weighted(rng, GOING_DEFS).id;
  const weather = weighted(rng, WEATHER_DEFS.filter((w) => w.goings.includes(going))).id;
  const pace = weighted(rng, PACE_DEFS).id;
  const clause = weighted(rng, CLAUSE_DEFS).id;
  return { going, pace, weather, clause };
}

// -------------------------------------------------------------------- lookup

const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((d) => [d.id, d]));
const GOING_BY_ID = byId(GOING_DEFS);
const PACE_BY_ID = byId(PACE_DEFS);
const WEATHER_BY_ID = byId(WEATHER_DEFS);
const CLAUSE_BY_ID = byId(CLAUSE_DEFS);

export const getGoing = (id: Going): GoingDef => GOING_BY_ID.get(id) ?? GOING_DEFS[1];
export const getPace = (id: Pace): PaceDef => PACE_BY_ID.get(id) ?? PACE_DEFS[1];
export const getWeather = (id: Weather): WeatherDef => WEATHER_BY_ID.get(id) ?? WEATHER_DEFS[1];
export const getClause = (id: SpecialClause): ClauseDef => CLAUSE_BY_ID.get(id) ?? CLAUSE_DEFS[0];

/**
 * Everything the round's ground applies to every unit on both sides.
 *
 * `MELEE_ONLY` / `RANGED_ONLY` tags are resolved when the effect is bound, not
 * when it fires: a unit that cannot receive one simply never gets it, so the
 * battle loop needs no new special case.
 */
export function conditionEffects(conditions: RaceConditions): EffectDef[] {
  return [
    ...getGoing(conditions.going).effects,
    ...getPace(conditions.pace).effects,
    ...getWeather(conditions.weather).effects,
    ...getClause(conditions.clause).effects,
  ];
}

/** How much the pace amplifies or flattens a style's curve this round. */
export function paceStyleScale(conditions: RaceConditions, style: RunStyle): number {
  return getPace(conditions.pace).styleScale[style];
}

/** The whole condition as one line, in the order a race card prints it. */
export function describeConditions(conditions: RaceConditions): string {
  const parts = [
    `마장 ${getGoing(conditions.going).nameKo}`,
    getWeather(conditions.weather).nameKo,
    getPace(conditions.pace).nameKo,
  ];
  if (conditions.clause !== 'NONE') parts.push(getClause(conditions.clause).nameKo);
  return parts.join(' · ');
}

/** The per-axis notes, for the help panel and the plan overlay. */
export function conditionNotes(conditions: RaceConditions): Array<{ label: string; note: string }> {
  const out = [
    { label: `마장 ${getGoing(conditions.going).nameKo}`, note: getGoing(conditions.going).noteKo },
    { label: getWeather(conditions.weather).nameKo, note: getWeather(conditions.weather).noteKo },
    { label: getPace(conditions.pace).nameKo, note: getPace(conditions.pace).noteKo },
  ];
  if (conditions.clause !== 'NONE') {
    out.push({ label: getClause(conditions.clause).nameKo, note: getClause(conditions.clause).noteKo });
  }
  return out;
}

/**
 * The legacy three-value going, kept so the two plan cards that read it keep
 * working and so saved matches from before this patch still load.
 */
export function legacyTrackState(going: Going): 'FAST' | 'STANDARD' | 'HEAVY' {
  if (going === 'FIRM') return 'FAST';
  if (going === 'SOFT' || going === 'YIELDING') return 'HEAVY';
  return 'STANDARD';
}
