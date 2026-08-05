import { ENV, logger } from '@jetstream/api-config';
import { SW_PRECACHE_PREFIX } from '@jetstream/shared/constants';
import express, { Router } from 'express';
import { readFileSync } from 'fs';
import { basename, join, posix as pathPosix } from 'path';

/**
 * Everything the SPA needs served from disk that is not the `/app` shell itself: the hashed build
 * assets at the origin root and the precache service worker at `/app/sw.js`.
 *
 * Mounted at the root, and must be mounted BEFORE the `/app` handler so service worker update
 * re-fetches are never intercepted by the auth redirect middlewares.
 */

const IMMUTABLE_ASSETS_MANIFEST = 'immutable-assets.json';
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

/**
 * `/app/sw.js` keeps one URL forever, so an intermediary that holds onto a copy is the one thing
 * that could stop SW_KILL_SWITCH from reaching clients. `no-store` rather than `no-cache` because
 * Render's edge treats a 200 with a non-qualifying Cache-Control as cacheable by status code and
 * documents `no-store` as the way to opt out; `CDN-Cache-Control` takes precedence there and is
 * ignored by browsers. Costs nothing - browsers already bypass their HTTP cache when checking a
 * service worker script for updates.
 */
function setServiceWorkerCacheHeaders(res: express.Response): void {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('CDN-Cache-Control', 'no-store');
}

/**
 * Filenames the build declared content-hashed (immutableAssetsPlugin in apps/jetstream/vite.plugins.ts).
 * A one-year cache is only safe because a new build means a new URL, and only the build knows which
 * filenames carry a hash - inferring it from the name marks hand-named files like
 * `jetstream-logo-pro.svg` immutable too, which no deploy could ever undo. A missing or unreadable
 * manifest yields an empty set, so every asset falls back to revalidate-on-every-request.
 */
function readImmutableAssets(jetstreamDistPath: string): Set<string> {
  try {
    return new Set<string>(JSON.parse(readFileSync(join(jetstreamDistPath, IMMUTABLE_ASSETS_MANIFEST), 'utf8')));
  } catch (error) {
    logger.error(
      { err: error },
      '[SPA] Failed to read immutable-assets.json at startup — build assets will be revalidated on every request',
    );
    return new Set<string>();
  }
}

/**
 * Served in place of the real worker when SW_KILL_SWITCH is set: browsers bypass the HTTP cache when
 * checking /app/sw.js for updates (on every register() call and at least every 24h), so every client
 * unregisters and clears its caches shortly after the flag is enabled. Pages keep working - the
 * worker is network-passthrough for everything it doesn't have cached, and navigations are never
 * intercepted.
 */
const KILL_SWITCH_WORKER_SCRIPT = `
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = (await caches.keys()).filter((cacheName) => cacheName.startsWith('${SW_PRECACHE_PREFIX}'));
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    await self.registration.unregister();
  })());
});
`.trim();

export function createSpaAssetRoutes(jetstreamDistPath: string): express.Router {
  const routes: express.Router = Router();

  // Serve the SPA's built assets, but never `index.html` — it contains unreplaced
  // `__CSP_NONCE__` placeholders and must only be sent through the /app handler.
  // `{ index: false }` disables directory→index.html mapping; the guard below catches
  // direct index.html requests regardless of encoding.
  const immutableAssets = readImmutableAssets(jetstreamDistPath);
  const jetstreamStatic = express.static(jetstreamDistPath, {
    index: false,
    setHeaders: (res, filePath) => {
      if (immutableAssets.has(basename(filePath))) {
        res.setHeader('Cache-Control', IMMUTABLE_CACHE_CONTROL);
      }
    },
  });

  routes.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Must mirror send's own path transform (decode → collapse slash runs → normalize
    // dot segments) or the guard is bypassable. `req.path` from parseurl is raw —
    // it doesn't decode `%2f`, doesn't collapse `//`, and doesn't resolve `.`/`..` —
    // while `send` inside express.static does all three and would happily serve
    // <root>/index.html for e.g. `//index.html`, `/%2findex.html`, or `/foo/%2e%2e/index.html`.
    let decodedPath: string;
    try {
      decodedPath = decodeURIComponent(req.path);
    } catch {
      // Malformed percent-encoding — let downstream 404 handle it.
      return next();
    }
    const normalizedPath = pathPosix.normalize(decodedPath.replace(/\/+/g, '/'));
    // index.html contains unreplaced __CSP_NONCE__ placeholders and must only be sent through the
    // /app handler. sw.js must only be reachable at /app/sw.js - served from the root it could be
    // registered with a max scope covering the entire origin (landing, /canvas, /web-extension).
    // immutable-assets.json is consumed here at startup and is not a client asset.
    if (normalizedPath === '/index.html' || normalizedPath === '/sw.js' || normalizedPath === `/${IMMUTABLE_ASSETS_MANIFEST}`) {
      return next();
    }
    jetstreamStatic(req, res, next);
  });

  let serviceWorkerScript: string | null = null;
  try {
    serviceWorkerScript = readFileSync(join(jetstreamDistPath, 'sw.js'), 'utf8');
  } catch (error) {
    logger.error({ err: error }, '[SPA] Failed to read jetstream/sw.js at startup — /app/sw.js will return 404');
  }

  // A 404 (missing build) is safe: browsers unregister a service worker whose script returns 404 on
  // an update check, which fails open to no-worker behavior.
  routes.get('/app/sw.js', (_: express.Request, res: express.Response) => {
    const script = ENV.SW_KILL_SWITCH ? KILL_SWITCH_WORKER_SCRIPT : serviceWorkerScript;
    if (!script) {
      // 404 is cacheable by default at the edge, and a sticky 404 here would keep every client
      // unregistered until the next deploy purge
      res.status(404);
      setServiceWorkerCacheHeaders(res);
      res.end();
      return;
    }
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    setServiceWorkerCacheHeaders(res);
    // Required: the script's directory-derived max scope is /app/, which as a string prefix would
    // not cover the bare /app document URL; this header allows registration with scope '/app'.
    res.setHeader('Service-Worker-Allowed', '/app');
    res.send(script);
  });

  return routes;
}
