/** Reproduce the reviewed cinematic cut-ins; preserve source art and aspect ratio. */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const root = fileURLToPath(new URL('../', import.meta.url));
const read = p => JSON.parse(readFileSync(path.join(root, p), 'utf8'));
const cutins = read('src/data/manual/cutins.json');
const required = read('src/data/generated/art-manifest.json').characters.filter(c => c.cutinRequired).map(c => c.id).sort();
assert.deepEqual(Object.keys(cutins).sort(), required);
for (const id of required) {
  const entry = cutins[id];
  const source = readFileSync(path.join(root, entry.source));
  assert.equal(createHash('sha256').update(source).digest('hex'), entry.sourceSha256);
  await sharp(source).resize(960, 540, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha().png().toFile(path.join(root, 'public/assets', entry.file));
}
console.log('Packaged ' + required.length + ' reviewed legendary cut-ins.');
