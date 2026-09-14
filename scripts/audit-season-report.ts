/**
 * Per-season outcome report, from full matches rather than synthetic boards.
 *
 * The matchup matrix builds boards by hand and fights them in isolation. This
 * runs the actual game — real shop, real economy, real AI item and augment
 * choices, real race-plan offers scored per player, real placement — and reports
 * what the finished boards of the top four look like against the bottom four, by
 * season.
 *
 * That is the only way to see whether 각질 and 특성 choices track results, since
 * neither is something a synthetic board chooses: they emerge from what the shop
 * offered and what the player did about it.
 *
 *   npm run audit:seasons -- --matches 24
 */
import { writeFileSync } from 'node:fs';
import { createMatch, RoundDirector } from '../src/game/engine/rounds/director';
import { getUnitTraits } from '../src/game/engine/roster';
import { activeTierIndex, getTrait } from '../src/game/engine/traits/trait-defs';
import { SEASON_IDS, SEASON_THEMES } from '../src/game/engine/seasons/catalog';
import { RUN_STYLES } from '../src/game/engine/race-plan/style-curve';
import { findRacePlanNode } from '../src/game/engine/race-plan/defs';
import type { ResultLineup } from '../src/game/engine/state';
import type { SeasonId } from '../src/game/engine/seasons/catalog';
import type { RunStyle, TraitId } from '../src/game/engine/types';

const arg = (name: string, fallback: number): number => {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 ? Number(process.argv[i + 1]) || fallback : fallback;
};
const MATCHES = arg('matches', 24);

const LINES: string[] = [];
const say = (line = ''): void => { LINES.push(line); console.log(line); };
const width = (s: string): number => [...s].reduce((w, ch) => w + (ch.charCodeAt(0) > 127 ? 2 : 1), 0);
const pad = (s: string, n: number): string => s + ' '.repeat(Math.max(0, n - width(s)));

type Bucket = { top: number; bottom: number };
const rate = (b: Bucket): number => (100 * b.top) / Math.max(1, b.top + b.bottom);

/**
 * Elimination returns every unit to the pool and empties `player.board`, so the
 * live board only survives on the winner. `finalLineup` is the snapshot the
 * result screen shows — the field each player actually died with.
 */
/** Traits a finished board actually had switched on. */
function activeTraits(lineup: ResultLineup, season: SeasonId): TraitId[] {
  const seen = new Map<TraitId, Set<string>>();
  for (const unit of lineup.units) {
    for (const trait of getUnitTraits(unit.unitDefId, season)) {
      const ids = seen.get(trait) ?? new Set<string>();
      ids.add(unit.unitDefId);
      seen.set(trait, ids);
    }
  }
  return [...seen].filter(([id, ids]) => activeTierIndex(getTrait(id), ids.size) >= 0).map(([id]) => id);
}

/** The style a board leaned on: the one it fielded most, if it committed at all. */
function leadStyle(lineup: ResultLineup, season: SeasonId): RunStyle | null {
  const counts = new Map<RunStyle, number>();
  for (const unit of lineup.units) {
    for (const style of RUN_STYLES) {
      if (getUnitTraits(unit.unitDefId, season).includes(style)) {
        counts.set(style, (counts.get(style) ?? 0) + 1);
      }
    }
  }
  const ranked = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return ranked.length && ranked[0][1] >= 3 ? ranked[0][0] : null;
}

say('season report — ' + MATCHES + ' matches per season, full simulation');

const globalStyle = new Map<RunStyle, Bucket>();
const globalPlan = new Map<string, Bucket>();

