/** Local-only workload: real sockets, server-authoritative battle, no production debug endpoints. */
import { createServer } from 'node:http';
import { once } from 'node:events';
import { performance } from 'node:perf_hooks';
import { WebSocket } from 'ws';
import { attachMultiplayer } from '../server/index';
import { createMatch } from '../src/game/engine/rounds/director';
import type { ClientMessage, ServerMessage } from '../src/game/network/protocol';
const argument = (key: string, fallback: number) => Number(process.argv[process.argv.indexOf(key) + 1]) || fallback;
const roomCount = argument('--rooms', 1), players = argument('--players', 8), seconds = argument('--seconds', 10);
if (![1,2,3,4,5].includes(roomCount) || ![2,8].includes(players) || seconds < 2 || seconds > 120) throw new Error('Use --rooms 1..5 --players 2|8 --seconds 2..120');
const server = createServer();
const { rooms, wss, metrics } = attachMultiplayer(server);
await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
const address = server.address(); if (!address || typeof address === 'string') throw new Error('No port');
const origin = `http://127.0.0.1:${address.port}`;
const clients: WebSocket[] = [];
let wireBytes = 0;
let bytes = 0, batches = 0, frames = 0, disconnected = 0;
const waitFor = async (test: () => boolean) => { const end = Date.now() + 15000; while (!test()) { if (Date.now() > end) throw new Error('Load handshake timed out'); await new Promise(r => setTimeout(r, 10)); } };
const send = (ws: WebSocket, message: ClientMessage) => ws.send(JSON.stringify(message));
try {
  for (let r = 0; r < roomCount; r++) {
    let code = ''; const group: WebSocket[] = [];
    for (let p = 0; p < players; p++) {
      const ws = new WebSocket(origin.replace('http:', 'ws:') + '/multiplayer', { origin }); clients.push(ws); group.push(ws);
      let welcomed = false;
      ws.on('upgrade', response => response.socket.on('data', data => { wireBytes += data.length; }));
      ws.on('message', raw => {
        bytes += Buffer.byteLength(raw.toString()); const message = JSON.parse(raw.toString()) as ServerMessage;
        if (message.type === 'welcome') { code = message.code; welcomed = true; }
        if (message.type === 'frames') { batches++; frames += message.frames.length; if (message.frames.some(f => f.t > message.time)) throw new Error('Future frame leak'); }
        if (message.type === 'error') throw new Error(message.message);
      });
      ws.on('close', () => { disconnected++; }); ws.on('error', error => console.error(error.message));
      await once(ws, 'open'); send(ws, p ? { type: 'join', code, name: `Load ${p}` } : { type: 'create', name: 'Load host' });
      await waitFor(() => welcomed); send(ws, { type: 'ready', ready: true });
    }
    const room = rooms.rooms.get(code)!;
    await waitFor(() => room.seats.every(s => s.ready)); send(group[0], { type: 'start', fillAi: true });
    await waitFor(() => !!room.director);
    // Prepare a populated midgame workload in this process only; never add a public admin command.
    const d = room.director!; d.advanceCarousel(60000);
    d.state.stage = 3; d.state.round = 1; d.state.draft = null; d.state.augmentOffers = []; d.state.phase = 'ROUND_PREP';
    const bots = createMatch({ seed: r + 22, allAi: true });
    d.state.players.forEach((p, i) => { p.aiProfile = bots.players[i].aiProfile; p.gold = 50; p.level = 7; });
    d.beginPrep(); room.deadline = Number.MAX_SAFE_INTEGER;
  }
  wireBytes = bytes = batches = frames = disconnected = 0; metrics.snapshot();
  const start = performance.now();
  for (const room of rooms.rooms.values()) room.deadline = Date.now();
  await new Promise(r => setTimeout(r, seconds * 1000));
  const elapsed = (performance.now() - start) / 1000;
  console.log(JSON.stringify({ scenario: { rooms: roomCount, playersPerRoom: players, seconds }, elapsed,
    receivedBytes: bytes, wireBytesPerSecond: Math.round(wireBytes / elapsed), receivedFrameBatches: batches, receivedFrames: frames, disconnected,
    populatedBoards: [...rooms.rooms.values()].map(r => r.director!.state.players.map(p => p.board.length)), ...metrics.snapshot() }, null, 2));
  if (!batches || disconnected) process.exitCode = 1;
} finally {
  clients.forEach(ws => ws.terminate()); for (const ws of wss.clients) ws.terminate();
  await new Promise<void>(resolve => server.close(() => resolve()));
}
