import { createServer } from 'node:http';
import { WebSocket } from 'ws';
import { expect, it } from 'vitest';
import { attachMultiplayer } from '../server/index';
import { RoomService } from '../server/rooms';
import type { ClientMessage, ServerMessage } from '../src/game/network/protocol';

it('carries eight independent clients from lobby to private live battles over WebSocket', async () => {
  let now = 1000;
  const rooms = new RoomService(() => now);
  const server = createServer();
  const { wss } = attachMultiplayer(server, rooms);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No port');
  const origin = `http://127.0.0.1:${address.port}`;
  const clients: Array<{ ws: WebSocket; messages: ServerMessage[] }> = [];
  const waitFor = async (condition: () => boolean) => {
    const deadline = Date.now() + 5000;
    while (!condition()) { if (Date.now() >= deadline) throw new Error('Timed out waiting for WebSocket state'); await new Promise((r) => setTimeout(r, 10)); }
  };
  const send = (i: number, message: ClientMessage) => clients[i].ws.send(JSON.stringify(message));
  try {
    for (let i = 0; i < 8; i++) {
      const ws = new WebSocket(`${origin.replace('http:', 'ws:')}/multiplayer`, { origin });
      const messages: ServerMessage[] = []; ws.on('message', (raw) => messages.push(JSON.parse(raw.toString()) as ServerMessage));
      clients.push({ ws, messages });
      await new Promise<void>((r, reject) => { ws.once('open', r); ws.once('error', reject); });
      const code = [...rooms.rooms.keys()][0];
      send(i, i ? { type: 'join', name: `Player ${i + 1}`, code } : { type: 'create', name: 'Player 1' });
      await waitFor(() => messages.some((m) => m.type === 'welcome'));
    }
    for (let i = 0; i < 8; i++) send(i, { type: 'ready', ready: true });
    const room = [...rooms.rooms.values()][0];
    await waitFor(() => room.seats.every((s) => s.ready));
    send(0, { type: 'start', fillAi: false });
    await waitFor(() => !!room.director);
    for (let i = 0; i < 20 && room.director!.state.phase !== 'BATTLE'; i++) { now = room.deadline + 1; rooms.tick(); }
    expect(room.director!.state.phase).toBe('BATTLE');
    now = room.battleStarted + 1500; rooms.tick();
    await waitFor(() => clients.every((c) => c.messages.some((m) => m.type === 'frames' && m.time >= 1.5)));
    for (const [i, client] of clients.entries()) {
      const m = client.messages.filter((m) => m.type === 'state').at(-1)!;
      expect(m.playerId).toBe(`p${i + 1}`);
      const batch = client.messages.filter((m) => m.type === 'frames').at(-1)!;
      expect(batch.frames.some((f) => f.units.some((u) => u.id.startsWith(`${m.playerId}#`)))).toBe(true);
      expect(batch.frames.every((f) => f.t <= batch.time)).toBe(true);
    }
    clients[0].ws.send('{invalid json');
    await waitFor(() => clients[0].messages.at(-1)?.type === 'error');
    expect(clients[0].ws.readyState).toBe(WebSocket.OPEN);
  } finally {
    clients.forEach((c) => c.ws.terminate()); for (const ws of wss.clients) ws.terminate();
    await new Promise<void>((r) => server.close(() => r()));
  }
});
