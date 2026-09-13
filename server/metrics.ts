import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import type { RoomService } from './rooms';

/** No player IDs, room codes, tokens or match snapshots are logged. */
export function serverMetrics(rooms: RoomService, sockets: () => number, buffered: () => number, enabled = process.env.ENABLE_SERVER_METRICS === 'true') {
  const delay = enabled ? monitorEventLoopDelay({ resolution: 20 }) : null;
  delay?.enable();
  let messages = 0, bytes = 0, batches = 0, deferred = 0, maxDrift = 0, ticks = 0;
  let sampled = performance.now(), lastTick = sampled, cpu = process.cpuUsage();
  const snapshot = () => {
    const now = performance.now(), seconds = (now - sampled) / 1000, memory = process.memoryUsage(), used = process.cpuUsage(cpu);
    const result = { rooms: rooms.rooms.size, sockets: sockets(), players: [...rooms.rooms.values()].reduce((n,r) => n + r.seats.length, 0),
      rssMB: +(memory.rss / 1048576).toFixed(1), heapMB: +(memory.heapUsed / 1048576).toFixed(1), uptime: Math.round(process.uptime()),
      cpuPercent: +((used.user + used.system) / (seconds * 10000)).toFixed(1),
      messagesPerSecond: +(messages / seconds).toFixed(1), bytesPerSecond: Math.round(bytes / seconds), frameBatchesPerSecond: +(batches / seconds).toFixed(1),
      deferredBatches: deferred, ticks, maxTickDriftMs: +maxDrift.toFixed(1), maxBufferedBytes: buffered(),
      eventLoopP99Ms: delay ? +(delay.percentile(99) / 1e6).toFixed(1) : null };
    messages = bytes = batches = deferred = maxDrift = ticks = 0; sampled = now; cpu = process.cpuUsage(); delay?.reset();
    return result;
  };
  const timer = enabled ? setInterval(() => console.log('[metrics]', JSON.stringify(snapshot())), 30000) : null;
  timer?.unref();
  return { snapshot, sent(size: number, frame: boolean) { messages++; bytes += size; if (frame) batches++; },
    defer() { deferred++; }, tick() { const now = performance.now(); maxDrift = Math.max(maxDrift, now - lastTick - 50); lastTick = now; ticks++; },
    close() { if (timer) clearInterval(timer); delay?.disable(); } };
}
