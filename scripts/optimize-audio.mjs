/** Build-only encoding. Source recordings stay untouched in public/assets/audio. */
import { readFile, stat, rename, unlink, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import ffmpeg from 'ffmpeg-static';
const root = fileURLToPath(new URL('../', import.meta.url));
const music = JSON.parse(await readFile(path.join(root, 'src/data/manual/music.json'), 'utf8'));
if (!ffmpeg) throw new Error('A supported ffmpeg build is required for the static site build');
const report = [];
const cache = path.join(root, '.cache/audio-160k-v1');
await mkdir(cache, { recursive: true });
for (const url of [music.title, ...music.bgm].filter(Boolean)) {
  if (!/^\/assets\/audio\/[^/]+\.mp3$/.test(url)) throw new Error('Invalid music manifest path');
  const source = path.join(root, 'public', url), output = path.join(root, 'dist', url), temporary = output + '.encoding.mp3';
  const sourceHash = createHash('sha256').update(await readFile(source)).digest('hex');
  const cached = path.join(cache, sourceHash + '.mp3');
  const before = (await stat(source)).size;
  const cachedSize = await stat(cached).then(s => s.size, () => 0);
  if (cachedSize > 0 && cachedSize < before) {
    await copyFile(cached, output);
    report.push({ file: url, sourceBytes: before, deployedBytes: cachedSize, targetKbps: 160 });
    continue;
  }
  const args = ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', source, '-map', '0:a:0', '-vn', '-c:a', 'libmp3lame', '-b:a', '160k', '-map_metadata', '-1', temporary];
  await new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] }); let error = '';
    child.stderr.on('data', chunk => { error += chunk; }); child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error('Audio encoding failed: ' + error)));
  });
  const after = (await stat(temporary)).size;
  if (after < before) { await unlink(output); await rename(temporary, output); await copyFile(output, cached + '.tmp'); await rename(cached + '.tmp', cached); } else await unlink(temporary);
  report.push({ file: url, sourceBytes: before, deployedBytes: Math.min(before, after), targetKbps: 160 });
}
await writeFile(path.join(root, 'dist/audio-build-report.json'), JSON.stringify(report, null, 2));
const total = key => report.reduce((sum, item) => sum + item[key], 0);
console.log('[audio] ' + report.length + ' tracks: ' + total('sourceBytes') + ' -> ' + total('deployedBytes') + ' bytes; source audio retained');
