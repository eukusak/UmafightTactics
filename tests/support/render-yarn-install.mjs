/** Run with Yarn Classic: yarn run test:render-install. No registry dependencies. */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

assert.match(process.env.npm_config_user_agent ?? '', /^yarn\/1\./, 'Run with Yarn Classic');
const directory = mkdtempSync(path.join(tmpdir(), 'uft-yarn-install-'));
try {
  mkdirSync(path.join(directory, 'scripts'));
  for (const file of ['render-postinstall.mjs', 'runtime.mjs'])
    copyFileSync(new URL(`../../scripts/${file}`, import.meta.url), path.join(directory, 'scripts', file));
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  const devDependencies = {};
  for (const [name, file] of [['typescript', 'bin/tsc'], ['vite', 'bin/vite.js']]) {
    const folder = path.join(directory, name);
    mkdirSync(path.join(folder, 'bin'), { recursive: true });
    writeFileSync(path.join(folder, 'package.json'), JSON.stringify({ name, version: '1.0.0' }));
    writeFileSync(path.join(folder, file), '');
    devDependencies[name] = `file:./${name}`;
  }
  writeFileSync(path.join(directory, 'package.json'), JSON.stringify({
    name: 'render-install-fixture', version: '1.0.0', private: true,
    scripts: { postinstall: pkg.scripts.postinstall, build: 'node build.cjs' }, devDependencies,
  }));
  writeFileSync(path.join(directory, 'build.cjs'), `const fs=require('node:fs');
    if(process.env.FAIL_BUILD)process.exit(23);
    fs.mkdirSync('dist',{recursive:true}); fs.writeFileSync('dist/index.html','built by install');`);
  const install = (fail = '') => spawnSync(process.execPath, [process.env.npm_execpath, '--offline', '--non-interactive'], {
    cwd: directory, encoding: 'utf8', timeout: 30000,
    env: { ...process.env, RENDER: 'true', NODE_ENV: '', NODE_OPTIONS: '--max-old-space-size=256', npm_config_production: '', npm_config_omit: '', YARN_PRODUCTION: '', FAIL_BUILD: fail },
  });
  for (const cached of [false, true]) {
    if (cached) writeFileSync(path.join(directory, 'dist/index.html'), 'stale cached build');
    const result = install();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(readFileSync(path.join(directory, 'dist/index.html'), 'utf8'), 'built by install');
    assert.match(result.stdout, /dist\/index.html is ready/);
  }
  const failed = install('1');
  assert.notEqual(failed.status, 0, failed.stdout + failed.stderr);
  assert.match(failed.stdout + failed.stderr, /23/);
  console.log('Render default yarn install: PASS (clean output, stale cache rebuild, build failure blocks deployment)');
} finally { rmSync(directory, { recursive: true, force: true }); }
