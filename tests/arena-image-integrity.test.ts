import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import manifest from '../src/data/generated/art-manifest.json';
import { assertCompletePng } from '../scripts/validate-png';

const asset = (rel: string) => path.resolve('public/assets', rel);

describe('arena background file integrity', () => {
  it.each(manifest.boards)('decodes the complete image: %s', async rel => {
    await expect(assertCompletePng(asset(rel))).resolves.toBeUndefined();
  });

  it('rejects a partial upload even when IHDR dimensions remain valid', async () => {
    const bytes = readFileSync(asset('boards/bg_board_turf_day.png'));
    const partial = bytes.subarray(0, Math.floor(bytes.length * 0.62));
    expect(partial.readUInt32BE(16)).toBe(1920);
    expect(partial.readUInt32BE(20)).toBe(1080);
    await expect(assertCompletePng(partial)).rejects.toThrow('IEND');
    // Appending an end marker cannot repair missing compressed image data.
    await expect(assertCompletePng(Buffer.concat([partial, bytes.subarray(-12)]))).rejects.toThrow();
  });
});
