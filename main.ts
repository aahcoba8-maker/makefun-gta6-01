// Karang Bay — entrypoint.
//
// Two jobs, one file:
//
//   node main.ts            Assemble the make.fun submission dossier: copy the
//                           game and its screenshots into $MAKEFUN_OUTPUT_DIR
//                           (default /output) and write dossier.json there.
//                           This is the mode the contest grader runs.
//
//   node main.ts --serve    Run a small static web server instead, so the game
//                           can be played in a browser: / serves the game's
//                           index.html, everything else is served from this
//                           repository with a proper content type. Listens on
//                           $PORT (default 3000).
//
// Node 22, standard library only — the single import outside node: is the
// kit's dossier builder in vendor/.

import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)));
const gameRoot = join(repoRoot, 'game');

// ---------------------------------------------------------------------------
// Mode 1: dossier assembly (default)
// ---------------------------------------------------------------------------

function assembleDossier(): void {
  const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

  mkdirSync(out, { recursive: true });
  cpSync(gameRoot, join(out, 'game'), { recursive: true });

  const shotsDir = join(repoRoot, 'screenshots');
  mkdirSync(join(out, 'screenshots'), { recursive: true });
  if (existsSync(shotsDir)) {
    cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });
  }

  const dossier = buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(out, 'dossier.json'), dossier);
}

// ---------------------------------------------------------------------------
// Mode 2: static file server (--serve)
// ---------------------------------------------------------------------------

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.wasm': 'application/wasm',
};

// Map a request URL to a file inside the repository, or return null when the
// path is malformed or tries to escape the repository root.
function resolveRequestPath(rawUrl: string): string | null {
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(rawUrl, 'http://localhost').pathname);
  } catch {
    return null;
  }

  // The front door of the site is the game itself.
  if (pathname === '/' || pathname === '/index.html') {
    return join(gameRoot, 'index.html');
  }

  const cleaned = normalize(pathname).replace(/^[/\\]+/, '');
  const candidate = resolve(repoRoot, cleaned);
  if (candidate !== repoRoot && !candidate.startsWith(repoRoot + sep)) {
    return null; // path traversal attempt
  }
  return candidate;
}

function sendPlain(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(body);
}

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendPlain(res, 405, 'Method not allowed\n');
    return;
  }

  const filePath = resolveRequestPath(req.url ?? '/');
  if (filePath === null) {
    sendPlain(res, 400, 'Bad request path\n');
    return;
  }

  let size: number;
  try {
    const stats = statSync(filePath);
    if (!stats.isFile()) throw new Error('not a file');
    size = stats.size;
  } catch {
    sendPlain(res, 404, 'Not found\n');
    return;
  }

  const type = CONTENT_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
  res.writeHead(200, { 'content-type': type, 'content-length': size });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(filePath).pipe(res);
}

function serve(): void {
  const parsed = Number(process.env.PORT);
  const port = Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : 3000;
  const server = createServer(handleRequest);
  server.listen(port, () => {
    console.log(`Karang Bay server listening on http://localhost:${port}/`);
  });
}

// ---------------------------------------------------------------------------

if (process.argv.slice(2).includes('--serve')) {
  serve();
} else {
  assembleDossier();
}
