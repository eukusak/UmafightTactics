/**
 * The race guide's content, read out of the definitions the engine actually
 * applies.
 *
 * A guide that restates the rules in its own prose is a guide that goes stale
 * the first time a number moves, and nothing fails when it does. So every row
 * here is derived: the names, the notes and the effect lines all come from
 * GOING_DEFS / PACE_DEFS / WEATHER_DEFS / CLAUSE_DEFS and the GⅠ identities,
 * and the odds are computed from the same weights the roll uses.
 */
import { GOING_DEFS, PACE_DEFS, WEATHER_DEFS, CLAUSE_DEFS } from './conditions';
import { G1_SHAPES, G1_OVERRIDES, g1Identity } from './g1-identity';
import { G1_THEMES } from './profiles';
import { describeEffectList } from './presentation';
import { STYLE_CURVES, styleStepAt } from './style-curve';
import type { RaceCombatPhase } from './types';
import type { RunStyle } from '../types';

export type GuideRow = {
  id: string;
  name: string;
  /** Share of the roll, as a percentage of the axis it belongs to. */
  chance: number | null;
  note: string;
  lines: string[];
  /** Extra per-row detail, e.g. which 마장 a weather can appear on. */
  extra?: string;
};

const share = (weight: number, total: number): number => Math.round((weight / total) * 1000) / 10;
const sum = (rows: readonly { weight: number }[]): number => rows.reduce((n, r) => n + r.weight, 0);

export const GOING_ROWS: GuideRow[] = (() => {
  const total = sum(GOING_DEFS);
  return GOING_DEFS.map((g) => ({
    id: g.id, name: g.nameKo, chance: share(g.weight, total),
    note: g.noteKo, lines: describeEffectList(g.effects),
  }));
})();

export const STYLE_LABEL: Record<RunStyle, string> = {
  nige: STYLE_CURVES.nige.nameKo, senko: STYLE_CURVES.senko.nameKo,
  sashi: STYLE_CURVES.sashi.nameKo, oikomi: STYLE_CURVES.oikomi.nameKo,
};

export const PACE_ROWS: Array<GuideRow & { scale: Record<RunStyle, number> }> = (() => {
  const total = sum(PACE_DEFS);
  return PACE_DEFS.map((p) => ({
    id: p.id, name: p.nameKo, chance: share(p.weight, total),
    note: p.noteKo, lines: describeEffectList(p.effects), scale: p.styleScale,
  }));
})();

/**
 * Weather is drawn from the entries the round's 마장 allows, so a flat share of
 * the whole table would be a number that never occurs. Each row carries the
 * grounds it can fall on and its share within each of them.
 */
export const WEATHER_ROWS: GuideRow[] = WEATHER_DEFS.map((w) => {
  const per = w.goings.map((going) => {
    const pool = WEATHER_DEFS.filter((o) => o.goings.includes(going));
    const label = GOING_DEFS.find((g) => g.id === going)!.nameKo;
    return `${label} ${share(w.weight, sum(pool))}%`;
  });
  return {
    id: w.id, name: w.nameKo, chance: null, note: w.noteKo,
    lines: describeEffectList(w.effects), extra: per.join(' · '),
  };
});

export const CLAUSE_ROWS: GuideRow[] = (() => {
  const total = sum(CLAUSE_DEFS);
  return CLAUSE_DEFS.map((c) => ({
    id: c.id, name: c.nameKo, chance: share(c.weight, total),
    note: c.noteKo, lines: describeEffectList(c.effects),
  }));
})();

/** How often a round draws any clause at all. */
export const CLAUSE_ANY_CHANCE = Math.round(
  (1 - (CLAUSE_DEFS.find((c) => c.id === 'NONE')?.weight ?? 0) / sum(CLAUSE_DEFS)) * 1000,
) / 10;

/**
 * The GⅠ 과제 list, with the races that draw each one.
 *
 * Identities are derived per race rather than stored, so the only honest way to
 * say "these eight races set this 과제" is to run the derivation over the
 * calendar and group the result.
 */
export type GuideMandate = GuideRow & { races: string[] };

export const MANDATE_ROWS: GuideMandate[] = (() => {
  const grouped = new Map<string, GuideMandate>();
  for (const theme of G1_THEMES) {
    const identity = g1Identity(theme);
    const row = grouped.get(identity.nameKo) ?? {
      id: identity.nameKo, name: identity.nameKo, chance: null,
      note: identity.noteKo, lines: describeEffectList(identity.effects), races: [],
    };
    row.races.push(`${theme.nameKo} (${theme.distanceM}m ${theme.surface === 'DIRT' ? '더트' : '잔디'})`);
    grouped.set(identity.nameKo, row);
  }
  // Shared shapes first and by how many races carry them, then the one-offs.
  const shapeNames = new Set(Object.values(G1_SHAPES).map((s) => s.nameKo));
  return [...grouped.values()].sort((a, b) =>
    Number(shapeNames.has(b.name)) - Number(shapeNames.has(a.name))
    || b.races.length - a.races.length
    || a.name.localeCompare(b.name));
})();

/** Races whose 과제 is written for them alone rather than taken from a shape. */
export const NAMED_MANDATE_COUNT = Object.keys(G1_OVERRIDES).length;

export const PHASE_ROWS = [
  { id: 'START', name: '발주', when: '자리를 잡기 전', at: '0 ~ 1/6' },
  { id: 'POSITIONING', name: '중반', when: '대열이 굳는 곳', at: '1/6 ~ 2/3' },
  { id: 'LATE', name: '4코너', when: '승부를 거는 지점', at: '2/3 ~ 5/6' },
  { id: 'LAST_3F', name: '최종 직선', when: '마지막 600m', at: '5/6 ~ 끝' },
  { id: 'OVERTIME', name: '결승선 접전', when: '시간 초과 시', at: '연장' },
] as const;

/**
 * The 각질 curve itself, as percentages, read back through the same accessor
 * combat uses — so a curve edit shows up here without anyone remembering to
 * update a table.
 */
export const STYLE_CURVE_ROWS = (Object.keys(STYLE_LABEL) as RunStyle[]).map((style) => ({
  style,
  name: STYLE_LABEL[style],
  summary: STYLE_CURVES[style].summaryKo,
  signature: STYLE_CURVES[style].signature,
  phases: PHASE_ROWS.map((p) => {
    const step = styleStepAt(style, p.id as RaceCombatPhase);
    return {
      phase: p.name,
      dealt: Math.round(step.damage * 1000) / 10,
      resist: Math.round(step.resist * 1000) / 10,
    };
  }),
}));
