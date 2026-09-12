/** Pack a reviewed 24-pose identity replacement; preserve historical packing records. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('sharp');
const root = path.resolve(import.meta.dirname, '..');
process.chdir(root);
const hash = (b) => createHash('sha256').update(b).digest('hex');
const read = async (p) => JSON.parse(await fs.readFile(p, 'utf8'));
const write = (p, v) => fs.writeFile(p, JSON.stringify(v, null, 2) + '\n');
const base = 'docs/art-source/motions/identity-revisions-2026-09-12';
const registry = await read('src/data/manual/frame-sheets.json');
const compatibility = await read('docs/art-source/motions/skill-choreography-review.json');
const audit = await read(base + '/roster-review.json');
for (const id of process.argv.slice(2)) {
  const dir = base + '/' + id,
    spec = await read(dir + '/review.json'),
    entry = audit.units[id];
  if (entry?.decision !== 'revise' || !spec.approved || spec.frameCount !== 24)
    throw Error('Explicit 24-frame approval required: ' + id);
  if (hash(await fs.readFile(entry.portrait)) !== entry.portraitSha256)
    throw Error('Portrait changed: ' + id);
  const source = dir + '/generated.png',
    input = await fs.readFile(source),
    meta = await sharp(input).metadata();
  if (!meta.hasAlpha) throw Error('Real source alpha required: ' + id);
  const { data, info } = await sharp(input).raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 4) throw Error('RGBA required');
  let zero = 0,
    solid = 0;
  for (let i = 3; i < data.length; i += 4) {
    zero += Number(data[i] === 0);
    solid += Number(data[i] >= 240);
  }
  if (zero / (info.width * info.height) < 0.3 || solid / (info.width * info.height) < 0.08)
    throw Error('Invalid foreground/background alpha');
  const crops = [];
  for (let i = 0; i < 24; i++) {
    const [x0, y0, x1, y1] = spec.cells?.[i] ?? [
      Math.floor(((i % 4) * info.width) / 4),
      Math.floor((Math.floor(i / 4) * info.height) / 6),
      Math.floor((((i % 4) + 1) * info.width) / 4),
      Math.floor(((Math.floor(i / 4) + 1) * info.height) / 6),
    ];
    let l = x1,
      t = y1,
      r = x0,
      b = y0,
      count = 0;
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++)
        if (data[(y * info.width + x) * 4 + 3] >= 16) {
          l = Math.min(l, x);
          r = Math.max(r, x + 1);
          t = Math.min(t, y);
          b = Math.max(b, y + 1);
          count++;
        }
    if (count < (x1 - x0) * (y1 - y0) * 0.04) throw Error('Empty pose: ' + id + '/' + i);
    // A touching silhouette may indicate clipping or a pose spanning adjacent cells.
    if (
      (l <= x0 || r >= x1 || t <= y0 || b >= y1) &&
      !spec.reviewedEffectBoundaryFrames?.includes(i)
    )
      throw Error('Pose reaches cell boundary: ' + id + '/' + i);
    crops.push([
      Math.max(x0, l - 2),
      Math.max(y0, t - 2),
      Math.min(x1, r + 2),
      Math.min(y1, b + 2),
    ]);
  }
  const scale = Math.min(
    116 / Math.max(...crops.map((c) => c[2] - c[0])),
    104 / Math.max(...crops.map((c) => c[3] - c[1])),
  );
  const runtime = 'public/assets/' + registry[id].file,
    previous = await fs.readFile(runtime);
  if (hash(previous) !== entry.baselineRuntimeSha256 && entry.status !== 'integrated')
    throw Error('Unexpected baseline: ' + id);
  const previousPacking = entry.baselinePacking;
  const frames = [],
    layers = [];
  for (let i = 0; i < 24; i++) {
    const [l, t, r, b] = crops[i],
      w = Math.round((r - l) * scale),
      h = Math.round((b - t) * scale),
      x = (i % 4) * 128 + Math.floor((128 - w) / 2),
      y = Math.floor(i / 4) * 128 + 110 - h;
    layers.push({
      input: await sharp(input)
        .extract({ left: l, top: t, width: r - l, height: b - t })
        .resize(w, h)
        .png()
        .toBuffer(),
      left: x,
      top: y,
    });
    frames.push({
      frame: i,
      sourceFrame: i,
      source,
      sourceSha256: hash(input),
      crop: crops[i],
      destination: [x, y, w, h],
    });
  }
  const png = await sharp({
    create: { width: 512, height: 768, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(layers)
    .png()
    .toBuffer();
  const packing = {
    format: 'uft-baked-frames-v1',
    columns: 4,
    rows: 6,
    frameWidth: 128,
    frameHeight: 128,
    anchor: [64, 110],
    scale,
    runtimeSha256: hash(png),
    frames,
    identityRevision: {
      review: dir + '/review.json',
      baselineRuntimeSha256: entry.baselineRuntimeSha256,
      previousPacking,
      portrait: entry.portrait,
      portraitSha256: entry.portraitSha256,
      changedFrames: Array.from({ length: 24 }, (_, i) => i),
      alpha: {
        transparentFraction: zero / (info.width * info.height),
        solidFraction: solid / (info.width * info.height),
      },
    },
  };
  await fs.writeFile(runtime, png);
  await write(dir + '/packing.json', packing);
  registry[id].source = dir + '/packing.json';
  registry[id].skillReview = spec.skillReview;
  compatibility.units[id].runtimeSha256 = hash(png);
  compatibility.units[id].identityRevision = dir + '/review.json';
  entry.status = 'integrated';
  entry.revision = dir + '/review.json';
  entry.runtimeSha256 = hash(png);
  console.log(id + ': approved identity in all 24 frames');
}
await write('src/data/manual/frame-sheets.json', registry);
await write('docs/art-source/motions/skill-choreography-review.json', compatibility);
await write(base + '/roster-review.json', audit);
