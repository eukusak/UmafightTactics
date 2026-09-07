/**
 * Generates every JSON file under src/data/generated/ from the vendored
 * UmaRogue source plus the auditable manual overrides.
 *
 * The output is committed, so a released build never re-derives the roster
 * (spec §1 rule 5): one version of the game always sees the same 60 units.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ACTIVE_S1_SIZE, BASE_AD, BASE_AS, BASE_HP, BASE_RESIST, CANONICAL_ROSTER_SIZE,
  COST_UNIT_COUNTS, DEFAULT_ABILITY_POWER, DEFAULT_CRIT_CHANCE, DEFAULT_CRIT_MULTIPLIER,
  POOL_COPIES, ROLE_MANA, RUN_STYLE_START_MANA, SHOP_ODDS,
} from '../src/game/engine/constants';
import { buildSkill } from '../src/game/engine/battle/skill-templates';
import { TRAIT_DEFS } from '../src/game/engine/traits/trait-defs';
import { ALL_ITEM_DEFS } from '../src/game/engine/items/item-defs';
import { AUGMENT_DEFS } from '../src/game/engine/augments/augment-defs';
import type {
  ArtManifest, Cost, DistanceTrait, HistoryTrait, Role, RunStyle, TraitId, UnitDef,
} from '../src/game/engine/types';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src', 'data', 'source');
const MANUAL = path.join(ROOT, 'src', 'data', 'manual');
const OUT = path.join(ROOT, 'src', 'data', 'generated');

const readJson = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;

// ---------------------------------------------------------------- source types
type Horse = {
  id: string; nameJa: string; nameKo: string; nameEn: string; birthYear: number;
  priority: string; powerIndex: number; tier: number; starterCost: number;
  dataConfidence: { history: string; historyRows: number; careerStarts: number; coverage: number; styleConfidence: string };
  stats: { speed: number; stamina: number; power: number; guts: number; intelligence: number };
  aptitudes: {
    surface: { turf: string; dirt: string };
    distance: { sprint: string; mile: string; middle: string; long: string };
    style: { front: string; pace: string; stalker: string; closer: string };
  };
  archetype: string;
  raceTraits: string[];
  signature: { id: string; name: string } | null;
  historySummary: {
    starts: number; wins: number; recordedRaces: number; mainWin: string | null;
    bestSurface: string | null; bestDistanceClass: string | null; primaryStyle: string | null;
    gradeWins: Record<string, number>;
  };
};

type CanonicalRoster = { version: number; names: string[] };
type AliasRow = { canonicalNameKo: string; horseId: string; sourceNameKo: string };
type TraitOverrides = { historyTrait: Record<string, { trait: HistoryTrait; reason: string }> };
type UnitOverrides = {
  forceActiveS1: string[]; forceInactiveS1: string[];
  costOverride: Record<string, Cost>; roleOverride: Record<string, Role>;
};
type LegacyTags = {
  tripleCrown: Record<string, string>;
  internationalG1: Record<string, string>;
  famousHouseGroups: Record<string, string[]>;
};

// ------------------------------------------------------------------- utilities
const APTITUDE_VALUE: Record<string, number> = { S: 1.0, A: 0.88, B: 0.74, C: 0.58, D: 0.42, E: 0.28, F: 0.16, G: 0.05 };
const apt = (g: string): number => APTITUDE_VALUE[g] ?? 0;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const round2 = (v: number): number => Math.round(v * 100) / 100;
const roundTo5 = (v: number): number => Math.round(v / 5) * 5;

/** Rank-based percentile inside the supplied population (ties share a rank). */
function percentileMap(values: Map<string, number>): Map<string, number> {
  const sorted = [...values.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  const n = sorted.length;
  const out = new Map<string, number>();
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && sorted[j + 1][1] === sorted[i][1]) j += 1;
    const rank = (i + j) / 2;
    const p = n <= 1 ? 1 : rank / (n - 1);
    for (let k = i; k <= j; k += 1) out.set(sorted[k][0], p);
    i = j + 1;
  }
  return out;
}

