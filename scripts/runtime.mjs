import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Node resolves module URLs through symlinks, but argv can keep the link path. */
export function isMainModule(moduleUrl) {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(fileURLToPath(moduleUrl)) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}

export function listenAddress() {
  const port = Number(process.env.PORT || 4173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return { port, host: process.env.RENDER ? '0.0.0.0' : (process.env.HOST || '0.0.0.0') };
}
