import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { FRAME_SHEETS } from '../src/game/ui/frame-animation';

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

it('resolves every roster raster review and preserves all retained artwork', () => {
  const units = readJson('src/data/generated/all-units.json').units as {
    id: string;
    skill: unknown;
  }[];
  const audit = readJson('docs/art-source/motions/skill-revisions-2026-09-11/roster-review.json');
  expect(Object.keys(audit.units).sort()).toEqual(units.map((unit) => unit.id).sort());
  expect(audit.reviewedCount).toBe(units.length);
  for (const unit of units) {
    const review = audit.units[unit.id];
    expect(review.skillSignature, unit.id).toBe(sha256(JSON.stringify(unit.skill)));
    expect(review.reason.length, unit.id).toBeGreaterThan(20);
    const sheet = FRAME_SHEETS[unit.id];
    const currentRuntimeHash = sha256(readFileSync(`public/assets/${sheet.file}`));
    const currentPacking = readJson(sheet.source);
    const identity = currentPacking.identityRevision;
    // A later full-atlas identity edit must retain a verifiable chain to this skill review.
    const packing = identity ? readJson(identity.previousPacking) : currentPacking;
    const runtimeHash = identity ? identity.baselineRuntimeSha256 : currentRuntimeHash;
    if (identity) {
      expect(readJson(identity.review).approved, unit.id).toBe(true);
      expect(packing.runtimeSha256, unit.id).toBe(runtimeHash);
      expect(currentPacking.runtimeSha256, unit.id).toBe(currentRuntimeHash);
    }
    if (review.decision === 'retain') {
      expect(review.status, unit.id).toBe('retained');
      expect(runtimeHash, `${unit.id}: retained image changed`).toBe(review.referenceRasterSha256);
    } else {
      expect(review.decision, unit.id).toBe('revise');
      expect(review.status, `${unit.id}: unfinished revision`).toBe('integrated');
      expect(packing.skillRevision.review).toBe(review.revision);
      expect(readJson(review.revision).approved, unit.id).toBe(true);
      expect(packing.runtimeSha256).toBe(runtimeHash);
      expect(runtimeHash).not.toBe(review.referenceRasterSha256);
      expect(packing.skillRevision.unchangedFrames).toBe(20);
    }
  }
});
