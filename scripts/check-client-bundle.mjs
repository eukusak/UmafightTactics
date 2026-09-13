import { readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
const manifest = JSON.parse(await readFile('dist/.vite/manifest.json', 'utf8'));
const visited = new Set();
function visit(key) { if (visited.has(key)) return; visited.add(key); for (const dep of manifest[key].imports ?? []) visit(dep); }
visit('index.html');
const files = [];
for (const key of visited) {
  const file = manifest[key].file, content = await readFile('dist/' + file);
  if (/phaser|BattleScreen|MotionScreen|CollectionScreen/i.test(file)) throw new Error('Heavy screen leaked into initial graph: ' + file);
  files.push({ file, bytes: (await stat('dist/' + file)).size, gzip: gzipSync(content).length });
}
for (const name of ['BattleScreen', 'CollectionScreen', 'MotionScreen']) {
  if (!manifest['src/components/screens/' + name + '.tsx']?.isDynamicEntry) throw new Error(name + ' is not lazy');
}
const gzip = files.reduce((sum, file) => sum + file.gzip, 0);
if (gzip > 220000) throw new Error('Initial JS gzip budget exceeded: ' + gzip);
console.log(JSON.stringify({ files, totalBytes: files.reduce((sum, file) => sum + file.bytes, 0), gzip }, null, 2));
