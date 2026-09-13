/** Compatibility for Render's legacy `yarn` build command (Yarn Classic).
 * npm deployments keep their explicit build step. Never called by start. */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { getHeapStatistics } from 'node:v8';
import { isMainModule } from './runtime.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

export function shouldBuild(env) {
  const omit = (env.npm_config_omit ?? '').split(/[\s,]+/);
  return env.RENDER === 'true' && env.npm_lifecycle_event === 'postinstall'
    && /^yarn\/1\./.test(env.npm_config_user_agent ?? '')
    && !omit.includes('dev') && env.npm_config_production !== 'true'
    && env.YARN_PRODUCTION !== 'true';
}

export function buildNodeOptions(options = '', heapLimit = getHeapStatistics().heap_size_limit) {
  // Raise a small inherited limit only for the build subprocess. Preserve larger
  // explicit limits and unrelated options; the deployed server stays unchanged.
  const limits = [...options.matchAll(/--max[-_]old[-_]space[-_]size(?:=|\s+)(\d+)/g)];
  const limit = limits.length ? Number(limits.at(-1)[1]) * 1024 * 1024 : heapLimit;
  return limit < 1024 * 1024 * 1024 ? `${options} --max-old-space-size=1024`.trim() : options;
}

export function main(env = process.env) {
  if (!shouldBuild(env)) return 0;
  const compiler = path.join(root, 'node_modules/typescript/bin/tsc');
  if (!existsSync(compiler) && env.NODE_ENV === 'production') {
    console.log('[render-build] Production-only install: skipping frontend build. Use start:server.');
    return 0;
  }
  if (!existsSync(compiler) || !existsSync(path.join(root, 'node_modules/vite/bin/vite.js'))) {
    console.error('[render-build] Frontend build dependencies are missing. Set Build Command to npm ci --include=dev && npm run build.');
    return 1;
  }
  if (!env.npm_execpath) {
    console.error('[render-build] Yarn executable is missing from the install lifecycle.');
    return 1;
  }
  // Always rebuild: dist may be stale in a restored Render cache.
  console.log('[render-build] Render yarn install detected; building the game before deployment.');
  const result = spawnSync(process.execPath, [env.npm_execpath, 'run', 'build'], {
    cwd: root, stdio: 'inherit', env: { ...env, NODE_OPTIONS: buildNodeOptions(env.NODE_OPTIONS) },
  });
  if (result.error) console.error('[render-build]', result.error.message);
  if (result.status !== 0) return result.status || 1;
  if (!existsSync(path.join(root, 'dist/index.html'))) {
    console.error('[render-build] Build finished without dist/index.html.');
    return 1;
  }
  console.log('[render-build] dist/index.html is ready. Runtime will only serve the build.');
  return 0;
}

if (isMainModule(import.meta.url)) process.exitCode = main();
