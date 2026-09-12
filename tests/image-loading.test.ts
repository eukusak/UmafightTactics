import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { loadDecodedImage } from '../src/game/ui/load-image';
import { assetUrl, arenaUrl, portraitUrl } from '../src/game/ui/art';
import { frameSheetUrl } from '../src/game/ui/frame-animation';

class FakeImage {
  static plan: string[] = [];
  static urls: string[] = [];
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  outcome = FakeImage.plan.shift() ?? 'load';
  set src(url: string) {
    FakeImage.urls.push(url);
    queueMicrotask(() => { if (this.outcome === 'error') this.onerror?.(); else if (this.outcome !== 'hang') this.onload?.(); });
  }
  decode(): Promise<void> { return this.outcome === 'decode-error' ? Promise.reject(new Error('broken PNG')) : Promise.resolve(); }
}

beforeEach(() => { vi.useFakeTimers(); FakeImage.plan = []; FakeImage.urls = []; vi.stubGlobal('Image', FakeImage); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('versions backgrounds, portraits, equipment and motion sheets together', () => {
  for (const url of [arenaUrl(), portraitUrl('fuji_kiseki'), frameSheetUrl('fuji_kiseki'), assetUrl('boards/bg_pve_training.png')]) expect(url).toContain('?v=test');
});

it('retries a transient failure using a distinct URL then caches the decoded result', async () => {
  FakeImage.plan = ['error', 'load'];
  const signal = new AbortController().signal;
  const result = loadDecodedImage('/transient.png?v=test', signal);
  await vi.runAllTimersAsync();
  expect(await result).toBe('/transient.png?v=test&retry=1');
  expect(FakeImage.urls).toHaveLength(2);
  expect(await loadDecodedImage('/transient.png?v=test', signal)).toBe('/transient.png?v=test&retry=1');
  expect(FakeImage.urls).toHaveLength(2);
});

it('does not treat an undecodable response as a ready image', async () => {
  FakeImage.plan = ['decode-error', 'load'];
  const result = loadDecodedImage('/decode.png', new AbortController().signal);
  await vi.runAllTimersAsync();
  expect(await result).toBe('/decode.png?retry=1');
});

it('stops after three failed requests, allowing an explicit later retry', async () => {
  FakeImage.plan = ['error', 'error', 'error'];
  const result = loadDecodedImage('/unavailable.png', new AbortController().signal).catch(error => error);
  await vi.runAllTimersAsync();
  expect(await result).toBeInstanceOf(Error);
  expect(FakeImage.urls).toHaveLength(3);
  const next = loadDecodedImage('/unavailable.png', new AbortController().signal);
  await vi.runAllTimersAsync();
  expect(await next).toBe('/unavailable.png');
});

it('recovers from a request that never finishes', async () => {
  FakeImage.plan = ['hang', 'load'];
  const result = loadDecodedImage('/slow.png', new AbortController().signal);
  await vi.runAllTimersAsync();
  expect(await result).toBe('/slow.png?retry=1');
});

it('cancels an old field request without issuing retries or caching its result', async () => {
  FakeImage.plan = ['hang'];
  const controller = new AbortController();
  const result = loadDecodedImage('/previous-stage.png', controller.signal).catch(error => error);
  controller.abort();
  await vi.runAllTimersAsync();
  expect((await result).name).toBe('AbortError');
  expect(FakeImage.urls).toHaveLength(1);
});
