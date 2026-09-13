/**
 * Re-stamps the pinned skill signature of units whose run style was corrected.
 *
 *   node scripts/restamp-style-correction.mjs <unitId> [...]
 *
 * Every art review pins sha256(unit.skill) so that a changed skill forces the
 * drawings to be reviewed again. A run-style correction rewrites exactly one
 * style-derived field — `vfxKey`, which selects `vfx_dash_<style>` — and leaves
 * the template, targeting, geometry, timings and choreography alone, so the
 * reviewed poses stay valid. This script proves that is the only difference and
 * then updates the stored signature; it refuses to touch anything else.
 *
 * Run `npm run data:build` first so all-units.json carries the corrected style.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const readJson = async (rel) => JSON.parse(await fs.readFile(path.join(root, rel), 'utf8'));
const writeJson = (rel, value) =>
  fs.writeFile(path.join(root, rel), JSON.stringify(value, null, 2) + '\n');

/** Every store that pins a per-unit skill signature, and how to reach it. */
const STORES = [
  { file: 'src/data/manual/frame-sheets.json', at: (d, id) => d[id] },
  { file: 'docs/art-source/motions/skill-choreography-review.json', at: (d, id) => d.units?.[id] },
  { file: 'docs/art-source/motions/identity-revisions-2026-09-12/roster-review.json', at: (d, id) => d.units?.[id] },
  { file: 'docs/art-source/motions/skill-revisions-2026-09-11/roster-review.json', at: (d, id) => d.units?.[id] },
  { file: 'docs/qa/trait-progression/cost-skill-compatibility.json', at: (d, id) => d.units?.[id] },
];

/** Fields a run-style correction is allowed to move. */
const STYLE_DERIVED = new Set(['vfxKey']);

const ids = process.argv.slice(2);
if (!ids.length) throw new Error('Usage: node scripts/restamp-style-correction.mjs <unitId> [...]');

const corrections = (await readJson('src/data/manual/running-style-corrections.json')).units;
const units = Object.fromEntries(
  (await readJson('src/data/generated/all-units.json')).units.map((u) => [u.id, u]),
);
/**
 * The committed build, which is what every stored signature was taken against.
 * The review files keep their own snapshots, but those are historical records
 * from earlier revisions, so HEAD is the only honest "before" for this change.
 */
const committed = Object.fromEntries(
  JSON.parse(
    execFileSync('git', ['show', 'HEAD:src/data/generated/all-units.json'], {
      cwd: root,
      maxBuffer: 64 * 1024 * 1024,
      encoding: 'utf8',
    }),
  ).units.map((u) => [u.id, u]),
);

for (const id of ids) {
  const correction = corrections[id];
  if (!correction) throw new Error(`${id}: no entry in running-style-corrections.json`);
  const unit = units[id];
  if (!unit) throw new Error(`${id}: not in all-units.json — run npm run data:build`);
  if (!unit.traits.includes(correction.to)) {
    throw new Error(`${id}: built traits ${unit.traits} do not carry the corrected style ${correction.to}`);
  }

  const before = committed[id]?.skill;
  if (!before) throw new Error(`${id}: not present in the committed build`);
  const differing = Object.keys({ ...before, ...unit.skill }).filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(unit.skill[key]),
  );
  const unexpected = differing.filter((key) => !STYLE_DERIVED.has(key));
  if (unexpected.length) {
    throw new Error(
      `${id}: the skill changed beyond the run style (${unexpected.join(', ')}). ` +
        'Review the drawings instead of re-stamping.',
    );
  }

  const signature = sha256(JSON.stringify(unit.skill));
  let restamped = 0;

  for (const store of STORES) {
    const data = await readJson(store.file);
    const entry = store.at(data, id);
    if (!entry?.skillSignature) continue;
    if (entry.skillSignature === signature) continue;

    entry.skillSignature = signature;
    entry.styleCorrection = {
      from: correction.from,
      to: correction.to,
      source: correction.source ?? 'evidence',
      reason: correction.reason,
    };
    await writeJson(store.file, data);
    restamped += 1;
  }

  console.log(`${id}: ${correction.from} -> ${correction.to}, ${restamped} store(s) re-stamped, ${signature.slice(0, 12)}…`);
}
