import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { RoomService } from '../server/rooms';
import { loadRooms, saveRooms } from '../server/persistence';

it('atomically replaces a private checkpoint, tolerates first boot and preserves corrupt data', () => {
  const directory = mkdtempSync(join(tmpdir(), 'uft-rooms-'));
  const file = join(directory, 'rooms.json');
  try {
    const service = new RoomService(() => 1000);
    expect(loadRooms(file, service)).toBe(false);
    service.receive({ send: () => {}, close: () => {} }, { type: 'create', name: 'Trainer' });
    saveRooms(file, service);
    expect(statSync(file).mode & 0o777).toBe(0o600);
    const restored = new RoomService(() => 2000);
    expect(loadRooms(file, restored)).toBe(true);
    expect([...restored.rooms.keys()]).toEqual([...service.rooms.keys()]);
    service.rooms.clear(); saveRooms(file, service);
    expect(JSON.parse(readFileSync(file, 'utf8')).rooms).toEqual([]);
    writeFileSync(file, '{broken');
    expect(() => loadRooms(file, new RoomService())).toThrow();
    expect(readFileSync(file, 'utf8')).toBe('{broken');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
