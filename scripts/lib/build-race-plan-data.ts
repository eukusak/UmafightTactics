/**
 * Race Plan generated data: per-unit racing profiles and the GⅠ theme calendar.
 *
 * Everything here is derived at build time from the vendored UmaRogue snapshot,
 * so the browser never needs the 331-horse source file and never calls out.
 *
 * The one rule that matters: aptitude *letters* are for display only. Weighting
 * uses the `*Pct` fields, which are this roster's percentile for that axis —
 * 132 of 145 units hold turf A or better, so the letter separates nothing.
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
export type AffinityRating = 'FAVORITE' | 'GOOD' | 'NEUTRAL' | 'WEAK';

export type Affinity = { id: string; rating: AffinityRating; sample: number; delta: number };

export type HorseRacingProfile = {
  unitId: string;
  horseId: string;
  confidence: 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH';
  styleConfidence: 'LOW' | 'MEDIUM' | 'HIGH';
  starts: number;
  distance: Record<'sprint' | 'mile' | 'middle' | 'long', Grade>;
  surface: Record<'turf' | 'dirt', Grade>;
  style: Record<'nige' | 'senko' | 'sashi' | 'oikomi', Grade>;
  distancePct: Record<'sprint' | 'mile' | 'middle' | 'long', number>;
  surfacePct: Record<'turf' | 'dirt', number>;
  stylePct: Record<'nige' | 'senko' | 'sashi' | 'oikomi', number>;
  courses: Affinity[];
  going: Affinity[];
  seasons: Affinity[];
  signatureId: string | null;
  signatureName: string | null;
  mainWin: string | null;
  gradeWins: Record<string, number>;
};

export type G1Theme = {
  id: string;
  nameJa: string;
  nameKo: string;
  racecourse: string;
  courseNameKo: string;
  surface: 'TURF' | 'DIRT';
  distanceM: number;
  distanceClass: 'SPRINT' | 'MILE' | 'MIDDLE' | 'LONG';
  direction: 'LEFT' | 'RIGHT';
  season: 'SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER';
  grade: string;
  straightM: number | null;
};

type SourceHorse = {
  id: string;
  dataConfidence: { history: string; styleConfidence: string };
  aptitudes: {
    surface: Record<string, string>;
    distance: Record<string, string>;
    style: Record<string, string>;
  };
  affinities: { courses: Affinity[]; going: Affinity[]; seasons: Affinity[] };
  signature: { id: string; name: string } | null;
  historySummary: { starts: number; mainWin: string | null; gradeWins: Record<string, number> };
};

type BuiltUnit = { id: string; horseId: string; nameKo: string };

/** UmaRogue names the four styles after the position they take, not the Japanese term. */
const STYLE_KEYS = [
  ['front', 'nige'],
  ['pace', 'senko'],
  ['stalker', 'sashi'],
  ['closer', 'oikomi'],
] as const;
const DISTANCE_KEYS = ['sprint', 'mile', 'middle', 'long'] as const;
const SURFACE_KEYS = ['turf', 'dirt'] as const;

const GRADE_VALUE: Record<Grade, number> = {
  S: 1.0, A: 0.86, B: 0.72, C: 0.58, D: 0.44, E: 0.3, F: 0.16, G: 0.02,
};
const grade = (raw: string): Grade => (raw in GRADE_VALUE ? (raw as Grade) : 'C');
const value = (raw: string): number => GRADE_VALUE[grade(raw)];

/**
 * Midrank percentile inside this roster. Ties share the middle of their run, so
 * "everyone is A" collapses to ~0.5 instead of handing all of them a bonus.
 */
function percentile(sorted: number[], mine: number): number {
  let below = 0;
  let equal = 0;
  for (const v of sorted) {
    if (v < mine) below += 1;
    else if (v === mine) equal += 1;
  }
  return sorted.length ? (below + equal / 2) / sorted.length : 0.5;
}

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

export type RacePlanBuildReport = {
  roster: number;
  matched: number;
  unmatched: string[];
  courseAffinity: number;
  goingAffinity: number;
  seasonAffinity: number;
  lowStyleConfidence: string[];
  themes: number;
};

