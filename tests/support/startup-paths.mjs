import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { WebSocket } from 'ws';

const root = fileURLToPath(new URL('../../', import.meta.url));
const temporary = mkdtempSync(join(tmpdir(), 'uft-startup-'));
const linked = join(temporary, 'project src');
symlinkSync(root, linked, process.platform === 'win32' ? 'junction' : 'dir');
after(() => rmSync(temporary, { recursive: true, force: true }));

for (const directory of [root, linked]) {
  for (const entry of ['server/index.ts', 'scripts/serve.mjs']) {
    test('Render startup: ' + (directory === root ? 'real' : 'symlink') + ' ' + entry, { timeout: 15000 }, async () => {
      const probe = createServer();
      probe.listen(0, '127.0.0.1');
      await once(probe, 'listening');
      const port = probe.address().port;
      await new Promise(resolve => probe.close(resolve));
      const args = entry.endsWith('.ts') ? ['--import', 'tsx', join(directory, entry)] : [join(directory, entry)];
      const child = spawn(process.execPath, args, {
        cwd: directory,
        // An inherited hostname must not override Render's public bind address.
        env: { ...process.env, RENDER: 'true', HOST: 'invalid-host.example', PORT: String(port), ROOM_STATE_FILE: '' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const exited = once(child, 'exit');
      let output = '', socket;
      child.stdout.on('data', data => { output += data; });
      child.stderr.on('data', data => { output += data; });
      const waitFor = async predicate => {
        const deadline = Date.now() + 10000;
        while (!predicate()) {
          assert.equal(child.exitCode, null, output || 'Server exited without binding a port');
          assert.ok(Date.now() < deadline, output || 'No startup log');
          await new Promise(resolve => setTimeout(resolve, 25));
        }
      };
      try {
        await waitFor(() => output.includes('server ready on http://0.0.0.0:' + port));
        const base = 'http://127.0.0.1:' + port;
        assert.deepEqual(await (await fetch(base + '/health')).json(), { ok: true, multiplayer: true });
        socket = new WebSocket('ws://127.0.0.1:' + port + '/multiplayer', { origin: base });
        const messages = [];
        socket.on('message', raw => messages.push(JSON.parse(raw)));
        await once(socket, 'open');
        socket.send(JSON.stringify({ type: 'create', name: 'Render startup', seasonId: 's1' }));
        await waitFor(() => messages.some(m => m.type === 'welcome'));
        socket.send(JSON.stringify({ type: 'addAi' }));
        socket.send(JSON.stringify({ type: 'ready', ready: true }));
        socket.send(JSON.stringify({ type: 'start', fillAi: true }));
        await waitFor(() => messages.some(m => m.type === 'state'));
        assert.equal(messages.filter(m => m.type === 'room').at(-1).room.seats.filter(s => s.ai).length, 7);
        assert.deepEqual(messages.filter(m => m.type === 'error'), []);
      } finally {
        socket?.terminate();
        child.kill('SIGTERM');
        await exited;
      }
    });
  }
}

test('importing server modules does not open a port', () => {
  const child = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', "await import('./server/index.ts'); await import('./scripts/serve.mjs');"], { cwd: root, timeout: 5000, encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout, '');
});

test('invalid PORT fails with a diagnostic instead of listening on another port', () => {
  const child = spawnSync(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
    cwd: root, timeout: 5000, encoding: 'utf8', env: { ...process.env, PORT: 'invalid', ROOM_STATE_FILE: '' },
  });
  assert.equal(child.status, 1, child.stderr);
  assert.match(child.stderr, /PORT must be an integer/);
});