/** ASCII snake_case unit id derived from the English name; art files use it verbatim. */
function toUnitId(nameEn: string, horseId: string, taken: Set<string>): string {
  let base = nameEn
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .toLowerCase()
    .replace(/['".]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!base) base = horseId.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  let id = base;
  let n = 2;
  while (taken.has(id)) { id = `${base}_${n}`; n += 1; }
  taken.add(id);
  return id;
}

const normalizeName = (s: string): string => s.replace(/[\s·・ー\-]/g, '').normalize('NFC');

// ------------------------------------------------------------------------ load
console.log('data:build — generating game data');

const db = readJson<{ snapshot: { version: string; sourceDb: string }; horses: Horse[] }>(
  path.join(SRC, 'horse-game-db.json'),
);
const canonical = readJson<CanonicalRoster>(path.join(MANUAL, 'canonical-roster.json'));
const aliases = readJson<AliasRow[]>(path.join(MANUAL, 'name-aliases.json'));
const traitOverrides = readJson<TraitOverrides>(path.join(MANUAL, 'trait-overrides.json'));
const unitOverrides = readJson<UnitOverrides>(path.join(MANUAL, 'unit-overrides.json'));
const legacy = readJson<LegacyTags>(path.join(MANUAL, 'legacy-tags.json'));

const p0 = db.horses.filter((h) => h.priority === 'P0');
if (p0.length !== CANONICAL_ROSTER_SIZE) {
  throw new Error(`Expected ${CANONICAL_ROSTER_SIZE} P0 horses, found ${p0.length}.`);
}
if (canonical.names.length !== CANONICAL_ROSTER_SIZE) {
  throw new Error(`canonical-roster.json holds ${canonical.names.length} names, expected ${CANONICAL_ROSTER_SIZE}.`);
}

// ------------------------------------------------- resolve canonical -> horse
// Exact match first, then normalized, then the explicit alias table. Never fuzzy.
const byNormName = new Map<string, Horse>();
for (const h of p0) byNormName.set(normalizeName(h.nameKo), h);
const byId = new Map(p0.map((h) => [h.id, h]));
const aliasByCanonical = new Map(aliases.map((a) => [a.canonicalNameKo, a]));

const resolved = new Map<string, Horse>(); // canonical name -> horse
const usedHorses = new Set<string>();
const unresolved: string[] = [];

for (const name of canonical.names) {
  let horse = byNormName.get(normalizeName(name));
  if (!horse) {
    const alias = aliasByCanonical.get(name);
    if (alias) {
      horse = byId.get(alias.horseId);
      if (horse && normalizeName(horse.nameKo) !== normalizeName(alias.sourceNameKo)) {
        throw new Error(
          `Alias for "${name}" points at ${alias.horseId} whose nameKo is "${horse.nameKo}", ` +
            `but the alias recorded "${alias.sourceNameKo}". Source data changed — review name-aliases.json.`,
        );
      }
    }
  }
  if (!horse) { unresolved.push(name); continue; }
  if (usedHorses.has(horse.id)) throw new Error(`Horse ${horse.id} is claimed by two canonical names.`);
  usedHorses.add(horse.id);
  resolved.set(name, horse);
}

if (unresolved.length) {
  throw new Error(
    `${unresolved.length} canonical name(s) have no row in horse-game-db.json:\n  ${unresolved.join('\n  ')}\n` +
      'Add an explicit entry to src/data/manual/name-aliases.json — fuzzy matching is not permitted.',
  );
}
const leftover = p0.filter((h) => !usedHorses.has(h.id));
if (leftover.length) {
  throw new Error(
    `${leftover.length} P0 horse(s) are not claimed by the canonical roster: ` +
      leftover.map((h) => `${h.id}/${h.nameKo}`).join(', '),
  );
}
console.log(`  resolved 145/145 canonical names (${aliases.length} via explicit alias)`);

// ------------------------------------------------------------------ features
const names = canonical.names;
const horseOf = (n: string): Horse => resolved.get(n)!;

const pick = (fn: (h: Horse) => number): Map<string, number> =>
  new Map(names.map((n) => [n, fn(horseOf(n))]));

const pPowerIndex = percentileMap(pick((h) => h.powerIndex));
const pSpeed = percentileMap(pick((h) => h.stats.speed));
const pStamina = percentileMap(pick((h) => h.stats.stamina));
const pPower = percentileMap(pick((h) => h.stats.power));
const pGuts = percentileMap(pick((h) => h.stats.guts));
const pIntelligence = percentileMap(pick((h) => h.stats.intelligence));

/** G1 (and Japan-G1-equivalent) wins, percentile-normalised across the 145. */
const g1Raw = pick((h) => {
  const g = h.historySummary.gradeWins ?? {};
  return (g.GI ?? 0) + (g.JpnI ?? 0) + 0.35 * ((g.GII ?? 0) + (g.JpnII ?? 0));
});
const g1Score = percentileMap(g1Raw);

// `winScore` / `top3Score` are listed as available features in spec §7.3 but the
// authoritative recordCore formula does not consume them, so they are not computed.

/** Aptitude spread across distances and surfaces. */
const versatilityRaw = pick((h) => {
  const d = Object.values(h.aptitudes.distance).map(apt);
  const s = Object.values(h.aptitudes.surface).map(apt);
  const dTop = d.slice().sort((a, b) => b - a);
  const breadth = dTop[0] + 0.8 * dTop[1] + 0.5 * dTop[2] + 0.3 * dTop[3];
  const dual = Math.min(s[0], s[1]);
  return breadth / 2.6 * 0.7 + dual * 0.3;
});
const versatilityScore = percentileMap(versatilityRaw);

const CONFIDENCE: Record<string, number> = { HIGH: 1.0, MEDIUM: 0.85, LOW: 0.7, VERY_LOW: 0.55 };

/** Spec §7.3 — iconic bonus, +0.25 per condition, capped at 1.0, no manual nudging. */
const generationTop3Pct = (() => {
  const byDecade = new Map<number, Array<{ name: string; pi: number }>>();
  for (const n of names) {
    const h = horseOf(n);
    const decade = Math.floor(h.birthYear / 10) * 10;
    if (!byDecade.has(decade)) byDecade.set(decade, []);
    byDecade.get(decade)!.push({ name: n, pi: h.powerIndex });
  }
  const top = new Set<string>();
  for (const rows of byDecade.values()) {
    rows.sort((a, b) => b.pi - a.pi);
    const take = Math.max(1, Math.ceil(rows.length * 0.03));
    rows.slice(0, take).forEach((r) => top.add(r.name));
  }
  return top;
})();

function iconicBonus(name: string): number {
  const h = horseOf(name);
  const g = h.historySummary.gradeWins ?? {};
  const g1 = (g.GI ?? 0) + (g.JpnI ?? 0);
  let bonus = 0;
  // Undefeated with multiple top-grade wins.
  if (h.historySummary.starts >= 4 && h.historySummary.wins === h.historySummary.starts && g1 >= 1) bonus += 0.25;
  // Triple crown / fillies' triple crown.
  if (legacy.tripleCrown[name]) bonus += 0.25;
  // Top-grade win overseas.
  if (legacy.internationalG1[name]) bonus += 0.25;
  // Three or more G1 wins (proxy for a dominant single season).
  if (g1 >= 3) bonus += 0.25;
  // Top 3% of power index within the birth decade.
  if (generationTop3Pct.has(name)) bonus += 0.25;
  return Math.min(1, bonus);
}

const uftRating = new Map<string, number>();
for (const n of names) {
  const h = horseOf(n);
  const c = CONFIDENCE[h.dataConfidence.history] ?? 0.55;
  const recordCore =
    0.36 * pPowerIndex.get(n)! +
    0.12 * pSpeed.get(n)! +
    0.10 * pStamina.get(n)! +
    0.12 * pPower.get(n)! +
    0.08 * pGuts.get(n)! +
    0.07 * pIntelligence.get(n)! +
    0.08 * g1Score.get(n)! +
    0.04 * versatilityScore.get(n)! +
    0.03 * iconicBonus(n);
  const confidenceAdjusted = recordCore * c + pPowerIndex.get(n)! * (1 - c);
  // `earnings` is absent from the current source data, so earningsBonus is 0 (spec §7.3).
  uftRating.set(n, clamp01(confidenceAdjusted));
}

// -------------------------------------------------------------------- roles
const roleScores = new Map<string, Record<Role, number>>();
for (const n of names) {
  const s = {
    pi: pPowerIndex.get(n)!, sp: pSpeed.get(n)!, st: pStamina.get(n)!,
    po: pPower.get(n)!, gu: pGuts.get(n)!, iq: pIntelligence.get(n)!, ve: versatilityScore.get(n)!,
  };
  roleScores.set(n, {
    TANK: 0.42 * s.st + 0.33 * s.gu + 0.15 * s.iq + 0.10 * s.pi,
    BRUISER: 0.30 * s.po + 0.25 * s.st + 0.20 * s.gu + 0.15 * s.sp + 0.10 * s.pi,
    AD_CARRY: 0.38 * s.po + 0.32 * s.sp + 0.20 * s.pi + 0.10 * s.gu,
    AP_CARRY: 0.38 * s.iq + 0.27 * s.sp + 0.25 * s.pi + 0.10 * s.gu,
    SUPPORT: 0.42 * s.iq + 0.25 * s.gu + 0.18 * s.ve + 0.15 * s.pi,
  });
}
const ALL_ROLES: Role[] = ['TANK', 'BRUISER', 'AD_CARRY', 'AP_CARRY', 'SUPPORT'];
const roleOf = new Map<string, Role>();
for (const n of names) {
  const forced = unitOverrides.roleOverride[n];
  if (forced) { roleOf.set(n, forced); continue; }
  const sc = roleScores.get(n)!;
  let best: Role = 'BRUISER';
  for (const r of ALL_ROLES) if (sc[r] > sc[best]) best = r;
  roleOf.set(n, best);
}

// -------------------------------------------------------------------- traits
const STYLE_FROM_PRIMARY: Record<string, RunStyle> = {
  FRONT: 'nige', PACE: 'senko', STALKER: 'sashi', CLOSER: 'oikomi',
};
const STYLE_FROM_APT: Array<[keyof Horse['aptitudes']['style'], RunStyle]> = [
  ['front', 'nige'], ['pace', 'senko'], ['stalker', 'sashi'], ['closer', 'oikomi'],
];

/** Spec §11.1 — run style: trusted primary style, then archetype, then aptitude, then senko. */
function styleOf(h: Horse): RunStyle {
  const conf = h.dataConfidence.styleConfidence;
  const primary = h.historySummary.primaryStyle;
  if (primary && (conf === 'HIGH' || conf === 'MEDIUM') && STYLE_FROM_PRIMARY[primary]) {
    return STYLE_FROM_PRIMARY[primary];
  }
  for (const [token, style] of [['FRONT', 'nige'], ['PACE', 'senko'], ['STALKER', 'sashi'], ['CLOSER', 'oikomi']] as const) {
    if (h.archetype.endsWith(`_${token}`)) return style;
  }
  if (h.raceTraits.includes('FRONT_PRESSURE')) return 'nige';
  if (h.raceTraits.includes('PATIENT')) return 'oikomi';
  let best: RunStyle | null = null;
  let bestVal = -1;
  for (const [key, style] of STYLE_FROM_APT) {
    const v = apt(h.aptitudes.style[key]);
    if (v > bestVal) { bestVal = v; best = style; }
  }
  if (primary && STYLE_FROM_PRIMARY[primary]) return STYLE_FROM_PRIMARY[primary];
  return best ?? 'senko';
}

const DISTANCE_KEYS: Array<[keyof Horse['aptitudes']['distance'], DistanceTrait]> = [
  ['sprint', 'sprinter'], ['mile', 'miler'], ['middle', 'middle'], ['long', 'stayer'],
];

function bestDistance(h: Horse): DistanceTrait {
  const fromHistory: Record<string, DistanceTrait> = {
    SPRINT: 'sprinter', MILE: 'miler', MIDDLE: 'middle', LONG: 'stayer',
  };
  let best: DistanceTrait = 'middle';
  let bestVal = -1;
  for (const [key, trait] of DISTANCE_KEYS) {
    const v = apt(h.aptitudes.distance[key]);
    if (v > bestVal) { bestVal = v; best = trait; }
  }
  // A confident recorded best distance class outranks a tie in raw aptitude.
  const hist = h.historySummary.bestDistanceClass;
  if (hist && fromHistory[hist]) {
    const histVal = apt(h.aptitudes.distance[
      (Object.entries(fromHistory).find(([, t]) => t === fromHistory[hist])![0].toLowerCase()) as keyof Horse['aptitudes']['distance']
    ] ?? 'C');
    if (histVal >= bestVal - 0.15) return fromHistory[hist];
  }
  return best;
}

/** Spec §11.2 — the distance slot can instead be dirt_champion or all_rounder. */
function distanceSlotTrait(h: Horse): DistanceTrait | 'dirt_champion' | 'all_rounder' {
  const turf = apt(h.aptitudes.surface.turf);
  const dirt = apt(h.aptitudes.surface.dirt);
  const enoughSample = h.historySummary.starts >= 6 && h.dataConfidence.history !== 'VERY_LOW';

  if (enoughSample && dirt >= turf + 0.14 && dirt >= 0.74) return 'dirt_champion';
  if (h.raceTraits.includes('DIRT_SPECIALIST') && dirt >= 0.74) return 'dirt_champion';

  const topDistances = DISTANCE_KEYS.map(([k]) => apt(h.aptitudes.distance[k])).filter((v) => v >= 0.74).length;
  if (turf >= 0.74 && dirt >= 0.74 && topDistances >= 3) return 'all_rounder';
  if (h.archetype === 'DUAL_SURFACE_ALLROUNDER' && topDistances >= 3) return 'all_rounder';

  return bestDistance(h);
}

const houseOfName = new Map<string, string>();
for (const [house, members] of Object.entries(legacy.famousHouseGroups)) {
  for (const m of members) houseOfName.set(m, house);
}

const speedRankTop5 = new Set(
  [...names].sort((a, b) => horseOf(b).stats.speed - horseOf(a).stats.speed || a.localeCompare(b))
    .slice(0, Math.ceil(names.length * 0.05)),
);
const durabilityTop10 = new Set(
  [...names].sort((a, b) => horseOf(b).historySummary.starts - horseOf(a).historySummary.starts || a.localeCompare(b))
    .slice(0, Math.ceil(names.length * 0.10)),
);
const comebackTop10 = (() => {
  const score = new Map<string, number>();
  for (const n of names) {
    const h = horseOf(n);
    const upset = h.raceTraits.includes('UPSETTER') ? 1 : 0;
    const unpredictable = h.raceTraits.includes('UNPREDICTABLE') ? 0.5 : 0;
    const lateStyle = ['sashi', 'oikomi'].includes(styleOf(h)) ? 0.4 : 0;
    score.set(n, upset + unpredictable + lateStyle + 0.3 * (g1Score.get(n) ?? 0));
  }
  return new Set(
    [...names].sort((a, b) => score.get(b)! - score.get(a)! || a.localeCompare(b))
      .slice(0, Math.ceil(names.length * 0.10)),
  );
})();

/** Spec §11.3 — history trait, in the documented priority order. */
function historyTraitOf(name: string): HistoryTrait {
  const manual = traitOverrides.historyTrait[name];
  if (manual) return manual.trait;

  const h = horseOf(name);
  const g = h.historySummary.gradeWins ?? {};
  const g1 = (g.GI ?? 0) + (g.JpnI ?? 0);

  if (legacy.tripleCrown[name]) return 'triple_crown';
  if (h.historySummary.starts >= 4 && h.historySummary.wins === h.historySummary.starts && g1 >= 1) return 'unbeaten';
  if (legacy.internationalG1[name]) return 'international';
  if (houseOfName.has(name)) return 'famous_house';
  if (comebackTop10.has(name)) return 'comeback';
  if (durabilityTop10.has(name)) return 'iron_horse';
  if (speedRankTop5.has(name)) return 'record_breaker';
  if (h.birthYear <= 1989) return 'classic_legend';
  if (h.birthYear <= 2009) return 'heisei_dynasty';
  return 'reiwa_elite';
}

const styleOfName = new Map<string, RunStyle>(names.map((n) => [n, styleOf(horseOf(n))]));
const distanceSlotOfName = new Map(names.map((n) => [n, distanceSlotTrait(horseOf(n))]));
const historyOfName = new Map<string, HistoryTrait>(names.map((n) => [n, historyTraitOf(n)]));

// `emperor` is unique: keep only the single highest-rated holder (spec §11 table).
const emperors = names.filter((n) => historyOfName.get(n) === 'emperor')
  .sort((a, b) => uftRating.get(b)! - uftRating.get(a)! || a.localeCompare(b));
for (const n of emperors.slice(1)) {
  historyOfName.set(n, legacy.tripleCrown[n] ? 'triple_crown' : 'unbeaten');
  console.log(`  emperor is unique: ${n} demoted to ${historyOfName.get(n)}`);
}

// ------------------------------------------------- Season 1 active roster (60)
const ratingOrder = [...names].sort((a, b) => uftRating.get(b)! - uftRating.get(a)! || a.localeCompare(b));

const eraOf = (n: string): '80s' | '90s' | '00s' | '10s+' => {
  const y = horseOf(n).birthYear;
  if (y <= 1989) return '80s';
  if (y <= 1999) return '90s';
  if (y <= 2009) return '00s';
  return '10s+';
};

type Coverage = {
  style: Record<RunStyle, number>;
  distance: Record<DistanceTrait, number>;
  dirt: number;
  era: Record<'80s' | '90s' | '00s' | '10s+', number>;
  role: Record<Role, number>;
};
const emptyCoverage = (): Coverage => ({
  style: { nige: 0, senko: 0, sashi: 0, oikomi: 0 },
  distance: { sprinter: 0, miler: 0, middle: 0, stayer: 0 },
  dirt: 0,
  era: { '80s': 0, '90s': 0, '00s': 0, '10s+': 0 },
  role: { TANK: 0, BRUISER: 0, AD_CARRY: 0, AP_CARRY: 0, SUPPORT: 0 },
});

/** Spec §7.4 minimum coverage inside the active 60. */
const MIN_STYLE = 8, MIN_DISTANCE = 7, MIN_DIRT = 6;
const MIN_ERA: Record<'80s' | '90s' | '00s' | '10s+', number> = { '80s': 6, '90s': 10, '00s': 10, '10s+': 12 };
const MIN_ROLE = 8;

function addCoverage(cov: Coverage, n: string, delta: number): void {
  cov.style[styleOfName.get(n)!] += delta;
  const ds = distanceSlotOfName.get(n)!;
  if (ds === 'dirt_champion') cov.dirt += delta;
  else if (ds !== 'all_rounder') cov.distance[ds] += delta;
  // An all_rounder also counts toward its natural best distance for coverage purposes.
  if (ds === 'all_rounder' || ds === 'dirt_champion') cov.distance[bestDistance(horseOf(n))] += delta;
  cov.era[eraOf(n)] += delta;
  cov.role[roleOf.get(n)!] += delta;
}

function deficit(cov: Coverage): number {
  let d = 0;
  for (const s of ['nige', 'senko', 'sashi', 'oikomi'] as RunStyle[]) d += Math.max(0, MIN_STYLE - cov.style[s]);
  for (const t of ['sprinter', 'miler', 'middle', 'stayer'] as DistanceTrait[]) d += Math.max(0, MIN_DISTANCE - cov.distance[t]);
  d += Math.max(0, MIN_DIRT - cov.dirt);
  for (const e of Object.keys(MIN_ERA) as Array<keyof typeof MIN_ERA>) d += Math.max(0, MIN_ERA[e] - cov.era[e]);
  for (const r of ALL_ROLES) d += Math.max(0, MIN_ROLE - cov.role[r]);
  return d;
}

/** How much picking `n` would close the remaining coverage gap, normalised to 0..1. */
function diversityNeed(cov: Coverage, n: string, remaining: number): number {
  const styleGap = Math.max(0, MIN_STYLE - cov.style[styleOfName.get(n)!]);
  const ds = distanceSlotOfName.get(n)!;
  const distTrait = ds === 'dirt_champion' || ds === 'all_rounder' ? bestDistance(horseOf(n)) : ds;
  const distGap = Math.max(0, MIN_DISTANCE - cov.distance[distTrait]);
  const surfaceGap = ds === 'dirt_champion' ? Math.max(0, MIN_DIRT - cov.dirt) : 0;
  const eraGap = Math.max(0, MIN_ERA[eraOf(n)] - cov.era[eraOf(n)]);
  const roleGap = Math.max(0, MIN_ROLE - cov.role[roleOf.get(n)!]);
  const norm = (gap: number, min: number) => Math.min(1, gap / Math.max(1, Math.min(min, remaining)));
  return (
    norm(styleGap, MIN_STYLE) * 0.30 +
    norm(distGap, MIN_DISTANCE) * 0.25 +
    norm(surfaceGap, MIN_DIRT) * 0.20 +
    norm(eraGap, MIN_ERA[eraOf(n)]) * 0.15 +
    norm(roleGap, MIN_ROLE) * 0.10
  );
}

const active = new Set<string>();
const coverage = emptyCoverage();

for (const n of unitOverrides.forceActiveS1) {
  if (!resolved.has(n)) throw new Error(`unit-overrides.forceActiveS1 names unknown unit "${n}"`);
  active.add(n); addCoverage(coverage, n, 1);
}
// Spec §7.4 step 1: the top 36 by rating are locked in.
for (const n of ratingOrder) {
  if (active.size >= 36) break;
  if (active.has(n) || unitOverrides.forceInactiveS1.includes(n)) continue;
  active.add(n); addCoverage(coverage, n, 1);
}
// Step 2: the remaining slots go to the best blend of rating and coverage need.
while (active.size < ACTIVE_S1_SIZE) {
  const remaining = ACTIVE_S1_SIZE - active.size;
  let best: string | null = null;
  let bestScore = -Infinity;
  for (const n of names) {
    if (active.has(n) || unitOverrides.forceInactiveS1.includes(n)) continue;
    const score = 0.72 * uftRating.get(n)! + 0.28 * diversityNeed(coverage, n, remaining);
    if (score > bestScore) { bestScore = score; best = n; }
  }
  if (!best) throw new Error('Ran out of candidates while filling the Season 1 roster.');
  active.add(best); addCoverage(coverage, best, 1);
}

// Step 3: swap out the lowest-value picks until every coverage floor is satisfied.
for (let pass = 0; pass < 400 && deficit(coverage) > 0; pass += 1) {
  const before = deficit(coverage);
  let bestSwap: { out: string; in: string; gain: number } | null = null;
  const activeByValue = [...active]
    .filter((n) => !unitOverrides.forceActiveS1.includes(n))
    .sort((a, b) => uftRating.get(a)! - uftRating.get(b)!);
  for (const out of activeByValue.slice(0, 30)) {
    addCoverage(coverage, out, -1);
    for (const cand of names) {
      if (active.has(cand) || unitOverrides.forceInactiveS1.includes(cand)) continue;
      addCoverage(coverage, cand, 1);
      const after = deficit(coverage);
      addCoverage(coverage, cand, -1);
      const gain = before - after;
      // Prefer the biggest coverage gain; break ties on rating so we lose as little as possible.
      const tie = gain * 1000 + uftRating.get(cand)! - uftRating.get(out)!;
      if (gain > 0 && (!bestSwap || tie > bestSwap.gain)) bestSwap = { out, in: cand, gain: tie };
    }
    addCoverage(coverage, out, 1);
  }
  if (!bestSwap) break;
  active.delete(bestSwap.out); addCoverage(coverage, bestSwap.out, -1);
  active.add(bestSwap.in); addCoverage(coverage, bestSwap.in, 1);
}

if (active.size !== ACTIVE_S1_SIZE) throw new Error(`Active roster size ${active.size} != ${ACTIVE_S1_SIZE}`);
const remainingDeficit = deficit(coverage);
console.log(`  active roster: ${active.size} units, coverage deficit ${remainingDeficit}`);
if (remainingDeficit > 0) {
  console.log(`  coverage detail: ${JSON.stringify(coverage)}`);
}

// -------------------------------------------------------------- cost assignment
const activeByRating = [...active].sort((a, b) => uftRating.get(a)! - uftRating.get(b)! || a.localeCompare(b));
const costOf = new Map<string, Cost>();
{
  let i = 0;
  const order: Cost[] = [1, 2, 3, 4, 5];
  for (const cost of order) {
    for (let k = 0; k < COST_UNIT_COUNTS[cost]; k += 1) {
      costOf.set(activeByRating[i], cost);
      i += 1;
    }
  }
  if (i !== ACTIVE_S1_SIZE) throw new Error(`Cost assignment covered ${i} units, expected ${ACTIVE_S1_SIZE}`);
}

// Spec §7.5 — no single role may exceed 45% of a cost bracket; swap across the boundary.
function roleShare(cost: Cost, role: Role): number {
  const members = [...active].filter((n) => costOf.get(n) === cost);
  const count = members.filter((n) => roleOf.get(n) === role).length;
  return count / Math.max(1, members.length);
}
for (let pass = 0; pass < 60; pass += 1) {
  let changed = false;
  for (const cost of [1, 2, 3, 4, 5] as Cost[]) {
    for (const role of ALL_ROLES) {
      if (roleShare(cost, role) <= 0.45) continue;
      const neighbours = ([cost - 1, cost + 1] as number[]).filter((c) => c >= 1 && c <= 5) as Cost[];
      const donors = [...active].filter((n) => costOf.get(n) === cost && roleOf.get(n) === role)
        .sort((a, b) => uftRating.get(a)! - uftRating.get(b)!);
      let done = false;
      for (const nb of neighbours) {
        const takers = [...active].filter((n) => costOf.get(n) === nb && roleOf.get(n) !== role)
          .sort((a, b) => uftRating.get(b)! - uftRating.get(a)!);
        if (donors.length && takers.length) {
          const d = nb < cost ? donors[0] : donors[donors.length - 1];
          const t = nb < cost ? takers[0] : takers[takers.length - 1];
          costOf.set(d, nb); costOf.set(t, cost);
          changed = true; done = true;
          break;
        }
      }
      if (done) break;
    }
  }
  if (!changed) break;
}

for (const [name, cost] of Object.entries(unitOverrides.costOverride)) {
  if (!active.has(name)) throw new Error(`costOverride names "${name}", which is not in the active roster.`);
  costOf.set(name, cost);
}
{
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const n of active) dist[costOf.get(n)!] += 1;
  for (const c of [1, 2, 3, 4, 5] as Cost[]) {
    if (dist[c] !== COST_UNIT_COUNTS[c]) {
      throw new Error(`Cost ${c} has ${dist[c]} units, expected ${COST_UNIT_COUNTS[c]}. Check unit-overrides.json.`);
    }
  }
  console.log(`  cost distribution: ${[1, 2, 3, 4, 5].map((c) => `${c}코=${dist[c]}`).join(' ')}`);
}

// Inactive units still need a nominal cost for the collection screen.
const inactiveCostOf = (n: string): Cost => {
  const r = uftRating.get(n)!;
  if (r >= 0.86) return 5;
  if (r >= 0.72) return 4;
  if (r >= 0.55) return 3;
  if (r >= 0.34) return 2;
  return 1;
};

// ------------------------------------------------------------------ unit defs
const takenIds = new Set<string>();
const units: UnitDef[] = names.map((name) => {
  const h = horseOf(name);
  const isActive = active.has(name);
  const cost: Cost = isActive ? costOf.get(name)! : inactiveCostOf(name);
  const role = roleOf.get(name)!;
  const style = styleOfName.get(name)!;
  const distSlot = distanceSlotOfName.get(name)!;
  const history = historyOfName.get(name)!;
  const unitId = toUnitId(h.nameEn, h.id, takenIds);

  const sp = pSpeed.get(name)!, st = pStamina.get(name)!, po = pPower.get(name)!;
  const gu = pGuts.get(name)!, iq = pIntelligence.get(name)!;

  const hp = roundTo5(BASE_HP[cost] * (0.88 + 0.16 * st + 0.08 * gu));
  const attackDamage = Math.round(BASE_AD[cost] * (0.88 + 0.20 * po + 0.04 * sp));
  const attackSpeed = round2(BASE_AS[cost] * (0.92 + 0.16 * sp));
  const armor = BASE_RESIST[cost] + Math.round(18 * st + 12 * gu);
  const magicResist = BASE_RESIST[cost] + Math.round(16 * iq + 10 * gu);
  const moveSpeedHexPerSec = round2(1.65 + 0.35 * sp);

  // Spec §9.4 — attack range from role, with the oikomi AD-carry exception.
  const attackRange = role === 'TANK' || role === 'BRUISER' ? 1
    : role === 'AP_CARRY' ? 4
    : role === 'AD_CARRY' ? (style === 'oikomi' ? 2 : 3)
    : 3;

  const mana = ROLE_MANA[role];
  const startMana = Math.max(0, mana.start + (RUN_STYLE_START_MANA[style] ?? 0));

  const traits: TraitId[] = [style, distSlot, history];
  // Spec §11 — a 5-cost may carry a fourth trait when its data supports one.
  if (cost === 5) {
    const extra: TraitId | null =
      distSlot !== 'all_rounder' && versatilityScore.get(name)! >= 0.8 ? 'all_rounder'
      : distSlot === 'dirt_champion' ? bestDistance(h)
      : apt(h.aptitudes.surface.dirt) >= 0.74 ? 'dirt_champion'
      : null;
    if (extra && !traits.includes(extra)) traits.push(extra);
  }

  const skill = buildSkill({
    unitId, nameKo: name, role, style, cost,
    power01: pPowerIndex.get(name)!,
    signatureName: h.signature?.name ?? null,
    mainWin: h.historySummary.mainWin,
  });

  return {
    id: unitId,
    horseId: h.id,
    nameKo: name,
    nameJa: h.nameJa,
    nameEn: h.nameEn,
    cost,
    role,
    activeS1: isActive,
    uftRating: round2(uftRating.get(name)!),
    hp, attackDamage,
    abilityPower: DEFAULT_ABILITY_POWER,
    armor, magicResist, attackSpeed,
    attackRange: attackRange as UnitDef['attackRange'],
    moveSpeedHexPerSec,
    critChance: DEFAULT_CRIT_CHANCE,
    critMultiplier: DEFAULT_CRIT_MULTIPLIER,
    startMana,
    maxMana: mana.max,
    traits,
    skillId: skill.id,
    skill,
    source: {
      powerIndex: h.powerIndex,
      stats: h.stats,
      birthYear: h.birthYear,
      signatureId: h.signature?.id ?? '',
      signatureName: h.signature?.name ?? '',
      archetype: h.archetype,
      primaryStyle: style,
      bestDistance: bestDistance(h),
      dataConfidence: h.dataConfidence.history,
      historySummary: {
        starts: h.historySummary.starts,
        wins: h.historySummary.wins,
        mainWin: h.historySummary.mainWin,
        gradeWins: h.historySummary.gradeWins ?? {},
      },
      legacyTier: h.tier,
      legacyStarterCost: h.starterCost,
    },
  };
});

// --------------------------------------------------------------------- output
mkdirSync(OUT, { recursive: true });

const activeUnits = units.filter((u) => u.activeS1);
const rosterHash = createHash('sha256')
  .update(JSON.stringify(activeUnits.map((u) => [u.id, u.cost, u.role, u.traits]).sort()))
  .digest('hex')
  .slice(0, 16);

const write = (file: string, data: unknown): void => {
  writeFileSync(path.join(OUT, file), JSON.stringify(data, null, 2) + '\n');
  console.log(`  wrote ${file}`);
};

write('all-units.json', {
  version: 1,
  sourceSnapshot: db.snapshot,
  rosterHash,
  units,
});

write('active-set-s1.json', {
  version: 1,
  rosterHash,
  size: activeUnits.length,
  costCounts: COST_UNIT_COUNTS,
  poolCopies: POOL_COPIES,
  unitIds: activeUnits.map((u) => u.id),
  byCost: Object.fromEntries(
    ([1, 2, 3, 4, 5] as Cost[]).map((c) => [c, activeUnits.filter((u) => u.cost === c).map((u) => u.id)]),
  ),
});

write('shop-config.json', {
  version: 1,
  slots: 5,
  rerollCost: 2,
  odds: SHOP_ODDS,
  poolCopies: POOL_COPIES,
});

write('traits.json', { version: 1, traits: TRAIT_DEFS });
write('items.json', { version: 1, items: ALL_ITEM_DEFS });
write('augments.json', { version: 1, augments: AUGMENT_DEFS });

const manifest: ArtManifest = {
  version: 1,
  generatedAt: new Date().toISOString(),
  characters: units.map((u) => ({
    id: u.id,
    nameKo: u.nameKo,
    activeS1: u.activeS1,
    cost: u.cost,
    portrait: `portraits/${u.id}.png`,
    battleSheet: `characters/${u.id}.png`,
    cutinRequired: u.activeS1 && u.cost === 5,
  })),
  items: ALL_ITEM_DEFS.map((i) => `items/${i.isComponent ? 'components' : 'complete'}/${i.id}.png`),
  traits: TRAIT_DEFS.map((t) => `traits/${t.id}.png`),
  augments: AUGMENT_DEFS.map((a) => `augments/${a.id}.png`),
  status: [
    'stun', 'silence', 'taunt', 'burn', 'wound', 'shield', 'heal_up', 'damage_up', 'damage_down',
    'armor_up', 'armor_down', 'mr_up', 'mr_down', 'attack_speed_up', 'attack_speed_down',
    'mana_lock', 'untargetable', 'revive', 'overtime', 'win_streak', 'lose_streak',
    'shop_lock', 'reroll', 'xp',
  ].map((s) => `status/${s}.png`),
  vfx: [
    'vfx_hit_physical', 'vfx_hit_magic', 'vfx_crit', 'vfx_heal', 'vfx_shield', 'vfx_burn',
    'vfx_stun', 'vfx_silence', 'vfx_taunt', 'vfx_dash_nige', 'vfx_dash_senko', 'vfx_dash_sashi',
    'vfx_dash_oikomi', 'vfx_line_red', 'vfx_cone_gold', 'vfx_wedge_cyan', 'vfx_arc_violet',
    'vfx_aoe_burst', 'vfx_projectile', 'vfx_execute', 'vfx_buff', 'vfx_debuff', 'vfx_mana',
    'vfx_item_equip',
  ].map((v) => `vfx/${v}.png`),
  starVfx: ['vfx_star_2', 'vfx_star_3', 'vfx_cost5_star3'].map((v) => `vfx/${v}.png`),
  pve: ['training_dummy', 'track_golem', 'supply_robot', 'trophy_guardian', 'grand_trophy_guardian']
    .map((p) => `pve/${p}.png`),
  boards: [
    'bg_title', 'bg_main_menu', 'bg_board_turf_day', 'bg_board_turf_night', 'bg_board_dirt',
    'bg_twinkle_draft', 'bg_pve_training', 'bg_final_result',
  ].map((b) => `boards/${b}.png`),
  ui: ['ui/board_hex_tiles.png', 'ui/ui_frames.png', 'ui/ui_slots.png'],
  banners: [
    'round_start', 'preparation', 'battle', 'overtime', 'victory', 'defeat', 'draw', 'pve',
    'draft', 'augment', 'eliminated', 'champion',
  ].map((b) => `ui/banner_${b}.png`),
};
write('art-manifest.json', manifest);

const cutins = manifest.characters.filter((c) => c.cutinRequired).length;
console.log(`data:build — OK  roster hash ${rosterHash}, ${units.length} units, ${activeUnits.length} active, ${cutins} cut-ins`);
