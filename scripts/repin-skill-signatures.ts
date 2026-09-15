/**
 * Re-pins the skill hashes the art reviews are keyed to, after a pass that
 * changed numbers but not motions.
 *
 * Four files pin `sha256(JSON.stringify(skill))` per unit: the frame sheets and
 * three art-review records. A cost change moves a unit's damage and star
 * multipliers, so every one of those hashes goes stale even though the poses
 * the artist drew are still correct.
 *
 * This refuses to run unless the change review says every motion contract held.
 * That is the safety interlock: if a pose, target rule or timing actually moved,
 * the right answer is new artwork, not a quietly updated hash.
 *
 *   npx tsx scripts/build-roster-change-review.ts   # first, to produce the proof
 *   npx tsx scripts/repin-skill-signatures.ts
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_UNITS } from '../src/game/engine/roster';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REVIEW = path.join(ROOT, 'docs/qa/roster-additions/cost-skill-compatibility-2026-09-15.json');

const hash = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

const review = JSON.parse(readFileSync(REVIEW, 'utf8')) as {
  motionChanged: unknown[]; motionChangedBeforeArt: unknown[];
};
if (review.motionChanged.length) {
  throw new Error(
    `${review.motionChanged.length} unit(s) changed their motion contract with artwork already delivered. `
    + 'Those need new drawings, not a re-pinned hash. See the review record.',
  );
}

const current = new Map(ALL_UNITS.map((u) => [u.id, hash(u.skill)]));
const note = '2026-09-15 로스터 추가 패치: 코스트 재배정으로 스킬 수치만 변경. 몸동작 계약은 동일 — docs/qa/roster-additions/cost-skill-compatibility-2026-09-15.json';

const targets: Array<{ file: string; units: (d: Record<string, unknown>) => Record<string, { skillSignature?: string }> }> = [
  { file: 'src/data/manual/frame-sheets.json', units: (d) => d as never },
  { file: 'docs/art-source/motions/skill-choreography-review.json', units: (d) => d.units as never },
  { file: 'docs/art-source/motions/skill-revisions-2026-09-11/roster-review.json', units: (d) => d.units as never },
  { file: 'docs/art-source/motions/identity-revisions-2026-09-12/roster-review.json', units: (d) => d.units as never },
];

for (const target of targets) {
  const full = path.join(ROOT, target.file);
  const parsed = JSON.parse(readFileSync(full, 'utf8')) as Record<string, unknown>;
  const units = target.units(parsed);
  let changed = 0;
  for (const [id, entry] of Object.entries(units)) {
    const now = current.get(id);
    if (!now || !entry || typeof entry !== 'object') continue;
    if (entry.skillSignature === now) continue;
    entry.skillSignature = now;
    (entry as Record<string, unknown>).costBalanceReview = note;
    changed += 1;
  }
  writeFileSync(full, JSON.stringify(parsed, null, 2) + '\n');
  console.log(`  ${target.file}: re-pinned ${changed}`);
}

// The adaptive-balance record stores the terminal skill, not just its hash.
const adaptive = path.join(ROOT, 'docs/qa/adaptive-balance-motion-compatibility.json');
const parsed = JSON.parse(readFileSync(adaptive, 'utf8')) as { units: Record<string, { after: unknown; skillSignature: string }> };
let moved = 0;
for (const [id, record] of Object.entries(parsed.units)) {
  const unit = ALL_UNITS.find((u) => u.id === id);
  if (!unit || hash(record.after) === hash(unit.skill)) continue;
  // `before` stays as history; only the terminal state moves forward.
  record.after = unit.skill;
  record.skillSignature = hash(unit.skill);
  (record as Record<string, unknown>).rosterAdditionsPass = note;
  moved += 1;
}
writeFileSync(adaptive, JSON.stringify(parsed, null, 2) + '\n');
console.log(`  docs/qa/adaptive-balance-motion-compatibility.json: moved ${moved} terminal states forward`);

// briefs.json embeds the whole skill next to its signature, so re-pinning the
// hash alone would leave it describing the previous numbers. It is generated,
// not hand-pinned, so it is rebuilt here rather than patched — otherwise the
// only thing that catches the drift is CI's `git diff --exit-code`.
execFileSync('npm', ['run', '--silent', 'art:briefs'], { cwd: ROOT, stdio: 'inherit' });

console.log('repin — OK (모든 몸동작 계약이 유지된 상태에서만 실행됨)');
