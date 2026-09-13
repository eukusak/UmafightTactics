import { writeFileSync } from 'node:fs';
import { createMatch, RoundDirector, heldUnits } from '../src/game/engine/rounds/director';
import { countInPlay, totalCopies } from '../src/game/engine/pool';
import { SEASON_IDS } from '../src/game/engine/seasons/catalog';
import { getSeasonUnits } from '../src/game/engine/roster';
const matches = Number(process.argv[2] ?? 20);
const rows = [];
for (const seasonId of SEASON_IDS) {
  let rounds = 0, battles = 0, overtime = 0, draws = 0, violations = 0;
  const profiles: Record<string, number[]> = {}, styles: Record<string, { boards: number; top4: number }> = {};
  for (let i = 0; i < matches; i++) {
    const state = createMatch({ seed: 20260913 + i * 7919, allAi: true, seasonId });
    const director = new RoundDirector(state); director.runToCompletion();
    rounds += state.history.length;
    violations += Number(countInPlay(state.pool, heldUnits(state)) !== totalCopies(seasonId));
    for (const p of state.players) {
      (profiles[p.aiProfile!] ??= []).push(p.placement!);
      const units = p.finalLineup?.units ?? p.board;
      for (const style of ['nige', 'senko', 'sashi', 'oikomi']) {
        const roster = getSeasonUnits(seasonId);
        const count = new Set(units.filter(u => roster.find(d => d.id === u.unitDefId)?.traits.includes(style as never)).map(u => u.unitDefId)).size;
        if (count >= 2) { const row = styles[style] ??= { boards: 0, top4: 0 }; row.boards++; row.top4 += Number(p.placement! <= 4); }
      }
    }
    for (const round of state.history) for (const outcome of round.outcomes) { battles++; overtime += Number(outcome.wentToOvertime); draws += Number(outcome.winnerId === null); }
  }
  const row = { seasonId, matches, averageRounds: rounds / matches, battles, overtimeRate: overtime / battles, drawRate: draws / battles, poolViolations: violations, profiles: Object.fromEntries(Object.entries(profiles).map(([k,v]) => [k, v.reduce((a,b)=>a+b,0)/v.length])), styles };
  rows.push(row); console.log(JSON.stringify(row));
}
writeFileSync(process.argv[3] ?? 'docs/qa/augment-expansion-after.json', JSON.stringify({ seed: 20260913, note: 'Seeded all-AI sample; diagnostic comparisons, not human ladder win rates.', rows }, null, 2) + '\n');
