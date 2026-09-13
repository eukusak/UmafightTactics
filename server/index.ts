import { originPolicy } from './origins';
import { serverMetrics } from './metrics';
import { createServer, type Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { isMainModule, listenAddress } from '../scripts/runtime.mjs';
import { clientMessageSchema } from '../src/game/network/protocol';
import { RoomService, type Peer } from './rooms';
import { loadRooms, saveRooms } from './persistence';
import { resolve, relative, isAbsolute } from 'node:path';

export function attachMultiplayer(server: Server, rooms = new RoomService(), serveAssets = false) {
  const acceptsOrigin = originPolicy(process.env, serveAssets);
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8192, perMessageDeflate: {
    threshold: 1024, concurrencyLimit: 2, serverNoContextTakeover: true, clientNoContextTakeover: true,
    zlibDeflateOptions: { level: 1, memLevel: 4 },
  } });
  const metrics = serverMetrics(rooms, () => wss.clients.size, () => Math.max(0, ...[...wss.clients].map(ws => ws.bufferedAmount)));
  const serialized = new WeakMap<object, string>();
  server.on('upgrade', (request, socket, head) => {
    if (request.url !== '/multiplayer' || !acceptsOrigin(request.headers.origin, request.headers.host) || wss.clients.size >= 128) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); socket.destroy(); return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws));
  });
  wss.on('connection', (ws) => {
    let windowAt = Date.now(), count = 0, alive = true, pressureAt = 0;
    const canSendFrames = () => {
      if (ws.readyState !== WebSocket.OPEN) return false;
      if (ws.bufferedAmount > 512_000) {
        if (!pressureAt) pressureAt = Date.now();
        if (ws.bufferedAmount > 4_000_000 || Date.now() - pressureAt > 5000) ws.close(1013, 'Reconnect');
        metrics.defer(); return false;
      }
      pressureAt = 0; return true;
    };
    const peer: Peer = {
      canSendFrames,
      send: (message) => {
        if (ws.readyState !== WebSocket.OPEN) return false;
        if (ws.bufferedAmount > 4_000_000) { ws.close(1013, 'Reconnect'); return false; }
        let payload = serialized.get(message);
        if (!payload) { payload = JSON.stringify(message); serialized.set(message, payload); }
        ws.send(payload); metrics.sent(Buffer.byteLength(payload), message.type === 'frames'); return true;
      },
      close: () => ws.close(1000, 'Seat closed'),
    };
    ws.on('pong', () => { alive = true; });
    ws.on('message', (raw) => {
      if (Date.now() - windowAt >= 1000) { windowAt = Date.now(); count = 0; }
      if (++count > 40) { ws.close(1008, 'Rate limit'); return; }
      try {
        const parsed = clientMessageSchema.safeParse(JSON.parse(raw.toString()));
        if (!parsed.success) { peer.send({ type: 'error', message: '잘못된 요청입니다.' }); return; }
        rooms.receive(peer, parsed.data);
      } catch { peer.send({ type: 'error', message: '잘못된 메시지입니다.' }); }
    });
    ws.on('close', () => rooms.disconnect(peer));
    ws.on('error', () => rooms.disconnect(peer));
    const heartbeat = setInterval(() => { if (!alive) { ws.terminate(); return; } alive = false; ws.ping(); }, 15000);
    heartbeat.unref(); ws.once('close', () => clearInterval(heartbeat));
  });
  const clock = setInterval(() => { metrics.tick(); rooms.tick(); }, 50); clock.unref();
  server.once('close', () => { clearInterval(clock); metrics.close(); for (const ws of wss.clients) ws.terminate(); wss.close(); });
  return { rooms, wss, metrics };
}

export async function main(serveAssets = false): Promise<void> {
  const { port, host } = listenAddress();
  console.log('[startup] Loading multiplayer server');
  // start:server remains independent of dist/public and static-serving code.
  const assets = serveAssets ? await import('../scripts/serve.mjs') : null;
  assets?.requireBuild();
  const server = createServer((req, res) => {
    if (req.url === '/health') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end('{"ok":true,"multiplayer":true,"service":"multiplayer"}'); return; }
    if (assets) { assets.staticHandler(req, res); return; }
    res.writeHead(req.url === '/' ? 200 : 404, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ service: 'multiplayer', ...(req.url === '/' ? { endpoint: '/multiplayer' } : { error: 'Not found' }) }));
  });
  const rooms = new RoomService();
  const checkpoint = process.env.ROOM_STATE_FILE;
  if (checkpoint) {
    for (const directory of ['public', 'dist']) {
      const subpath = relative(resolve(directory), resolve(checkpoint));
      if (!subpath || (!subpath.startsWith('..') && !isAbsolute(subpath))) throw new Error('ROOM_STATE_FILE must be outside public/dist');
    }
    loadRooms(checkpoint, rooms);
  }
  const { wss } = attachMultiplayer(server, rooms, serveAssets);
  const persist = () => { if (checkpoint) saveRooms(checkpoint, rooms); };
  const saver = checkpoint ? setInterval(() => {
    try { persist(); } catch { console.error('Room checkpoint failed; check disk space and permissions.'); }
  }, 2000) : null;
  saver?.unref();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => { server.removeListener('error', reject); resolve(); });
  });
  console.log('UmafightTactics ' + (serveAssets ? 'HTTP + multiplayer' : 'multiplayer') + ' server ready on http://' + host + ':' + port);
  let stopping = false;
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => {
    if (stopping) return;
    stopping = true;
    if (saver) clearInterval(saver);
    try { persist(); } catch { console.error('Final room checkpoint failed.'); process.exitCode = 1; }
    for (const ws of wss.clients) ws.terminate();
    server.close(() => process.exit(process.exitCode ?? 0));
  });
}
if (isMainModule(import.meta.url)) void main().catch(error => {
  console.error('[startup] Failed to start multiplayer server:', error);
  process.exitCode = 1;
});