export function buildRacePlanData(
  units: BuiltUnit[],
  horses: SourceHorse[],
  sourceDir: string,
  outDir: string,
  snapshot: string,
): RacePlanBuildReport {
  const byHorseId = new Map(horses.map((h) => [h.id, h]));

  const unmatched = units.filter((u) => !byHorseId.has(u.horseId)).map((u) => u.id);
  if (unmatched.length) {
    // The join is exact: every UnitDef.horseId is a UmaRogue id. A miss means the
    // snapshot is wrong, not that the matcher needs to be looser.
    throw new Error(
      `race-plan: horseId join ${units.length - unmatched.length}/${units.length}. ` +
        `Unmatched: ${unmatched.join(', ')}`,
    );
  }

  // Axis distributions, computed over this roster only.
  const axis = (pick: (h: SourceHorse) => string): number[] =>
    units.map((u) => value(pick(byHorseId.get(u.horseId)!))).sort((a, b) => a - b);
  const distanceAxis = Object.fromEntries(
    DISTANCE_KEYS.map((k) => [k, axis((h) => h.aptitudes.distance[k])]),
  ) as Record<(typeof DISTANCE_KEYS)[number], number[]>;
  const surfaceAxis = Object.fromEntries(
    SURFACE_KEYS.map((k) => [k, axis((h) => h.aptitudes.surface[k])]),
  ) as Record<(typeof SURFACE_KEYS)[number], number[]>;
  const styleAxis = Object.fromEntries(
    STYLE_KEYS.map(([src, ours]) => [ours, axis((h) => h.aptitudes.style[src])]),
  ) as Record<string, number[]>;

  const profiles: Record<string, HorseRacingProfile> = {};
  const report: RacePlanBuildReport = {
    roster: units.length,
    matched: units.length,
    unmatched: [],
    courseAffinity: 0,
    goingAffinity: 0,
    seasonAffinity: 0,
    lowStyleConfidence: [],
    themes: 0,
  };

  for (const unit of units) {
    const h = byHorseId.get(unit.horseId)!;
    const styleConfidence = (['LOW', 'MEDIUM', 'HIGH'] as const).includes(
      h.dataConfidence.styleConfidence as 'LOW',
    )
      ? (h.dataConfidence.styleConfidence as 'LOW' | 'MEDIUM' | 'HIGH')
      : 'LOW';
    if (styleConfidence === 'LOW') report.lowStyleConfidence.push(unit.id);
    if (h.affinities.courses.length) report.courseAffinity += 1;
    if (h.affinities.going.length) report.goingAffinity += 1;
    if (h.affinities.seasons.length) report.seasonAffinity += 1;

    profiles[unit.id] = {
      unitId: unit.id,
      horseId: h.id,
      confidence: (['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH'] as const).includes(
        h.dataConfidence.history as 'LOW',
      )
        ? (h.dataConfidence.history as HorseRacingProfile['confidence'])
        : 'VERY_LOW',
      styleConfidence,
      starts: h.historySummary.starts,
      distance: Object.fromEntries(
        DISTANCE_KEYS.map((k) => [k, grade(h.aptitudes.distance[k])]),
      ) as HorseRacingProfile['distance'],
      surface: Object.fromEntries(
        SURFACE_KEYS.map((k) => [k, grade(h.aptitudes.surface[k])]),
      ) as HorseRacingProfile['surface'],
      style: Object.fromEntries(
        STYLE_KEYS.map(([src, ours]) => [ours, grade(h.aptitudes.style[src])]),
      ) as HorseRacingProfile['style'],
      distancePct: Object.fromEntries(
        DISTANCE_KEYS.map((k) => [
          k,
          round3(percentile(distanceAxis[k], value(h.aptitudes.distance[k]))),
        ]),
      ) as HorseRacingProfile['distancePct'],
      surfacePct: Object.fromEntries(
        SURFACE_KEYS.map((k) => [
          k,
          round3(percentile(surfaceAxis[k], value(h.aptitudes.surface[k]))),
        ]),
      ) as HorseRacingProfile['surfacePct'],
      stylePct: Object.fromEntries(
        STYLE_KEYS.map(([src, ours]) => [
          ours,
          round3(percentile(styleAxis[ours], value(h.aptitudes.style[src]))),
        ]),
      ) as HorseRacingProfile['stylePct'],
      courses: h.affinities.courses,
      going: h.affinities.going,
      seasons: h.affinities.seasons,
      signatureId: h.signature?.id ?? null,
      signatureName: h.signature?.name ?? null,
      mainWin: h.historySummary.mainWin,
      gradeWins: h.historySummary.gradeWins ?? {},
    };
  }

  // ------------------------------------------------------------- GⅠ themes
  type TemplateRow = {
    id: string; nameJa: string; nameKo: string; racecourse: string;
    surface: string; distanceM: number; direction: string; season: string;
    distanceClass: string; grade: string;
  };
  const templates = JSON.parse(
    readFileSync(path.join(sourceDir, 'race-templates.json'), 'utf8'),
  ) as { templates: TemplateRow[] };
  const courses = JSON.parse(
    readFileSync(path.join(sourceDir, 'racecourses.json'), 'utf8'),
  ) as { courses: Array<{ id: string; nameKo: string; straightM: number }> };
  const courseById = new Map(courses.courses.map((c) => [c.id, c]));

  const themes: G1Theme[] = templates.templates
    .filter((t) => t.grade === 'GI' || t.grade === 'JpnI')
    .map((t) => ({
      id: t.id,
      nameJa: t.nameJa,
      nameKo: t.nameKo,
      racecourse: t.racecourse,
      courseNameKo: courseById.get(t.racecourse)?.nameKo ?? t.racecourse,
      surface: t.surface as G1Theme['surface'],
      distanceM: t.distanceM,
      distanceClass: t.distanceClass as G1Theme['distanceClass'],
      direction: t.direction as G1Theme['direction'],
      season: t.season as G1Theme['season'],
      grade: t.grade,
      straightM: courseById.get(t.racecourse)?.straightM ?? null,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  if (!themes.length) throw new Error('race-plan: no GI/JpnI race templates found');
  report.themes = themes.length;

  mkdirSync(outDir, { recursive: true });
  const write = (file: string, body: unknown): void =>
    writeFileSync(path.join(outDir, file), JSON.stringify(body, null, 2) + '\n');
  write('horse-racing-profiles.json', {
    version: 1,
    sourceSnapshot: snapshot,
    rosterSize: units.length,
    profiles,
  });
  write('g1-themes.json', { version: 1, sourceSnapshot: snapshot, themes });

  return report;
}

/** Human-readable coverage record, committed so data drift is reviewable. */
export function writeRacePlanImportReport(root: string, report: RacePlanBuildReport): void {
  const pct = (n: number): string => `${((n / report.roster) * 100).toFixed(1)}%`;
  const lines = [
    '# RACE PLAN — 데이터 임포트 리포트',
    '',
    '> `npm run data:build`가 자동 생성한다. 직접 수정하지 않는다.',
    '',
    '| 항목 | 값 |',
    '|---|---:|',
    `| 로스터 | ${report.roster} |`,
    `| horseId 조인 성공 | ${report.matched} |`,
    `| 조인 실패 | ${report.unmatched.length} |`,
    `| 코스 affinity 보유 | ${report.courseAffinity} (${pct(report.courseAffinity)}) |`,
    `| 마장상태 affinity 보유 | ${report.goingAffinity} (${pct(report.goingAffinity)}) |`,
    `| 계절 affinity 보유 | ${report.seasonAffinity} (${pct(report.seasonAffinity)}) |`,
    `| 각질 신뢰도 LOW | ${report.lowStyleConfidence.length} |`,
    `| GⅠ 테마 | ${report.themes} |`,
    '',
    '## 각질 신뢰도 LOW (고유 승부수 생성 제외 대상)',
    '',
    report.lowStyleConfidence.length
      ? report.lowStyleConfidence.map((id) => `- \`${id}\``).join('\n')
      : '- 없음',
    '',
    '## 주의',
    '',
    '- 마장상태(going) affinity 보유율이 낮으므로 going을 조건으로 쓰는 콘텐츠를 만들지 않는다.',
    '- 적성 등급 문자는 표기 전용이다. 가중치는 `*Pct`(로스터 퍼센타일)만 사용한다.',
    '',
  ];
  mkdirSync(path.join(root, 'docs', 'generated'), { recursive: true });
  writeFileSync(
    path.join(root, 'docs', 'generated', 'RACE_PLAN_DATA_IMPORT_REPORT.md'),
    lines.join('\n'),
  );
}
