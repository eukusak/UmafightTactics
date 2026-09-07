/**
 * Production static server for the built SPA.
 *
 * The game is a static site and `render.yaml` deploys it as one. This exists so
 * the repo also works when the host runs it as a plain Node web service, which
 * is Render's default for a Node project: that path runs `yarn` (install only)
 * and then `yarn start`, so there is no build step and no start command.
 *
 * It therefore builds `dist/` on first boot when it is missing, then serves it.
 * Dependency-free on purpose — nothing here should need an install to work.
 */
import { spawnSync } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip, gzipSync } from 'node:zlib';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const INDEX = path.join(DIST, 'index.html');

const PORT = Number(process.env.PORT) || 4173;
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
};

const COMPRESSIBLE = new Set([
  '.html', '.js', '.mjs', '.css', '.json', '.map', '.svg', '.txt', '.wasm',
]);

/** Builds the site when `dist/` is absent, so an install-only deploy still works. */
function ensureBuilt() {
  if (existsSync(INDEX)) return;
  console.log('[serve] dist/ is missing — running the production build first.');
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, ['run', 'build'], { cwd: ROOT, stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(
      '\n[serve] Build failed, so there is nothing to serve.\n' +
        '        Deploy this repository as a Render *Static Site* instead:\n' +
        '          Build Command:   npm ci && npm run build\n' +
        '          Publish Directory: dist\n',
    );
    process.exit(result.status ?? 1);
  }
}

/** Resolves a URL path to a file inside dist, or null when it escapes the root. */
function resolveFile(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null;
  }
  const candidate = path.resolve(DIST, `.${path.posix.normalize(decoded)}`);
  // Never serve outside dist, whatever the request says.
  if (candidate !== DIST && !candidate.startsWith(DIST + path.sep)) return null;
  if (!existsSync(candidate)) return null;
  const stat = statSync(candidate);
  if (stat.isDirectory()) {
    const indexFile = path.join(candidate, 'index.html');
    return existsSync(indexFile) ? indexFile : null;
  }
  return candidate;
}

function send(req, res, file, status = 200) {
  const ext = path.extname(file).toLowerCase();
  const type = MIME[ext] ?? 'application/octet-stream';

  // Hashed asset filenames are safe to cache forever; the shell never is.
  const cache = file.includes(`${path.sep}assets${path.sep}`)
    ? 'public, max-age=31536000, immutable'
    : 'no-cache';

  const headers = { 'Content-Type': type, 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' };
  const acceptsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');

  if (acceptsGzip && COMPRESSIBLE.has(ext)) {
    // The Phaser chunk is ~1.4MB raw, so compression matters on this route.
    headers['Content-Encoding'] = 'gzip';
    headers.Vary = 'Accept-Encoding';
    res.writeHead(status, headers);
    if (req.method === 'HEAD') { res.end(); return; }
    createReadStream(file).pipe(createGzip()).pipe(res);
    return;
  }

  headers['Content-Length'] = statSync(file).size;
  res.writeHead(status, headers);
  if (req.method === 'HEAD') { res.end(); return; }
  createReadStream(file).pipe(res);
}

ensureBuilt();

const NOT_FOUND_BODY = gzipSync(Buffer.from('Not found', 'utf8'));

const server = createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method not allowed');
    return;
  }

  const urlPath = req.url || '/';
  const file = resolveFile(urlPath);
  if (file) { send(req, res, file); return; }

  // SPA fallback: any route without a file extension renders the app shell.
  // A missing asset stays a 404 so broken references are visible.
  if (!path.extname(urlPath.split('?')[0])) { send(req, res, INDEX); return; }

  res.writeHead(404, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Encoding': 'gzip',
    Vary: 'Accept-Encoding',
  });
  res.end(NOT_FOUND_BODY);
});

server.listen(PORT, HOST, () => {
  console.log(`[serve] UmafightTactics listening on http://${HOST}:${PORT}`);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
