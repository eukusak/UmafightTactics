/** Production accepts exact browser origins only, never a wildcard or an implicit host match. */
export function originPolicy(env: NodeJS.ProcessEnv = process.env): (origin: string | undefined, host: string | undefined) => boolean {
  const origins = (env.ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean);
  for (const origin of origins) {
    let url: URL;
    try { url = new URL(origin); } catch { throw new Error('ALLOWED_ORIGINS must contain exact http(s) origins'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin || url.username || url.password)
      throw new Error('ALLOWED_ORIGINS must contain exact http(s) origins without paths or wildcards');
  }
  const production = env.NODE_ENV === 'production' || !!env.RENDER;
  if (production && !origins.length) throw new Error('ALLOWED_ORIGINS is required for the multiplayer service');
  const allowed = new Set(origins);
  return (origin, host) => {
    if (!origin) return false;
    if (allowed.has(origin)) return true;
    if (production) return false;
    try {
      const url = new URL(origin);
      return ['http:', 'https:'].includes(url.protocol) && url.origin === origin && url.host === host
        && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    } catch { return false; }
  };
}
