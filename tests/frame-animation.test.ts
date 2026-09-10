import { describe, expect, it } from 'vitest';
import { FRAME_CLIPS, motionFrame } from '../src/game/ui/frame-animation';
import type { AnimationName } from '../src/game/ui/art';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { FRAME_SHEETS } from '../src/game/ui/frame-animation';
import { getUnitDef } from '../src/game/engine/roster';
import '../src/game/engine/battle/pve-units';

describe('generated frame animation playback', () => {
  it('shows the release pose at immediate CAST, while preview includes preparation', () => {
    expect(motionFrame('skill_cast', 0, .24, true)).toBe(14);
    expect(motionFrame('skill_cast', .2, .24, true)).toBe(15);
    expect(motionFrame('skill_cast', 0)).toBe(12);
    expect([0, 1 / 6, 2 / 6, 3 / 6].map(t => motionFrame('skill_cast', t, .24, true, 0))).toEqual([12, 13, 14, 15]);
  });
  it('requires reviewed skill data and a real alpha atlas with traceable source frames', () => {
    for (const [id, sheet] of Object.entries(FRAME_SHEETS)) {
      const skill = getUnitDef(id).skill;
      expect(sheet.skillId).toBe(skill.id);
      expect(sheet.skillSignature, `${id}: skill changed; review drawings`).toBe(createHash('sha256').update(JSON.stringify(skill)).digest('hex'));
      const png = readFileSync(`public/assets/${sheet.file}`);
      expect([png.readUInt32BE(16), png.readUInt32BE(20), png[25]]).toEqual([512, 768, 6]);
      const packing = JSON.parse(readFileSync(sheet.source, 'utf8'));
      if (skill.choreography) {
        expect(sheet.skillCompatibilityReview).toBeDefined();
        const review = JSON.parse(readFileSync(sheet.skillCompatibilityReview!, 'utf8')).units[id];
        expect(review.skillSignature).toBe(sheet.skillSignature);
        expect(review.runtimeSha256).toBe(packing.runtimeSha256);
        expect(review.originalSkill.template).toBe(skill.template);
        expect(review.originalSkill.targetRule).toBe(skill.targetRule);
        expect(createHash('sha256').update(JSON.stringify(review.originalSkill)).digest('hex')).toBe(review.originalSkillSignature);
      }
      expect(createHash('sha256').update(png).digest('hex')).toBe(packing.runtimeSha256);
      expect(packing.frames).toHaveLength(24);
      if (packing.skillRevision) {
        const revision = packing.skillRevision;
        expect(revision.beforeFrames).toHaveLength(24);
        expect(revision.afterFrames).toHaveLength(24);
        expect(revision.changedFrames).toEqual([12, 13, 14, 15]);
        for (let frame = 0; frame < 24; frame++) {
          expect(revision.beforeFrames[frame] !== revision.afterFrames[frame]).toBe(frame >= 12 && frame <= 15);
        }
      }
      for (const frame of packing.frames) {
        expect(existsSync(frame.source)).toBe(true);
        expect(createHash('sha256').update(readFileSync(frame.source)).digest('hex')).toBe(frame.sourceSha256);
      }
    }
  });
  it('synchronizes the strike with slow and fast attack release events', () => {
    for (const release of [.06, .15, .24]) {
      expect(motionFrame('basic_attack', 0, release)).toBe(8);
      expect(motionFrame('basic_attack', release - .0001, release)).toBe(9);
      expect(motionFrame('basic_attack', release, release)).toBe(10);
      expect(motionFrame('basic_attack', release + .13, release)).toBe(11);
    }
  });
  it('never samples another action row when seeking or replaying', () => {
    for (const action of Object.keys(FRAME_CLIPS) as AnimationName[]) {
      const clip = FRAME_CLIPS[action];
      for (const time of [-1, 0, .06, .24, .67, 2, 10000]) {
        const frame = motionFrame(action, time);
        expect(frame).toBeGreaterThanOrEqual(clip.start);
        expect(frame).toBeLessThan(clip.start + clip.count);
        expect(motionFrame(action, time)).toBe(frame);
      }
      if (!clip.loop) expect(motionFrame(action, 10000)).toBe(clip.start + 3);
    }
  });
});
