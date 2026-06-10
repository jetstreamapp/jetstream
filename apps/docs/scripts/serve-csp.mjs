/**
 * Serves the built docs site locally with the security headers from `build/_headers` applied
 * to every response, so header changes can be tested in a real browser before deploy.
 * (`docusaurus serve` cannot set custom headers, hence this script.)
 *
 * Usage: node scripts/serve-csp.mjs [port]   (default port 3939)
 */
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const BUILD_DIR = fileURLToPath(new URL('../build', import.meta.url));
const PORT = Number(process.argv[2]) || 3939;

const headersFile = readFileSync(join(BUILD_DIR, '_headers'), 'utf-8');
const securityHeaders = [...headersFile.matchAll(/^\s+([\w-]+):\s*(.+)$/gm)].map(([, key, value]) => [key, value.trim()]);
if (!securityHeaders.some(([key]) => key === 'Content-Security-Policy')) {
  console.error('No Content-Security-Policy found in build/_headers — run a build first');
  process.exit(1);
}

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// Mirrors static host routing: exact file, then `page.html`, then `page/index.html`, then 404
function resolveFile(urlPath) {
  const safePath = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  const candidates = [
    join(BUILD_DIR, safePath, safePath.endsWith('/') || safePath === '' ? 'index.html' : ''),
    join(BUILD_DIR, safePath),
    join(BUILD_DIR, `${safePath}.html`),
    join(BUILD_DIR, safePath, 'index.html'),
  ];
  return candidates.find((candidate) => existsSync(candidate) && extname(candidate) !== '') ?? join(BUILD_DIR, '404.html');
}

createServer((req, res) => {
  const filePath = resolveFile(new URL(req.url, 'http://localhost').pathname.slice(1));
  res.setHeader('Content-Type', CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream');
  securityHeaders.forEach(([key, value]) => res.setHeader(key, value));
  res.end(readFileSync(filePath));
}).listen(PORT, () => {
  console.log(`Serving build/ with headers from build/_headers at http://localhost:${PORT}`);
  securityHeaders.forEach(([key, value]) => console.log(`  ${key}: ${value}`));
});
