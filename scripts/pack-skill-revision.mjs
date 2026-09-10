/** Pack four generated transparent poses into skill row only. Requires sharp. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('sharp');
const root = path.resolve(import.meta.dirname, '..');
const hash = (data) => createHash('sha256').update(data).digest('hex');
const registryPath = path.join(root, 'src/data/manual/frame-sheets.json');
const registry = JSON.parse(await fs.readFile(registryPath, 'utf8'));
const reviewsPath = path.join(root, 'docs/art-source/motions/skill-choreography-review.json');
const reviews = JSON.parse(await fs.readFile(reviewsPath, 'utf8'));
const revisionDate = process.env.SKILL_REVISION_DATE ?? '2026-09-10';
if (!/^\d{4}-\d{2}-\d{2}$/.test(revisionDate)) throw Error('Invalid revision date');
for (const id of process.argv.slice(2)) {
  const dir = `docs/art-source/motions/skill-revisions-${revisionDate}/` + id;
  const spec = JSON.parse(await fs.readFile(path.join(root, dir, 'review.json'), 'utf8'));
  if (!spec.approved) throw Error('Unreviewed poses: ' + id);
  const source = dir + '/generated.png';
  const input = await fs.readFile(path.join(root, source));
  const meta = await sharp(input).metadata();
  if (!meta.hasAlpha) throw Error('Generated alpha required');
  const { data, info } = await sharp(input).raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 4) throw Error('RGBA required');
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) transparent += Number(data[i] === 0);
  if (transparent < info.width * info.height * 0.3) throw Error('Opaque background');
  const crops = spec.cells.map(([x0, y0, x1, y1]) => {
    let l = x1,
      t = y1,
      r = x0,
      b = y0;
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++)
        if (data[(y * info.width + x) * 4 + 3] >= 16) {
          l = Math.min(l, x);
          r = Math.max(r, x + 1);
          t = Math.min(t, y);
          b = Math.max(b, y + 1);
        }
    if (r <= l || b <= t) throw Error('Empty cell');
    return [Math.max(x0, l - 3), Math.max(y0, t - 3), Math.min(x1, r + 3), Math.min(y1, b + 3)];
  });
  const scale = Math.min(
    116 / Math.max(...crops.map((c) => c[2] - c[0])),
    104 / Math.max(...crops.map((c) => c[3] - c[1])),
  );
  const target = path.join(root, 'public/assets', registry[id].file);
  const generation = JSON.parse(await fs.readFile(path.join(root, dir, 'generation.json'), 'utf8'));
  const baseline = execFileSync(
    'git',
    ['show', generation.referenceCommit + ':public/assets/' + registry[id].file],
    { cwd: root, maxBuffer: 8 * 1024 * 1024 },
  );
  const before = await sharp(baseline).raw().toBuffer();
  const current = await sharp(target).raw().toBuffer();
  if (
    !before.subarray(0, 384 * 512 * 4).equals(current.subarray(0, 384 * 512 * 4)) ||
    !before.subarray(512 * 512 * 4).equals(current.subarray(512 * 512 * 4))
  )
    throw Error('Non-skill rows changed since review; refusing to overwrite');
  const output = Buffer.from(before);
  const packing = JSON.parse(await fs.readFile(path.join(root, registry[id].source), 'utf8'));
  const beforeFrames = [];
  const frameBytes = (raw, i) => {
    const b = Buffer.alloc(128 * 128 * 4);
    for (let y = 0; y < 128; y++)
      raw.copy(
        b,
        y * 512,
        (((i >> 2) * 128 + y) * 512 + (i % 4) * 128) * 4,
        (((i >> 2) * 128 + y) * 512 + (i % 4) * 128 + 128) * 4,
      );
    return b;
  };
  for (let i = 0; i < 24; i++) beforeFrames.push(hash(frameBytes(before, i)));
  for (let i = 0; i < 4; i++) {
    const [l, t, r, b] = crops[i];
    const w = Math.round((r - l) * scale),
      h = Math.round((b - t) * scale);
    const raw = await sharp(input)
      .extract({ left: l, top: t, width: r - l, height: b - t })
      .resize(w, h)
      .raw()
      .toBuffer();
    const x = i * 128 + Math.floor((128 - w) / 2),
      y = 384 + 110 - h;
    for (let yy = 384; yy < 512; yy++)
      output.fill(0, (yy * 512 + i * 128) * 4, (yy * 512 + (i + 1) * 128) * 4);
    for (let yy = 0; yy < h; yy++)
      raw.copy(output, ((y + yy) * 512 + x) * 4, yy * w * 4, (yy + 1) * w * 4);
    packing.frames[12 + i] = {
      frame: 12 + i,
      sourceFrame: i,
      source,
      sourceSha256: hash(input),
      crop: crops[i],
      destination: [x, y, w, h],
    };
  }
  const afterFrames = Array.from({ length: 24 }, (_, i) => hash(frameBytes(output, i)));
  for (let i = 0; i < 24; i++)
    if ((beforeFrames[i] !== afterFrames[i]) !== (i >= 12 && i <= 15))
      throw Error('Unexpected frame change ' + i);
  await sharp(output, { raw: { width: 512, height: 768, channels: 4 } })
    .png()
    .toFile(target + '.new.png');
  await fs.rename(target + '.new.png', target);
  packing.runtimeSha256 = hash(await fs.readFile(target));
  packing.skillRevision = {
    scale,
    review: dir + '/review.json',
    beforeFrames,
    afterFrames,
    unchangedFrames: 20,
    changedFrames: [12, 13, 14, 15],
  };
  await fs.writeFile(path.join(root, dir, 'packing.json'), JSON.stringify(packing, null, 2) + '\n');
  registry[id].source = dir + '/packing.json';
  registry[id].skillReview = spec.skillReview;
  reviews.units[id].runtimeSha256 = packing.runtimeSha256;
  reviews.units[id].rasterRevision = dir + '/review.json';
  console.log(id + ': four skill frames replaced, twenty unchanged, alpha preserved');
}
await fs.writeFile(registryPath, JSON.stringify(registry, null, 2) + '\n');
await fs.writeFile(reviewsPath, JSON.stringify(reviews, null, 2) + '\n');
