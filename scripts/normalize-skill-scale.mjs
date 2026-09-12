/** Repack approved source drawings at body scale, with room for wide effects. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
process.chdir(root);
const base = 'docs/art-source/motions/skill-scale-2026-09-12';
const json = async p => JSON.parse(await fs.readFile(p, 'utf8'));
const write = (p, v) => fs.writeFile(p, JSON.stringify(v, null, 2) + '\n');
const hash = data => createHash('sha256').update(data).digest('hex');
const review = await json(base + '/review.json');
const atBaseline = p => execFileSync('git', ['show', review.referenceCommit + ':' + p], { maxBuffer: 16 * 1024 * 1024 });
const baselineRegistry = JSON.parse(atBaseline('src/data/manual/frame-sheets.json'));
const registry = await json('src/data/manual/frame-sheets.json');
const compatibility = await json('docs/art-source/motions/skill-choreography-review.json');
const frameSize = 256, padding = 64, anchor = [128, 174];
for (const [id, decision] of Object.entries(review.units)) {
  if (decision.decision !== 'normalize') continue;
  if (!(decision.factor > 1 && decision.factor <= 1.8)) throw Error('Unreviewed multiplier: ' + id);
  const sheet = registry[id], previousPacking = baselineRegistry[id].source;
  const packing = JSON.parse(atBaseline(previousPacking));
  const runtime = 'public/assets/' + sheet.file;
  const before = atBaseline(runtime);
  if (hash(before) !== packing.runtimeSha256) throw Error('Baseline hash mismatch: ' + id);
  const current = await fs.readFile(runtime), currentPacking = await json(sheet.source);
  if (sheet.skillSignature !== baselineRegistry[id].skillSignature ||
      (hash(current) !== hash(before) && !(currentPacking.scaleRevision?.baselineRuntimeSha256 === hash(before) && currentPacking.runtimeSha256 === hash(current))))
    throw Error('New artwork or skill review exists; refusing stale repack: ' + id);
  const layers = [], frames = [], baselineFrames = [];
  for (let frame = 0; frame < 24; frame++) {
    const col = frame % 4, row = Math.floor(frame / 4);
    const old = packing.frames[frame];
    const oldFrame = await sharp(before).extract({ left: col * 128, top: row * 128, width: 128, height: 128 }).raw().toBuffer();
    baselineFrames.push(hash(oldFrame));
    if (frame < 12 || frame > 15) {
      // Copy pixels exactly; the renderer compensates for the transparent padding.
      layers.push({ input: await sharp(oldFrame, { raw: { width: 128, height: 128, channels: 4 } }).png().toBuffer(), left: col * frameSize + padding, top: row * frameSize + padding });
      const [x, y, w, h] = old.destination;
      frames.push({ ...old, destination: [col * frameSize + padding + x - col * 128, row * frameSize + padding + y - row * 128, w, h] });
      continue;
    }
    const input = await fs.readFile(old.source);
    if (hash(input) !== old.sourceSha256) throw Error('Source changed: ' + id);
    const [l, t, r, b] = old.crop;
    const w = Math.round(old.destination[2] * decision.factor);
    const h = Math.round(old.destination[3] * decision.factor);
    const x = Math.floor(anchor[0] - w / 2), y = anchor[1] - h;
    if (x < 4 || y < 4 || x + w > frameSize - 4 || y + h > frameSize - 4) throw Error('Effect would clip: ' + id + '/' + frame);
    const image = await sharp(input).extract({ left: l, top: t, width: r - l, height: b - t }).resize(w, h).png().toBuffer();
    layers.push({ input: image, left: col * frameSize + x, top: row * frameSize + y });
    frames.push({ ...old, destination: [col * frameSize + x, row * frameSize + y, w, h] });
  }
  // Raw copies avoid alpha premultiplication rounding from compositing, including
  // invisible RGB values in existing transparent pixels.
  const width = frameSize * 4, height = frameSize * 6;
  const pixels = Buffer.alloc(width * height * 4);
  for (const layer of layers) {
    const { data, info } = await sharp(layer.input).raw().toBuffer({ resolveWithObject: true });
    for (let y = 0; y < info.height; y++) data.copy(pixels, ((layer.top + y) * width + layer.left) * 4, y * info.width * 4, (y + 1) * info.width * 4);
  }
  const output = await sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer();
  await fs.writeFile(runtime, output);
  const target = base + '/' + id + '.json';
  await write(target, { ...packing, frameWidth: frameSize, frameHeight: frameSize, columns: 4, rows: 6, anchor, logicalFrameSize: 128, frames, runtimeSha256: hash(output), scaleRevision: { review: base + '/review.json', previousPacking, baselineRuntimeSha256: hash(before), baselineFrames, factor: decision.factor, padding, changedFrames: [12, 13, 14, 15], unchangedFrames: 20 } });
  Object.assign(sheet, { frameWidth: frameSize, frameHeight: frameSize, logicalFrameSize: 128, anchor, source: target });
  compatibility.units[id].runtimeSha256 = hash(output);
  compatibility.units[id].scaleRevision = target;
  console.log(id + ': skill scale x' + decision.factor + ', 20 poses preserved');
}
await write('src/data/manual/frame-sheets.json', registry);
await write('docs/art-source/motions/skill-choreography-review.json', compatibility);
