/**
 * Vendors the UmaRogue source data into src/data/source/ at build time.
 *
 * Spec §5: the browser never calls an external URL. This script is the only
 * place a network fetch happens, and it is a build step. When the network is
 * unavailable we fall back to the previously vendored files, but only if their
 * recorded SHA-256 still matches.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = path.join(ROOT, 'src', 'data', 'source');
const LOCK_FILE = path.join(SOURCE_DIR, 'source.lock.json');

const BASE = 'https://raw.githubusercontent.com/eukusak/UmaRogue/pr0/data';
/** Local clone fallback, used when the raw URL is unreachable (private repo). */
const LOCAL_MIRRORS = ['/home/user/umarogue/data', path.join(ROOT, '..', 'umarogue', 'data')];

const FILES = ['horse-game-db.json', 'horse-game-db.validation.json'] as const;

type LockEntry = { sha256: string; bytes: number; fetchedAt: string; origin: string };
type Lock = { version: 1; files: Record<string, LockEntry> };

const sha256 = (buf: Buffer | string) => createHash('sha256').update(buf).digest('hex');

async function tryNetwork(file: string): Promise<Buffer | null> {
  try {
    const res = await fetch(`${BASE}/${file}`, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) {
      console.warn(`  network: ${file} -> HTTP ${res.status}`);
      return null;
    }
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    console.warn(`  network: ${file} -> ${(err as Error).message}`);
    return null;
  }
}

async function tryLocalMirror(file: string): Promise<{ buf: Buffer; origin: string } | null> {
  for (const dir of LOCAL_MIRRORS) {
    const candidate = path.join(dir, file);
    if (existsSync(candidate)) {
      return { buf: await readFile(candidate), origin: `local:${candidate}` };
    }
  }
  return null;
}

async function readLock(): Promise<Lock> {
  if (!existsSync(LOCK_FILE)) return { version: 1, files: {} };
  try {
    return JSON.parse(await readFile(LOCK_FILE, 'utf8')) as Lock;
  } catch {
    return { version: 1, files: {} };
  }
}

/** Spec §5: hard gate on the vendored payload before anything downstream reads it. */
function assertIntegrity(db: unknown, validation: unknown): void {
  const d = db as { horses?: unknown[] };
  const v = validation as { horseCount?: number; p0Count?: number; missingStats?: number; duplicateIds?: number };
  const horses = d.horses;
  if (!Array.isArray(horses)) throw new Error('horse-game-db.json has no "horses" array.');

  const problems: string[] = [];
  if (horses.length !== 331) problems.push(`horseCount ${horses.length} != 331`);
  if (v.horseCount !== 331) problems.push(`validation.horseCount ${v.horseCount} != 331`);
  if (v.p0Count !== 145) problems.push(`validation.p0Count ${v.p0Count} != 145`);
  if (v.missingStats !== 0) problems.push(`missingStats ${v.missingStats} != 0`);
  if (v.duplicateIds !== 0) problems.push(`duplicateIds ${v.duplicateIds} != 0`);

  const ids = new Set<string>();
  for (const h of horses as Array<{ id: string }>) {
    if (ids.has(h.id)) problems.push(`duplicate horse id ${h.id}`);
    ids.add(h.id);
  }
  const p0 = (horses as Array<{ priority: string }>).filter((h) => h.priority === 'P0').length;
  if (p0 !== 145) problems.push(`priority=="P0" count ${p0} != 145`);

  if (problems.length) {
    throw new Error(`Source data integrity check failed:\n  - ${problems.join('\n  - ')}`);
  }
}

async function main(): Promise<void> {
  await mkdir(SOURCE_DIR, { recursive: true });
  const lock = await readLock();
  const nextLock: Lock = { version: 1, files: {} };
  const payloads: Record<string, Buffer> = {};

  console.log('sync:data — vendoring UmaRogue source data');
  for (const file of FILES) {
    const dest = path.join(SOURCE_DIR, file);
    let buf = await tryNetwork(file);
    let origin = `${BASE}/${file}`;

    if (!buf) {
      const mirror = await tryLocalMirror(file);
      if (mirror) {
        buf = mirror.buf;
        origin = mirror.origin;
        console.log(`  ${file}: using local mirror (${mirror.origin})`);
      }
    }

    if (!buf) {
      // Last resort: an already-vendored copy whose SHA still matches the lock.
      const recorded = lock.files[file];
      if (existsSync(dest) && recorded) {
        const existing = await readFile(dest);
        if (sha256(existing) !== recorded.sha256) {
          throw new Error(
            `Network unavailable and vendored ${file} does not match source.lock.json ` +
              `(expected ${recorded.sha256.slice(0, 12)}…). Refusing to build on unverified data.`,
          );
        }
        console.log(`  ${file}: offline, reusing verified vendored copy`);
        payloads[file] = existing;
        nextLock.files[file] = recorded;
        continue;
      }
      throw new Error(
        `Cannot obtain ${file}. No network, no local mirror, and no verified vendored copy exists. ` +
          `Clone https://github.com/eukusak/UmaRogue (branch pr0) next to this repo and retry.`,
      );
    }

    JSON.parse(buf.toString('utf8')); // fail fast on malformed JSON
    await writeFile(dest, buf);
    payloads[file] = buf;
    const digest = sha256(buf);
    const recorded = lock.files[file];
    // The lock file is committed, so a re-sync that fetches identical bytes must
    // not rewrite it — otherwise every `npm run verify` dirties the work tree.
    nextLock.files[file] = {
      sha256: digest,
      bytes: buf.byteLength,
      fetchedAt: recorded?.sha256 === digest ? recorded.fetchedAt : new Date().toISOString(),
      origin,
    };
    console.log(`  ${file}: ${buf.byteLength} bytes  sha256=${digest.slice(0, 12)}…`);
  }

  assertIntegrity(
    JSON.parse(payloads['horse-game-db.json'].toString('utf8')),
    JSON.parse(payloads['horse-game-db.validation.json'].toString('utf8')),
  );

  await writeFile(LOCK_FILE, JSON.stringify(nextLock, null, 2) + '\n');
  console.log('sync:data — OK (331 horses, 145 P0, 0 missing stats, 0 duplicate ids)');
}

main().catch((err) => {
  console.error(`\nsync:data FAILED\n${(err as Error).message}\n`);
  process.exit(1);
});
