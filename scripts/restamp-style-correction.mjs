/**
 * Re-stamps pinned skill signatures after a provably cosmetic skill change.
 *
 *   node scripts/restamp-style-correction.mjs <unitId> [...]     # run-style correction
 *   node scripts/restamp-style-correction.mjs --copy             # description rewrite, all units
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
];

/** Fields a run-style correction is allowed to move. */
const STYLE_DERIVED = new Set(['vfxKey']);
/**
 * Copy mode. `description` is pure UI text — the review tests' own
 * `motionContract` deletes it before comparing, so rewording a tooltip cannot
 * invalidate a drawing. Anything else in the diff still stops the run.
 */
const COPY_ONLY = new Set(['description']);

const args = process.argv.slice(2);
const copyMode = args.includes('--copy');
const ids = args.filter((a) => a !== '--copy');
if (!copyMode && !ids.length) {
  throw new Error('Usage: node scripts/restamp-style-correction.mjs <unitId> [...] | --copy');
}

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

let copyRestamped = 0;
const allowed = copyMode ? COPY_ONLY : STYLE_DERIVED;
const targets = copyMode
  ? Object.keys(units).filter(
      (id) => committed[id] && JSON.stringify(committed[id].skill) !== JSON.stringify(units[id].skill),
    )
  : ids;
if (copyMode && !targets.length) console.log('no skill copy changed against HEAD');

for (const id of targets) {
  const correction = copyMode ? null : corrections[id];
  if (!copyMode && !correction) throw new Error(`${id}: no entry in running-style-corrections.json`);
  const unit = units[id];
  if (!unit) throw new Error(`${id}: not in all-units.json — run npm run data:build`);
  if (correction && !unit.traits.includes(correction.to)) {
    throw new Error(`${id}: built traits ${unit.traits} do not carry the corrected style ${correction.to}`);
  }

  const before = committed[id]?.skill;
  if (!before) throw new Error(`${id}: not present in the committed build`);
  const differing = Object.keys({ ...before, ...unit.skill }).filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(unit.skill[key]),
  );
  const unexpected = differing.filter((key) => !allowed.has(key));
  if (unexpected.length) {
    throw new Error(
      `${id}: the skill changed beyond ${[...allowed].join('/')} (${unexpected.join(', ')}). ` +
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
    if (correction) {
      entry.styleCorrection = {
        from: correction.from,
        to: correction.to,
        source: correction.source ?? 'evidence',
        reason: correction.reason,
      };
    } else {
      entry.copyRevision = '2026-09-13 · 스킬 설명 문장을 경마 표현으로 재작성. 수치·동작 변화 없음.';
    }
    await writeJson(store.file, data);
    restamped += 1;
  }

  if (correction) {
    console.log(`${id}: ${correction.from} -> ${correction.to}, ${restamped} store(s) re-stamped`);
  } else if (restamped) {
    copyRestamped += 1;
  }
}

if (copyMode) console.log(`copy re-stamp: ${copyRestamped} unit(s) across ${targets.length} changed skill(s)`);

/**
 * Two QA records do not pin the *current* skill, so copy mode fixes them by
 * their own rules rather than stamping the live hash over them.
 *
 *  - adaptive-balance-motion-compatibility records before/after around a power
 *    change; `after` means "what it is now", so it follows the new copy.
 *  - cost-skill-compatibility pins whatever skill was current at that cost
 *    revision, which for some units is a snapshot stored elsewhere. The hash is
 *    recomputed exactly the way the test resolves it.
 */
if (copyMode) {
  const balancePath = 'docs/qa/adaptive-balance-motion-compatibility.json';
  const balance = await readJson(balancePath);
  let balanceUpdated = 0;
  for (const [id, record] of Object.entries(balance.units ?? {})) {
    const skill = units[id]?.skill;
    if (!skill || JSON.stringify(record.after) === JSON.stringify(skill)) continue;
    record.after = skill;
    record.skillSignature = sha256(JSON.stringify(skill));
    balanceUpdated += 1;
  }
  if (balanceUpdated) await writeJson(balancePath, balance);

  // augment-motion-compatibility's `after` is asserted to hash-equal whatever the
  // cost audit resolves as "current", so its copy has to follow the same source.
  const augmentPath = 'docs/qa/augment-motion-compatibility.json';
  const augmentDoc = await readJson(augmentPath);
  let augmentUpdated = 0;
  for (const change of augmentDoc.changes ?? []) {
    const current = balance.units?.[change.id]?.before ?? units[change.id]?.skill;
    if (!current || change.after?.description === current.description) continue;
    change.after.description = current.description;
    augmentUpdated += 1;
  }
  if (augmentUpdated) await writeJson(augmentPath, augmentDoc);

  const costPath = 'docs/qa/trait-progression/cost-skill-compatibility.json';
  const cost = await readJson(costPath);
  const augment = augmentDoc;
  let costUpdated = 0;
  for (const [id, entry] of Object.entries(cost.units ?? {})) {
    const latest = (augment.changes ?? []).find((c) => c.id === id);
    // Same resolution order the test uses.
    const historical = latest?.before ?? balance.units?.[id]?.before ?? units[id]?.skill;
    if (!historical) continue;
    const signature = sha256(JSON.stringify(historical));
    if (entry.skillSignature === signature) continue;
    entry.skillSignature = signature;
    costUpdated += 1;
  }
  if (costUpdated) await writeJson(costPath, cost);
  console.log(`qa records: balance ${balanceUpdated}, augment ${augmentUpdated}, cost-skill ${costUpdated}`);
}
