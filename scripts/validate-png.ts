import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

/** Header metadata alone also accepts partially uploaded PNGs. Decode every pixel. */
export async function assertCompletePng(input: string | Buffer): Promise<void> {
  const bytes = typeof input === 'string' ? await readFile(input) : input;
  const end = Buffer.from('0000000049454e44ae426082', 'hex');
  if (!bytes.subarray(-12).equals(end)) throw new Error('PNG IEND missing: incomplete image');
  await sharp(bytes, { failOn: 'warning' }).raw().toBuffer();
}
