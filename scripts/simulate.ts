/**
 * Headless balance simulator (spec §37.4).
 *
 *   npm run simulate -- --matches 1000 [--seed 20260907] [--report]
 *
 * With --report it rewrites docs/BALANCE.md from the run.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createMatch, RoundDirector, heldUnits } from '../src/game/engine/rounds/director';
import { countInPlay, totalCopies } from '../src/game/engine/pool';
import { getUnitDef, getUnitTraits, getSeason, getSeasonUnits, getSeasonTraits } from '../src/game/engine/roster';
import { activeTierIndex, getTrait } from '../src/game/engine/traits/trait-defs';
import { AI_PROFILE_IDS } from '../src/game/engine/ai/profiles';
import type { AiProfileId, MatchState } from '../src/game/engine/state';
import type { Cost, TraitId } from '../src/game/engine/types';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0 || i + 1 >= process.argv.length) return fallback;
  const v = Number(process.argv[i + 1]);
  return Number.isFinite(v) ? v : fallback;
}
const MATCHES = arg('matches', 250);
const BASE_SEED = arg('seed', 20260907);
const seasonArg = process.argv.indexOf('--season');
const SEASON = getSeason((seasonArg >= 0 ? process.argv[seasonArg + 1] : 's1') as import('../src/game/engine/seasons/catalog').SeasonId);
const ACTIVE_UNITS = getSeasonUnits(SEASON.id);
const TRAIT_DEFS = getSeasonTraits(SEASON.id);
console.log(`Season ${SEASON.id}: ${SEASON.name}, ${ACTIVE_UNITS.length} units`);
const WRITE_REPORT = process.argv.includes('--report');

type Totals = {
  matches: number;
  endStage: number[];
  rounds: number[];
  threeStarsByCost: Record<Cost, number>;
  placementByProfile: Record<AiProfileId, number[]>;
  traitTop4: Record<string, number>;
  traitTop1: Record<string, number>;
  goldSamples: number[];
  damageSamples: number[];
  unitBought: Record<string, number>;
  poolViolations: number;
  drawCount: number;
  overtimeCount: number;
  battleCount: number;
};

const totals: Totals = {
  matches: 0,
  endStage: [],
  rounds: [],
  threeStarsByCost: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  placementByProfile: AI_PROFILE_IDS.reduce((acc, p) => {
    acc[p] = [];
    return acc;
  }, {} as Record<AiProfileId, number[]>),
  traitTop4: {},
  traitTop1: {},
  goldSamples: [],
  damageSamples: [],
  unitBought: {},
  poolViolations: 0,
  drawCount: 0,
  overtimeCount: 0,
  battleCount: 0,
};

/** Distinct-unit trait counts for a player's fielded board. */
function boardTraitCounts(state: MatchState, playerId: string): Map<TraitId, number> {
  const player = state.players.find((p) => p.id === playerId)!;
  const counts = new Map<TraitId, number>();
  const seen = new Map<TraitId, Set<string>>();
  for (const u of player.board) {
    for (const t of getUnitTraits(u.unitDefId, state.seasonId)) {
      const s = seen.get(t) ?? new Set<string>();
      if (s.has(u.unitDefId)) continue;
      s.add(u.unitDefId);
      seen.set(t, s);
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return counts;
}

const startedAt = Date.now();
for (let m = 0; m < MATCHES; m += 1) {
  const state = createMatch({ seed: BASE_SEED + m * 7919, allAi: true, seasonId: SEASON.id });
  const director = new RoundDirector(state);

  // Sample every prep phase. Sampling only at the end would miss every board
  // an eliminated player ever had, since elimination returns their units to
  // the pool — which is why 3-star rates first read as ~0 across the board.
  const seenThreeStars = new Set<string>();
  const sample = (): void => {
    for (const p of state.players) {
      for (const u of [...p.board, ...p.bench]) {
        const key = `${p.id}:${u.unitDefId}`;
        if (u.star === 3 && !seenThreeStars.has(key)) {
          seenThreeStars.add(key);
          totals.threeStarsByCost[getUnitDef(u.unitDefId).cost] += 1;
        }
        totals.unitBought[u.unitDefId] = (totals.unitBought[u.unitDefId] ?? 0) + 1;
      }
    }
  };

  director.beginPrep();
  sample();
  for (let guard = 0; guard < 120 && !director.isOver; guard += 1) {
    director.resolveRound();
    director.advance();
    sample();
  }

  totals.matches += 1;
  totals.endStage.push(state.stage);
  totals.rounds.push(state.history.length);

  if (countInPlay(state.pool, heldUnits(state)) !== totalCopies(SEASON.id)) totals.poolViolations += 1;

  for (const res of state.history) {
    for (const o of res.outcomes) {
      totals.battleCount += 1;
      if (o.winnerId === null) totals.drawCount += 1;
      if (o.wentToOvertime) totals.overtimeCount += 1;
    }
  }

  for (const p of state.players) {
    if (p.aiProfile) totals.placementByProfile[p.aiProfile].push(p.placement ?? 8);
    totals.goldSamples.push(p.gold);
  }

  // Spec §37.4 asks for a *single* trait's share of top1 boards, so each board
  // contributes one vote: its dominant synergy (highest tier reached, then most
  // units). Counting every active trait would let one board vote 8 times and
  // push every share far above the 25% warning line.
  const standings = state.finalStandings ?? [];
  standings.slice(0, 4).forEach((pid, idx) => {
    const counts = boardTraitCounts(state, pid);
    let dominant: TraitId | null = null;
    let bestTier = -1;
    let bestCount = -1;
    for (const [trait, n] of counts) {
      const tier = activeTierIndex(getTrait(trait), n);
      if (tier < 0) continue;
      if (tier > bestTier || (tier === bestTier && n > bestCount)
        || (tier === bestTier && n === bestCount && dominant !== null && trait < dominant)) {
        dominant = trait; bestTier = tier; bestCount = n;
      }
    }
    if (!dominant) return;
    totals.traitTop4[dominant] = (totals.traitTop4[dominant] ?? 0) + 1;
    if (idx === 0) totals.traitTop1[dominant] = (totals.traitTop1[dominant] ?? 0) + 1;
  });

  for (const res of state.history) {
    for (const d of Object.values(res.damage)) if (d > 0) totals.damageSamples.push(d);
  }

  if ((m + 1) % Math.max(1, Math.floor(MATCHES / 10)) === 0) {
    process.stdout.write(`  ${m + 1}/${MATCHES} matches\r`);
  }
}

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const fmt = (v: number, d = 2): string => v.toFixed(d);
const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

console.log(`\nsimulate — ${MATCHES} matches in ${elapsed}s (seed base ${BASE_SEED})\n`);
console.log(`  average end stage      ${fmt(mean(totals.endStage))}`);
console.log(`  average rounds/match   ${fmt(mean(totals.rounds), 1)}`);
console.log(`  average gold held      ${fmt(mean(totals.goldSamples), 1)}`);
console.log(`  average player damage  ${fmt(mean(totals.damageSamples), 1)}`);
console.log(`  battles                ${totals.battleCount} (draws ${totals.drawCount}, overtime ${totals.overtimeCount})`);
console.log(`  pool conservation      ${totals.poolViolations === 0 ? 'OK' : `${totals.poolViolations} VIOLATIONS`}`);
console.log('\n  3-star completions per match:');
for (const c of [1, 2, 3, 4, 5] as Cost[]) {
  console.log(`    ${c}-cost  ${fmt(totals.threeStarsByCost[c] / MATCHES, 2)}`);
}
console.log('\n  average placement by AI profile:');
const profileAvg: Array<[AiProfileId, number]> = AI_PROFILE_IDS.map(
  (p) => [p, mean(totals.placementByProfile[p])],
);
for (const [p, v] of profileAvg.sort((a, b) => a[1] - b[1])) {
  const flag = v <= 2.5 || v >= 6.5 ? '  <-- outside target band' : '';
  console.log(`    ${p.padEnd(12)} ${fmt(v)}${flag}`);
}

const traitRows = TRAIT_DEFS.map((t) => ({
  id: t.id,
  name: t.name,
  top4: (totals.traitTop4[t.id] ?? 0) / (MATCHES * 4),
  top1: (totals.traitTop1[t.id] ?? 0) / MATCHES,
})).sort((a, b) => b.top1 - a.top1);

console.log('\n  trait presence (top4 / top1 share):');
for (const r of traitRows.slice(0, 10)) {
  const flag = r.top1 > 0.25 ? '  <-- over 25% top1 share' : '';
  console.log(`    ${r.name.padEnd(12)} ${fmt(r.top4 * 100, 1)}% / ${fmt(r.top1 * 100, 1)}%${flag}`);
}

const warnings: string[] = [];
if (totals.poolViolations > 0) warnings.push(`${totals.poolViolations} pool conservation violations`);
for (const [p, v] of profileAvg) {
  if (v <= 2.5 || v >= 6.5) warnings.push(`AI profile ${p} average placement ${fmt(v)} is outside 2.5-6.5`);
}
for (const r of traitRows) {
  if (r.top1 > 0.25) warnings.push(`trait ${r.name} top1 share ${fmt(r.top1 * 100, 1)}% exceeds 25%`);
}

if (warnings.length) {
  console.log('\n  warnings:');
  for (const w of warnings) console.log(`    ! ${w}`);
}

if (WRITE_REPORT) {
  const unitRows = ACTIVE_UNITS.map((u) => ({
    name: u.nameKo, cost: u.cost, rate: (totals.unitBought[u.id] ?? 0) / Math.max(1, totals.rounds.reduce((a, b) => a + b, 0)),
  })).sort((a, b) => b.rate - a.rate);

  const md = `# BALANCE — 시뮬레이션 리포트

> 자동 생성 문서. \`npm run simulate -- --season ${SEASON.id} --matches ${MATCHES} --report\`로 갱신한다.
> 시즌: ${SEASON.id.toUpperCase()} · ${SEASON.name}
> 생성 시각: ${new Date().toISOString()}
> 매치 수: **${MATCHES}** · 기준 시드: \`${BASE_SEED}\` · 소요: ${elapsed}s

## 1. 매치 요약

| 지표 | 값 | 목표 |
|---|---:|---|
| 평균 종료 스테이지 | ${fmt(mean(totals.endStage))} | 5 ~ 7 |
| 평균 라운드 수 | ${fmt(mean(totals.rounds), 1)} | — |
| 평균 보유 골드 | ${fmt(mean(totals.goldSamples), 1)} | — |
| 평균 플레이어 피해 | ${fmt(mean(totals.damageSamples), 1)} | — |
| 전투 수 | ${totals.battleCount} | — |
| 무승부 | ${totals.drawCount} (${fmt((totals.drawCount / Math.max(1, totals.battleCount)) * 100, 1)}%) | — |
| 오버타임 진입 | ${totals.overtimeCount} (${fmt((totals.overtimeCount / Math.max(1, totals.battleCount)) * 100, 1)}%) | — |
| 공유 풀 보존 위반 | ${totals.poolViolations} | 0 |

## 2. 코스트별 3성 완성률 (매치당)

| 코스트 | 실측 | 목표 |
|---:|---:|---|
| 1코 | ${fmt(totals.threeStarsByCost[1] / MATCHES)} | 0.8 ~ 2.5 |
| 2코 | ${fmt(totals.threeStarsByCost[2] / MATCHES)} | 0.5 ~ 1.8 |
| 3코 | ${fmt(totals.threeStarsByCost[3] / MATCHES)} | 0.2 ~ 1.0 |
| 4코 | ${fmt(totals.threeStarsByCost[4] / MATCHES)} | 10매치당 0 ~ 2 |
| 5코 | ${fmt(totals.threeStarsByCost[5] / MATCHES)} | 20매치당 0 ~ 1 |

## 3. AI 성향별 평균 순위

목표 밴드: 2.5 ~ 6.5

| 성향 | 평균 순위 |
|---|---:|
${profileAvg.sort((a, b) => a[1] - b[1]).map(([p, v]) => `| ${p} | ${fmt(v)} |`).join('\n')}

## 4. 특성 점유율

| 특성 | top4 비율 | top1 비율 |
|---|---:|---:|
${traitRows.map((r) => `| ${r.name} | ${fmt(r.top4 * 100, 1)}% | ${fmt(r.top1 * 100, 1)}% |`).join('\n')}

## 5. 활성 유닛 채용률 상위 20

| 유닛 | 코스트 | 매치당 평균 보유 |
|---|---:|---:|
${unitRows.slice(0, 20).map((u) => `| ${u.name} | ${u.cost} | ${fmt(u.rate)} |`).join('\n')}

## 6. 경고

${warnings.length ? warnings.map((w) => `- ${w}`).join('\n') : '- 없음'}
`;
  writeFileSync(path.join(ROOT, 'docs', 'BALANCE.md'), md);
  console.log('\n  wrote docs/BALANCE.md');
}

if (totals.poolViolations > 0) {
  console.error('\nsimulate FAILED — pool conservation violated');
  process.exit(1);
}
console.log('\nsimulate — OK');
