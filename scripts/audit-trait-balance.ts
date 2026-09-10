/** Paired, mirrored incremental trait calibration; not ladder win rates. */
import { writeFileSync } from 'node:fs';
import { ALL_UNITS } from '../src/game/engine/roster';
import { TRAIT_BY_ID } from '../src/game/engine/traits/trait-defs';
import { BattleEngine, type BattleSideInput } from '../src/game/engine/battle/engine';
import { Rng } from '../src/game/engine/rng';
import type { TraitId } from '../src/game/engine/types';
const seeds = Number(process.argv[2] ?? 8);
const rows = [];
for (const trait of TRAIT_BY_ID.values()) {
  for (const count of trait.thresholds) {
    let wins = 0,
      draws = 0,
      margin = 0,
      duration = 0;
    for (let seed = 0; seed < seeds; seed++) {
      const roster = new Rng(20260910 + seed * 7919)
        .shuffle(ALL_UNITS.filter((u) => !u.traits.includes(trait.id)))
        .slice(0, Math.max(7, count));
      for (const boosted of ['A', 'B'] as const) {
        const side = (team: 'A' | 'B'): BattleSideInput => ({
          playerId: team,
          augments: [],
          tacticianItems: [],
          units: roster.map((u, i) => ({
            instanceId: team + i,
            unitDefId: u.id,
            star: 2,
            items: [],
            position: { q: i % 7, r: i < 4 ? 0 : 2 },
            extraTraits: team === boosted && i < count ? [trait.id as TraitId] : [],
          })),
        });
        const engine = new BattleEngine(side('A'), side('B'), new Rng(20260910 + seed * 7919));
        const result = engine.run();
        wins += Number(result.winner === boosted);
        draws += Number(result.winner === null);
        duration += result.durationSeconds;
        margin += engine.units.reduce(
          (sum, u) => sum + (u.team === boosted ? 1 : -1) * Math.max(0, u.hp),
          0,
        );
      }
    }
    rows.push({
      id: trait.id,
      name: trait.name,
      count,
      battles: seeds * 2,
      winRate: wins / (seeds * 2),
      draws,
      hpMargin: Math.round(margin / (seeds * 2)),
      seconds: duration / (seeds * 2),
    });
  }
}
writeFileSync(
  process.argv[3] ?? 'docs/qa/trait-calibration.json',
  JSON.stringify(
    {
      method:
        'Identical two-star boards; tested trait added to first N units on alternate sides. All other natural traits retained equally. Measures marginal combat power, not real composition win rate. Economy traits need campaign sampling.',
      seed: 20260910,
      seeds,
      rows,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  rows.filter((r) =>
    ['nige', 'senko', 'sashi', 'oikomi', 's1_team', 's2_encore', 's5_vow'].includes(r.id),
  ),
);
