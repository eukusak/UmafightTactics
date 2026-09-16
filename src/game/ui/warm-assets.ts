import { loadDecodedImage } from './load-image';

/**
 * Fetch art the player is about to need, while they are doing something else.
 *
 * Every battle used to pull its whole payload the instant it started, with the
 * clock already running — measured at 8.3s on a 4Mbps line against a battle of
 * about eighteen seconds. Most of that art is knowable during the prep phase,
 * which lasts tens of seconds and asks nothing of the network, so this moves
 * the download there.
 *
 * Assets are served immutable under versioned URLs, so a warmed file is a cache
 * hit when Phaser asks for it rather than a second download.
 */

/** URLs already warmed or in flight, so revisiting a prep phase costs nothing. */
const warmed = new Set<string>();

/**
 * One at a time, and only while the page is idle.
 *
 * Warming competes with whatever the player is actually doing — shop rerolls,
 * unit drags, the round timer. A parallel burst would win that race and make
 * the prep phase stutter to save time in a battle that has not started, so
 * this stays deliberately patient: one request, wait for idle, next.
 */
export async function warmAssets(urls: Array<string | null>, signal: AbortSignal): Promise<void> {
  for (const url of urls) {
    if (signal.aborted) return;
    if (!url || warmed.has(url)) continue;
    warmed.add(url);
    try {
      await loadDecodedImage(url, signal);
    } catch {
      // A warm miss is not a failure: the real load will report it properly.
      warmed.delete(url);
      if (signal.aborted) return;
    }
    await idle(signal);
  }
}

function idle(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) { resolve(); return; }
    const done = () => resolve();
    const ric = (globalThis as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) ric(done, { timeout: 200 });
    else setTimeout(done, 32);
  });
}

/** Test seam: the cache is module-level, so a suite can start from cold. */
export function resetWarmedAssets(): void {
  warmed.clear();
}