for (const season of SEASON_IDS as readonly SeasonId[]) {
  const theme = SEASON_THEMES.find((t) => t.id === season)!;
  const styles = new Map<RunStyle, Bucket>();
  const traits = new Map<TraitId, Bucket>();
  const profiles = new Map<string, { sum: number; n: number }>();
  const traitCount = new Map<number, Bucket>();
  const withPlan: Bucket = { top: 0, bottom: 0 };
  const noPlan: Bucket = { top: 0, bottom: 0 };
  let boards = 0;

  for (let m = 0; m < MATCHES; m += 1) {
    const state = createMatch({ seed: 4100 + m * 31, allAi: true, seasonId: season });
    new RoundDirector(state).runToCompletion(60);

    for (const player of state.players) {
      const lineup = player.finalLineup;
      const place = player.placement;
      if (!lineup || !lineup.units.length || !place) continue;
      const isTop = place <= 4;
      boards += 1;

      const profile = player.aiProfile ?? 'BALANCED';
      const entry = profiles.get(profile) ?? { sum: 0, n: 0 };
      entry.sum += place; entry.n += 1;
      profiles.set(profile, entry);

      const style = leadStyle(lineup, season);
      if (style) {
        for (const map of [styles, globalStyle]) {
          const b = map.get(style) ?? { top: 0, bottom: 0 };
          b[isTop ? 'top' : 'bottom'] += 1;
          map.set(style, b);
        }
      }
      const active = activeTraits(lineup, season);
      for (const trait of active) {
        const b = traits.get(trait) ?? { top: 0, bottom: 0 };
        b[isTop ? 'top' : 'bottom'] += 1;
        traits.set(trait, b);
      }
      const bucket = traitCount.get(active.length) ?? { top: 0, bottom: 0 };
      bucket[isTop ? 'top' : 'bottom'] += 1;
      traitCount.set(active.length, bucket);

      const plan = player.racePlan?.planId;
      (plan ? withPlan : noPlan)[isTop ? 'top' : 'bottom'] += 1;
      if (plan) {
        const node = findRacePlanNode(plan);
        const key = node ? node.nameKo : plan;
        const g = globalPlan.get(key) ?? { top: 0, bottom: 0 };
        g[isTop ? 'top' : 'bottom'] += 1;
        globalPlan.set(key, g);
      }
    }
  }

  say('');
  say('== ' + season + ' ' + theme.name + ' — ' + theme.subtitle);
  say('   시즌 포커스 특성: ' + theme.focus.map((f) => getTrait(f).name).join(', ')
    + '   (최종 보드 ' + boards + '개)');

  say('  각질별 top4 진입률');
  for (const style of RUN_STYLES) {
    const b = styles.get(style);
    if (!b || b.top + b.bottom < 4) { say('    ' + pad(getTrait(style).name, 6) + '표본 부족'); continue; }
    say('    ' + pad(getTrait(style).name, 6) + rate(b).toFixed(0).padStart(3) + '%   (' + (b.top + b.bottom) + '보드)');
  }

  const ranked = [...traits].filter(([, b]) => b.top + b.bottom >= 6)
    .sort((a, b) => rate(b[1]) - rate(a[1]));
  say('  특성별 top4 진입률 — 상위 5');
  for (const [id, b] of ranked.slice(0, 5)) {
    say('    ' + pad(getTrait(id).name, 12) + rate(b).toFixed(0).padStart(3) + '%   (' + (b.top + b.bottom) + ')');
  }
  say('  특성별 top4 진입률 — 하위 5');
  for (const [id, b] of ranked.slice(-5).reverse()) {
    say('    ' + pad(getTrait(id).name, 12) + rate(b).toFixed(0).padStart(3) + '%   (' + (b.top + b.bottom) + ')');
  }

  say('  활성 특성 수와 성적');
  for (const n of [...traitCount.keys()].sort((a, b) => a - b)) {
    const b = traitCount.get(n)!;
    if (b.top + b.bottom < 4) continue;
    say('    ' + pad(n + '개', 5) + rate(b).toFixed(0).padStart(3) + '%   (' + (b.top + b.bottom) + ')');
  }

  say('  전략(AI 프로필)별 평균 등수');
  for (const [name, v] of [...profiles].sort((a, b) => a[1].sum / a[1].n - b[1].sum / b[1].n)) {
    say('    ' + pad(name, 13) + (v.sum / v.n).toFixed(2));
  }

  // Possession, not placement: four of eight players make top four by
  // definition, so "top-4 rate among plan holders" is exactly 50% whenever
  // everyone holds one and measures nothing at all.
  const held = withPlan.top + withPlan.bottom;
  const none = noPlan.top + noPlan.bottom;
  say('  레이스 플랜 보유율  ' + ((100 * held) / Math.max(1, held + none)).toFixed(0) + '%'
    + '   (보유 ' + held + ' / 미보유 ' + none + ')'
    + (none > 0 ? '   미보유 top4 ' + rate(noPlan).toFixed(0) + '%' : ''));
}

say('');
say('== 전 시즌 통합');
say('  각질별 top4 진입률');
for (const style of RUN_STYLES) {
  const b = globalStyle.get(style);
  if (!b) continue;
  say('    ' + pad(getTrait(style).name, 6) + rate(b).toFixed(0).padStart(3) + '%   (' + (b.top + b.bottom) + '보드)');
}
const planRank = [...globalPlan].filter(([, b]) => b.top + b.bottom >= 8).sort((a, b) => rate(b[1]) - rate(a[1]));
if (planRank.length) {
  say('  출주 계획별 top4 진입률 — 상위 6');
  for (const [name, b] of planRank.slice(0, 6)) {
    say('    ' + pad(name, 14) + rate(b).toFixed(0).padStart(3) + '%   (' + (b.top + b.bottom) + ')');
  }
  say('  하위 4');
  for (const [name, b] of planRank.slice(-4).reverse()) {
    say('    ' + pad(name, 14) + rate(b).toFixed(0).padStart(3) + '%   (' + (b.top + b.bottom) + ')');
  }
}

const out = process.argv.indexOf('--out');
if (out >= 0 && process.argv[out + 1]) {
  writeFileSync(process.argv[out + 1], LINES.join('\n') + '\n');
  console.log('\nwrote ' + process.argv[out + 1]);
}
