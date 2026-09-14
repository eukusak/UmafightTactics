import { describe, it, expect } from 'vitest';
import { shouldBuild, buildNodeOptions } from '../scripts/render-postinstall.mjs';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const renderYarn = { RENDER: 'true', npm_lifecycle_event: 'postinstall', npm_config_user_agent: 'yarn/1.22.22 npm/? node/v22.23.2 linux x64' };

describe('Render install-only build compatibility', () => {
  it('builds during Render Yarn Classic postinstall only', () => {
    expect(shouldBuild(renderYarn)).toBe(true);
    for (const env of [
      { ...renderYarn, RENDER: '' }, { ...renderYarn, RENDER: 'false' },
      { ...renderYarn, npm_lifecycle_event: 'start' },
      { ...renderYarn, npm_lifecycle_event: 'build' },
      { ...renderYarn, npm_config_user_agent: 'npm/10.9.4 node/v22.23.2' },
      { ...renderYarn, npm_config_user_agent: '' },
      { ...renderYarn, npm_config_omit: 'optional dev' },
      { ...renderYarn, npm_config_production: 'true' },
      { ...renderYarn, YARN_PRODUCTION: 'true' },
    ]) expect(shouldBuild(env)).toBe(false);
  });
  it('raises low build heap limits while preserving larger limits and other flags', () => {
    expect(buildNodeOptions('--trace-warnings --max-old-space-size=256')).toBe('--trace-warnings --max-old-space-size=256 --max-old-space-size=1024');
    expect(buildNodeOptions('--max_old_space_size 2048')).toBe('--max_old_space_size 2048');
    expect(buildNodeOptions('', 256 * 1024 * 1024)).toBe('--max-old-space-size=1024');
    expect(buildNodeOptions('', 2048 * 1024 * 1024)).toBe('');
  });
});

it('runs the build before deployment, replaces stale output and propagates failures', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'uft-render-install-'));
  try {
    mkdirSync(path.join(directory, 'scripts'));
    for (const file of ['render-postinstall.mjs', 'runtime.mjs'])
      copyFileSync(new URL(`../scripts/${file}`, import.meta.url), path.join(directory, 'scripts', file));
    for (const file of ['typescript/bin/tsc', 'vite/bin/vite.js']) {
      const target = path.join(directory, 'node_modules', file);
      mkdirSync(path.dirname(target), { recursive: true }); writeFileSync(target, '');
    }
    const runner = path.join(directory, 'yarn.cjs');
    writeFileSync(runner, `const fs=require('node:fs');
      if(process.env.FAIL_BUILD)process.exit(23);
      fs.mkdirSync('dist',{recursive:true});
      fs.writeFileSync('dist/index.html','new game');
      fs.writeFileSync('build.json',JSON.stringify({args:process.argv.slice(2),options:process.env.NODE_OPTIONS}));`);
    // Windows env keys are case-insensitive; npm may inherit uppercase aliases.
    // Remove those aliases so the fixture really launches the requested Yarn lifecycle.
    const inherited = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      !/^npm_|^(NODE_ENV|NODE_OPTIONS|RENDER|YARN_PRODUCTION|FAIL_BUILD)$/i.test(key)));
    const env = { ...inherited, ...renderYarn, NODE_ENV: '', NODE_OPTIONS: '--max-old-space-size=256', npm_execpath: runner, npm_config_omit: '', npm_config_production: '', YARN_PRODUCTION: '', FAIL_BUILD: '' };
    const run = (overrides = {}) => spawnSync(process.execPath, ['scripts/render-postinstall.mjs'], { cwd: directory, env: { ...env, ...overrides }, encoding: 'utf8' });
    mkdirSync(path.join(directory, 'dist')); writeFileSync(path.join(directory, 'dist/index.html'), 'stale game');
    const built = run(); expect(built.status, built.stderr).toBe(0);
    expect(readFileSync(path.join(directory, 'dist/index.html'), 'utf8'), built.stdout).toBe('new game');
    expect(JSON.parse(readFileSync(path.join(directory, 'build.json'), 'utf8'))).toEqual({ args: ['run', 'build'], options: '--max-old-space-size=256 --max-old-space-size=1024' });
    expect(run({ FAIL_BUILD: '1' }).status).toBe(23);
    rmSync(path.join(directory, 'dist'), { recursive: true });
    rmSync(path.join(directory, 'build.json'));
    expect(run({ npm_lifecycle_event: 'start' }).status).toBe(0);
    expect(existsSync(path.join(directory, 'dist'))).toBe(false);
    rmSync(path.join(directory, 'node_modules'), { recursive: true });
    expect(run({ NODE_ENV: 'production' }).status).toBe(0);
    expect(existsSync(path.join(directory, 'dist'))).toBe(false);
    expect(run().status).toBe(1);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
