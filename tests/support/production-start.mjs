import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { WebSocket } from 'ws';

for (const args of [['--import', 'tsx', 'server/index.ts'], ['scripts/serve.mjs'], ['scripts/serve.mjs', '--static']]) {
  test(`production entry: node ${args.join(' ')}`, { timeout: 20000 }, async () => {
    const probe = createServer();
    probe.listen(0, '127.0.0.1');
    await once(probe, 'listening');
    const port = probe.address().port;
    await new Promise(resolve => probe.close(resolve));
    const child = spawn(process.execPath, args, { env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', ROOM_STATE_FILE: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
    const exited = once(child, 'exit');
    let output = '', socket;
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { output += data; });
    const waitFor = async predicate => {
      const deadline = Date.now() + 12000;
      while (!predicate()) {
        assert.equal(child.exitCode, null, output);
        assert.ok(Date.now() < deadline, output || 'Server did not become ready');
        await new Promise(resolve => setTimeout(resolve, 25));
      }
    };
    try {
      await waitFor(() => /server ready|server listening/.test(output));
      const base = `http://127.0.0.1:${port}`;
      assert.equal((await fetch(`${base}/some/route`)).status, 200);
      assert.equal((await fetch(`${base}/assets/missing.mp3`)).status, 404);
      for (const file of ['title', ...Array.from({ length: 23 }, (_, i) => `bgm${String(i).padStart(2, '0')}`)]) {
        const response = await fetch(`${base}/assets/audio/${file}.mp3`, { method: 'HEAD' });
        assert.equal(response.status, 200, file);
        assert.equal(response.headers.get('content-type'), 'audio/mpeg', file);
        assert.ok(Number(response.headers.get('content-length')) > 1000000, file);
      }
      if (args.includes('--static')) return;
      assert.equal((await (await fetch(`${base}/health`)).json()).multiplayer, true);
      socket = new WebSocket(`ws://127.0.0.1:${port}/multiplayer`, { origin: base });
      const messages = [];
      socket.on('message', raw => messages.push(JSON.parse(raw)));
      await once(socket, 'open');
      socket.send(JSON.stringify({ type: 'create', name: 'Startup check', seasonId: 's1' }));
      await waitFor(() => messages.some(m => m.type === 'welcome'));
      socket.send(JSON.stringify({ type: 'addAi' }));
      await waitFor(() => messages.some(m => m.type === 'room' && m.room.seats.some(s => s.ai)));
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
