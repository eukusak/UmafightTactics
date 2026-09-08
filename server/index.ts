import { createServer, type Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { pathToFileURL } from 'node:url';
import { clientMessageSchema } from '../src/game/network/protocol';
import { RoomService, type Peer } from './rooms';

export function attachMultiplayer(server: Server, rooms = new RoomService()) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8192, perMessageDeflate: { threshold: 1024 } });
  server.on('upgrade', (request, socket, head) => {
    if (request.url !== '/multiplayer') return;
    const origin = request.headers.origin;
    const allowed = (process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean);
    let sameOrigin = false;
    try { sameOrigin = !!origin && new URL(origin).host === request.headers.host; } catch { /* invalid origin */ }
    if ((!sameOrigin && !allowed.includes(origin ?? '')) || wss.clients.size >= 128) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws));
  });
  wss.on('connection', (ws) => {
    let windowAt = Date.now(), count = 0, alive = true;
    const peer: Peer = {
      send: (message) => { if (ws.readyState !== WebSocket.OPEN) return; if (ws.bufferedAmount > 4_000_000) { ws.close(1013, 'Reconnect'); return; } ws.send(JSON.stringify(message)); },
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
  const clock = setInterval(() => rooms.tick(), 50); clock.unref();
  server.once('close', () => { clearInterval(clock); for (const ws of wss.clients) ws.terminate(); wss.close(); });
  return { rooms, wss };
}

async function main(): Promise<void> {
  const { staticHandler, requireBuild } = await import('../scripts/serve.mjs');
  requireBuild();
  const server = createServer((req, res) => {
    if (req.url === '/health') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end('{"ok":true,"multiplayer":true}'); return; }
    staticHandler(req, res);
  });
  attachMultiplayer(server);
  server.listen(Number(process.env.PORT) || 4173, process.env.HOST || '0.0.0.0', () => console.log('UmafightTactics HTTP + multiplayer server ready'));
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => server.close(() => process.exit(0)));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main();
