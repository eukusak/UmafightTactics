import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { expect, it } from 'vitest';
import { FRAME_SHEETS, frameGeometry } from '../src/game/ui/frame-animation';

const json = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const review = json('docs/art-source/motions/skill-scale-2026-09-12/review.json');

it('reviews all 145 characters and leaves retained atlases unchanged', () => {
  const units = json('src/data/generated/all-units.json').units as { id: string }[];
  expect(Object.keys(review.units).sort()).toEqual(units.map(u => u.id).sort());
  for (const { id } of units) {
    const decision = review.units[id];
    if (decision.decision === 'retain') expect(hash(readFileSync('public/assets/' + FRAME_SHEETS[id].file))).toBe(decision.baselineRuntimeSha256);
    else expect(decision.decision).toBe('normalize');
  }
});

for (const [id, sheet] of Object.entries(FRAME_SHEETS).filter(([, s]) => s.logicalFrameSize)) {
  it(id + ': enlarges four skill drawings without touching the other twenty or clipping effects', async () => {
    const packing = json(sheet.source), revision = packing.scaleRevision;
    const png = readFileSync('public/assets/' + sheet.file);
    expect(hash(png)).toBe(packing.runtimeSha256);
    expect(revision.baselineRuntimeSha256).toBe(review.units[id].baselineRuntimeSha256);
    expect(revision.factor).toBe(review.units[id].factor);
    expect(revision.changedFrames).toEqual([12, 13, 14, 15]);
    for (let f = 0; f < 24; f++) {
      const left = f % 4 * sheet.frameWidth, top = Math.floor(f / 4) * sheet.frameHeight;
      const frame = await sharp(png).extract({ left, top, width: sheet.frameWidth, height: sheet.frameHeight }).raw().toBuffer();
      // No neighbouring pose or opaque cut edge can leak into the expanded gutter.
      for (let y = 0; y < sheet.frameHeight; y++) for (let x = 0; x < sheet.frameWidth; x++) {
        if (x < 4 || y < 4 || x >= sheet.frameWidth - 4 || y >= sheet.frameHeight - 4) {
          if (frame[(y * sheet.frameWidth + x) * 4 + 3] !== 0) throw Error(`${id}/${f}: nontransparent frame boundary`);
        }
      }
      if (f < 12 || f > 15) {
        const unchanged = await sharp(png).extract({ left: left + revision.padding, top: top + revision.padding, width: 128, height: 128 }).raw().toBuffer();
        expect(hash(unchanged), `${id}/${f}: unchanged pose pixels`).toBe(revision.baselineFrames[f]);
      } else {
        const record = packing.frames[f], [x, y, w, h] = record.destination;
        const [l, t, r, b] = record.crop;
        const expected = await sharp(record.source).extract({ left: l, top: t, width: r - l, height: b - t }).resize(w, h).raw().toBuffer();
        const actual = await sharp(png).extract({ left: x, top: y, width: w, height: h }).raw().toBuffer();
        expect(hash(actual)).toBe(hash(expected));
        const old = json(revision.previousPacking).frames[f].destination;
        expect(Math.abs(w - old[2] * revision.factor)).toBeLessThanOrEqual(.5);
        expect(Math.abs(h - old[3] * revision.factor)).toBeLessThanOrEqual(.5);
      }
    }
  }, 20000);
}

it('keeps body pixels and foot anchors identical in CSS, battle and preview coordinates', () => {
  for (const id of Object.keys(FRAME_SHEETS)) for (const size of [110, 148, 420]) {
    const sheet = FRAME_SHEETS[id], geometry = frameGeometry(id, size);
    expect(geometry.width / sheet.frameWidth).toBeCloseTo(size / 128);
    expect(geometry.height / sheet.frameHeight).toBeCloseTo(size / 128);
    expect(geometry.offsetX + geometry.originX * geometry.width).toBeCloseTo(size / 2);
    expect(geometry.offsetY + geometry.originY * geometry.height).toBeCloseTo(size * 110 / 128);
  }
});
