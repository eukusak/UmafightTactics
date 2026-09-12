import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import cutins from '../src/data/manual/cutins.json';
import manifest from '../src/data/generated/art-manifest.json';
import { getSeasonUnits, getUnitDef } from '../src/game/engine/roster';
import { cutinUrl } from '../src/game/ui/art';
import { legendaryFeedback, LEGENDARY_FEEDBACK_SECONDS } from '../src/game/ui/legendary-skill-feedback';
import { skillMotionFrame } from '../src/game/ui/frame-animation';
import { skillTimeline } from '../src/game/engine/battle/skill-timeline';

const retired = ['maruzensky', 'kitasan_black', 'almond_eye'];
describe('current legendary cut-ins', () => {
  it('covers exactly the eight current legendary units in every season without portrait fallbacks', () => {
    for (const season of ['s1', 's2', 's3', 's4', 's5'] as const) {
      const expected = getSeasonUnits(season).filter(u => u.cost === 5).map(u => u.id).sort();
      expect(Object.keys(cutins).sort()).toEqual(expected);
      for (const id of expected) expect(cutinUrl(id, 5)).toContain('/characters/cutin/' + id + '.png');
    }
    for (const c of manifest.characters) expect(c).not.toHaveProperty('cutinPortrait');
    for (const id of retired) {
      expect(cutinUrl(id, getUnitDef(id).cost)).toBeNull();
      expect(existsSync('public/assets/characters/cutin/' + id + '.png')).toBe(false);
      expect(existsSync('public/assets/portraits/' + id + '.png')).toBe(true);
    }
  });
  it('packages the reviewed full source without stretching or cropping faces', async () => {
    for (const c of Object.values(cutins)) {
      const source = readFileSync(c.source);
      expect(createHash('sha256').update(source).digest('hex')).toBe(c.sourceSha256);
      const packed = sharp('public/assets/' + c.file);
      const metadata = await packed.metadata();
      expect([metadata.width, metadata.height, metadata.hasAlpha]).toEqual([960, 540, true]);
      const alpha = await packed.extract({ left: 0, top: 0, width: 75, height: 540 }).extractChannel(3).raw().toBuffer();
      expect(alpha.every(value => value === 0)).toBe(true);
      const expected = await sharp(source).resize(960, 540, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).ensureAlpha().raw().toBuffer();
      expect((await sharp('public/assets/' + c.file).raw().toBuffer()).equals(expected)).toBe(true);
    }
  });
});

it('limits extra release effects to reviewed five-cost units and real release time', () => {
  for (const id of ['buena_vista', 'taiki_shuttle']) {
    expect(legendaryFeedback(id, 5, -.001)).toBeNull();
    expect(legendaryFeedback(id, 5, 0)?.alpha).toBe(1);
    expect(legendaryFeedback(id, 5, LEGENDARY_FEEDBACK_SECONDS)).toBeNull();
    expect(legendaryFeedback(id, 4, 0)).toBeNull();
    const skill = getUnitDef(id).skill;
    const release = skillTimeline(skill)[0].at;
    expect(skillMotionFrame(skill, release - .001)).toBe(13);
    expect(skillMotionFrame(skill, release)).toBe(14);
    expect(skillMotionFrame(skill, release + .17)).toBe(15);
  }
  expect(legendaryFeedback('mihono_bourbon', 5, 0)).toBeNull();
});
