/**
 * Builds the site during install, but only on Render.
 *
 * Render's default build command for a Node project is `yarn` / `npm install`,
 * which installs and nothing else, so no dist/ is ever produced. Building from
 * the start command instead does not work: the runtime instance is far smaller
 * than the build machine, and this build needs roughly 500MB of heap — on a
 * 512MB instance it thrashes GC for two minutes and then dies with
 * "Reached heap limit Allocation failed", crash-looping the service.
 *
 * Install runs on the build machine, so that is where the build belongs.
 * Guarded on RENDER so a local `npm ci` never triggers a build.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (!process.env.RENDER) process.exit(0);
if (existsSync(path.join(ROOT, 'dist', 'index.html'))) {
  console.log('[render] dist/ already built — skipping the postinstall build.');
  process.exit(0);
}

console.log('[render] building the site during install (the runtime instance cannot build).');

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npm, ['run', 'build'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: {
    ...process.env,
    // Only ever raises the ceiling: the build needs ~500MB and a small
    // container defaults to about 256MB. Left generous so a larger build
    // machine is not capped below its own default.
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --max-old-space-size=1024`.trim(),
  },
});

if (result.status !== 0) {
  console.error(
    '\n[render] The build failed during install.\n' +
      '         If this was an out-of-memory failure, the build machine is too small.\n' +
      '         Use a build machine with sufficient memory for the Node Web Service.\n' +
      '           Build Command: npm ci && npm run build\n' +
      '           Start Command: npm start\n' +
      '         Static Sites cannot host online rooms.\n',
  );
  process.exit(result.status ?? 1);
}
