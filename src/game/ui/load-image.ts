const decoded = new Map<string, string>();
const aborted = () => new DOMException('Image request cancelled', 'AbortError');

function attempt(url: string, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(aborted()); return; }
    const image = new Image();
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      image.onload = null; image.onerror = null;
      signal.removeEventListener('abort', cancel);
      if (error) reject(error); else resolve(url);
    };
    const cancel = () => finish(aborted());
    const timeout = setTimeout(() => finish(new Error('Image load timed out')), 8000);
    signal.addEventListener('abort', cancel, { once: true });
    image.onload = () => {
      // A received response is not necessarily a decodable image.
      void image.decode().then(() => finish(), () => finish(new Error('Image decode failed')));
    };
    image.onerror = () => finish(new Error('Image load failed'));
    image.src = url;
  });
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(aborted()); return; }
    const cancel = () => { clearTimeout(timer); reject(aborted()); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, ms);
    signal.addEventListener('abort', cancel, { once: true });
  });
}

/** Finite retries bypass cached failures; successful images are reused on revisit. */
export async function loadDecodedImage(url: string, signal: AbortSignal): Promise<string> {
  if (signal.aborted) throw aborted();
  const cached = decoded.get(url);
  if (cached) return cached;
  for (let retry = 0; retry < 3; retry++) {
    if (retry) await delay(retry * 350, signal);
    try {
      const candidate = retry ? `${url}${url.includes('?') ? '&' : '?'}retry=${retry}` : url;
      const ready = await attempt(candidate, signal);
      decoded.set(url, ready);
      return ready;
    } catch (error) {
      if (signal.aborted || retry === 2) throw error;
    }
  }
  throw new Error('Image load failed');
}
