import { mkdirSync, openSync, writeFileSync, fsyncSync, closeSync, renameSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { RoomService, RoomSnapshot } from './rooms';

/** Store outside dist/public: this file contains private shops and seat credentials. */
export function saveRooms(path: string, rooms: RoomService): void {
  const data = JSON.stringify(rooms.snapshot());
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.tmp`;
  const fd = openSync(temporary, 'w', 0o600);
  try { writeFileSync(fd, data); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temporary, path);
}

export function loadRooms(path: string, rooms: RoomService): boolean {
  let data: string;
  try { data = readFileSync(path, 'utf8'); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
  // Fail startup on corruption/version mismatch; never overwrite it with empty rooms.
  rooms.restore(JSON.parse(data) as RoomSnapshot);
  return true;
}
