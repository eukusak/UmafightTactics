import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { FRAME_SHEETS } from '../src/game/ui/frame-animation';
const json = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const sha = (b: string | Buffer) => createHash('sha256').update(b).digest('hex');

it('accounts for every portrait and permits only explicitly approved complete identity replacements', () => {
  const base = 'docs/art-source/motions/identity-revisions-2026-09-12';
  const audit = json(base + '/roster-review.json');
  const units = json('src/data/generated/all-units.json').units as { id: string; skill: unknown }[];
  expect(Object.keys(audit.units).sort()).toEqual(units.map((u) => u.id).sort());
  expect(audit.reviewedCount).toBe(units.length);
  let targets = 0,
    integrated = 0;
  for (const unit of units) {
    const entry = audit.units[unit.id],
      sheet = FRAME_SHEETS[unit.id];
    expect(sha(readFileSync(entry.portrait)), `${unit.id}: portrait changed`).toBe(
      entry.portraitSha256,
    );
    expect(sha(JSON.stringify(unit.skill)), `${unit.id}: skill changed`).toBe(entry.skillSignature);
    const current = sha(readFileSync('public/assets/' + sheet.file));
    const priorToScale = json(sheet.source).scaleRevision?.baselineRuntimeSha256 ?? current;
    if (entry.decision === 'revise') targets++;
    else expect(entry.decision).toBe('retain');
    if (entry.status === 'integrated') {
      integrated++;
      expect(entry.decision).toBe('revise');
      const review = json(entry.revision),
        packing = json(sheet.source);
      expect(review.approved).toBe(true);
      expect(review.frameCount).toBe(24);
      expect(review.identityReview.length).toBeGreaterThan(30);
      expect(packing.identityRevision.review).toBe(entry.revision);
      expect(packing.identityRevision.baselineRuntimeSha256).toBe(entry.baselineRuntimeSha256);
      expect(json(entry.baselinePacking).runtimeSha256).toBe(entry.baselineRuntimeSha256);
      expect(packing.identityRevision.portraitSha256).toBe(entry.portraitSha256);
      expect(packing.identityRevision.changedFrames).toEqual(
        Array.from({ length: 24 }, (_, i) => i),
      );
      expect(packing.identityRevision.alpha.transparentFraction).toBeGreaterThan(0.3);
      expect(packing.identityRevision.alpha.solidFraction).toBeGreaterThan(0.08);
      expect(packing.runtimeSha256).toBe(current);
      expect(entry.runtimeSha256).toBe(priorToScale);
      expect(current).not.toBe(entry.baselineRuntimeSha256);
      const sourcePath = base + '/' + unit.id + '/generated.png';
      const sourceHash = sha(readFileSync(sourcePath));
      for (let i = 0; i < 24; i++) {
        expect(packing.frames[i].sourceFrame).toBe(i);
        expect(packing.frames[i].source).toBe(sourcePath);
        expect(sourceHash).toBe(packing.frames[i].sourceSha256);
      }
    } else {
      expect(entry.status).toBe(entry.decision === 'retain' ? 'retained' : 'pending');
      expect(priorToScale, `${unit.id}: unapproved image changed`).toBe(entry.baselineRuntimeSha256);
    }
  }
  expect(audit.targetCount).toBe(targets);
  expect(audit.integratedCount).toBe(integrated);
  expect(integrated, 'Every selected identity revision must be integrated').toBe(targets);
});
