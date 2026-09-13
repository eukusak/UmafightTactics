import { createServer } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { originPolicy } from '../server/origins';
import { multiplayerUrl } from '../src/game/network/endpoint';
import { RoomService, type Peer } from '../server/rooms';
import { attachMultiplayer } from '../server/index';
import type { ServerMessage } from '../src/game/network/protocol';

const page = { protocol: 'https:', host: 'game.example', hostname: 'game.example' };
describe('split service endpoints', () => {
  it('requires an explicit remote endpoint and uses local same-origin only for development', () => {
    expect(multiplayerUrl('wss://server.example/multiplayer', page)).toBe('wss://server.example/multiplayer');
    expect(multiplayerUrl('', { protocol: 'http:', host: 'localhost:5173', hostname: 'localhost' })).toBe('ws://localhost:5173/multiplayer');
    for (const bad of ['', 'https://server.example/multiplayer', 'ws://server.example/multiplayer', 'wss://user:pass@server.example/multiplayer', 'wss://server.example/other'])
      expect(() => multiplayerUrl(bad, page)).toThrow();
  });
  it('rejects wildcard, missing, malformed and lookalike production origins', () => {
    const allows = originPolicy({ NODE_ENV: 'production', ALLOWED_ORIGINS: 'https://game.example, https://preview.example' });
    expect(allows('https://game.example', 'server.example')).toBe(true);
    expect(allows('https://preview.example', 'server.example')).toBe(true);
    for (const origin of [undefined, 'null', 'https://game.example.evil', 'https://server.example', 'https://game.example/']) expect(allows(origin, 'server.example')).toBe(false);
    for (const value of ['', '*', 'https://game.example/', 'ftp://game.example']) expect(() => originPolicy({ NODE_ENV: 'production', ALLOWED_ORIGINS: value })).toThrow();
  });
});

function fixture() {
  let now = 1000, writable = true;
  const messages: ServerMessage[] = [];
  const peer: Peer = { send: m => messages.push(structuredClone(m)), close() {}, canSendFrames: () => writable };
  const service = new RoomService(() => now);
  service.receive(peer, { type: 'create', name: 'Transport' });
  service.receive(peer, { type: 'ready', ready: true }); service.receive(peer, { type: 'start', fillAi: true });
  const room = [...service.rooms.values()][0];
  const tick = (at: number) => { now = at; service.tick(); };
  return { service, room, peer, messages, tick, pressure: (value: boolean) => { writable = !value; } };
}
it('batches at 100ms without changing frame timestamps or dropping discrete battle events', () => {
  const f = fixture();
  for (let i = 0; i < 20 && f.room.director!.state.phase !== 'BATTLE'; i++) f.tick(f.room.deadline + 1);
  const started = f.room.battleStarted, expected = f.room.director!.playerFrames.get('p1')!;
  const count = () => f.messages.filter(m => m.type === 'frames').length;
  const initial = count(); f.tick(started + 50); expect(count()).toBe(initial);
  f.tick(started + 100); expect(count()).toBe(initial + 1);
  f.pressure(true); f.tick(started + 500); expect(count()).toBe(initial + 1);
  f.pressure(false); f.tick(started + 600);
  const batches = f.messages.filter(m => m.type === 'frames');
  expect(batches.flatMap(m => m.frames)).toEqual(expected.filter(frame => frame.t <= .6));
  expect(batches.every(m => m.frames.every(frame => frame.t <= m.time))).toBe(true);
  expect(f.room.director!.state.history).toHaveLength(0);
});
it('sends carousel motion as a public delta and full state only for claims', () => {
  const f = fixture(); const initial = f.messages.filter(m => m.type === 'state').length;
  f.tick(1100); f.tick(1200);
  expect(f.messages.filter(m => m.type === 'state')).toHaveLength(initial);
  const delta = f.messages.filter(m => m.type === 'draft').at(-1)!;
  expect(delta.draft.carousel!.elapsed).toBeGreaterThan(0);
  expect(JSON.stringify(delta)).not.toMatch(/token|rngStates|shop|bench/);
});
it('preserves reset while blocked and chunks reconnect history without leaking future frames', () => {
  const f = fixture();
  for (let i = 0; i < 20 && f.room.director!.state.phase !== 'BATTLE'; i++) f.tick(f.room.deadline + 1);
  f.pressure(true); f.tick(f.room.battleStarted + 3000);
  f.service.receive(f.peer, { type: 'watch', player: 'p2' });
  f.pressure(false); f.tick(f.room.battleStarted + 3100);
  let batch = f.messages.filter(m => m.type === 'frames').at(-1)!;
  expect(batch.reset).toBe(true); expect(batch.playerId).toBe('p2'); expect(batch.frames.length).toBeLessThanOrEqual(64);
  f.tick(f.room.battleStarted + 3200);
  batch = f.messages.filter(m => m.type === 'frames').at(-1)!;
  expect(batch.frames.every(frame => frame.t <= batch.time)).toBe(true);
});

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const close of cleanup.splice(0)) await close(); });
it('enforces origin policy during a real WebSocket upgrade', async () => {
  const server = createServer(); const { wss } = attachMultiplayer(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  cleanup.push(async () => { for (const ws of wss.clients) ws.terminate(); await new Promise<void>(r => server.close(() => r())); });
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No port');
  for (const origin of ['https://unlisted.example', undefined]) {
    const status = await new Promise<number>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${address.port}/multiplayer`, { origin });
      ws.on('unexpected-response', (_request, response) => { response.resume(); ws.terminate(); resolve(response.statusCode!); });
      ws.on('open', () => { ws.terminate(); reject(new Error('Unexpected accepted connection')); }); ws.on('error', () => {});
    });
    expect(status).toBe(403);
  }
});
