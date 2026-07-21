/* eslint-disable no-restricted-globals */
/**
 * Jetstream precache service worker. Template only - `serviceWorkerPlugin` (vite.plugins.ts) substitutes
 * the version and precache-manifest placeholders below at build time and emits the result as `sw.js`,
 * which the API serves at /app/sw.js with `Service-Worker-Allowed: /app`.
 *
 * Design constraints - read before changing anything:
 *
 * - PRECACHE-ONLY, NETWORK-PASSTHROUGH BY DEFAULT. The fetch handler responds only to GET requests for
 *   hashed build assets emitted flat at the origin root (see vite.plugins.ts). Everything else - page
 *   navigations, /api/*, /socket.io, /oauth, streaming downloads/uploads, /assets/** (including Monaco,
 *   which is version- not content-hashed), /fonts - is never intercepted.
 * - NAVIGATIONS ARE NEVER CACHED. The /app shell is served no-store with a per-request CSP nonce
 *   ('strict-dynamic'); a cached copy would white-screen the app. Because navigations always hit the
 *   network, a plain reload always yields the newest build regardless of this worker's state - the worker
 *   can never hold the app hostage, and skipWaiting is a cache-hit optimization, not a correctness
 *   requirement.
 * - SCOPE IS /app. Scope governs which PAGES this worker controls (SPA documents only - never the landing
 *   site, /canvas, or /web-extension pages), not which URLs it can cache: controlled pages' requests for
 *   root-level hashed assets still flow through the fetch handler.
 * - OLD CACHES ARE RETAINED (newest 3). Each deploy replaces all hashed chunks on the server, so a
 *   still-open tab running an older build 404s on lazy loads today. Retained caches plus the cross-cache
 *   `caches.match` below keep those tabs working.
 */

const SW_VERSION = '__SW_VERSION__';
const PRECACHE_MANIFEST = __PRECACHE_MANIFEST__;

// Must equal SW_PRECACHE_PREFIX in @jetstream/shared/constants (this file cannot import it);
// sw.template.spec.ts fails if the two drift apart
const CACHE_PREFIX = 'jetstream-precache-';
const CACHE_NAME = `${CACHE_PREFIX}${SW_VERSION}`;
// Reserved key storing {version, createdAt} so activate can age caches; never a real asset path
const CACHE_META_PATH = '/__sw-cache-meta__';
const MAX_RETAINED_CACHES = 3;
// Hashed build assets are emitted flat at the origin root (base: './' + assetsDir: './' in vite.config.ts)
const ROOT_ASSET_PATTERN = /^\/[^/]+\.(js|css|woff2?|png|svg)$/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // A deploy changes only a few hashed files, so copy same-pathname entries from the retained
      // caches (content-hashed filenames make a pathname hit guaranteed current) and only fetch
      // what no cache has. First-ever installs fetch everything; later installs fetch the delta.
      const missingAssets = [];
      await Promise.all(
        PRECACHE_MANIFEST.map(async (assetPath) => {
          if (await cache.match(assetPath)) {
            return;
          }
          const existingResponse = await caches.match(assetPath);
          if (existingResponse) {
            await cache.put(assetPath, existingResponse);
          } else {
            missingAssets.push(assetPath);
          }
        }),
      );
      // Any failed fetch rejects install: the previous worker and caches stay active and the app is
      // unaffected (network passthrough). The browser retries on the next register()/update check.
      await cache.addAll(missingAssets);
      // Meta is written only after everything above succeeded. A failed install leaves a cache
      // with no meta (createdAt 0), which sorts oldest in activate-time pruning and is deleted
      // first - it never counts against the retention budget that protects still-open old tabs.
      await cache.put(CACHE_META_PATH, new Response(JSON.stringify({ version: SW_VERSION, createdAt: Date.now() })));
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = (await caches.keys()).filter((cacheName) => cacheName.startsWith(CACHE_PREFIX));
      const cachesWithAge = await Promise.all(
        cacheNames.map(async (cacheName) => {
          let createdAt = 0;
          try {
            const metaResponse = await (await caches.open(cacheName)).match(CACHE_META_PATH);
            if (metaResponse) {
              createdAt = (await metaResponse.json()).createdAt || 0;
            }
          } catch {
            // Unreadable meta - treat as oldest so it is pruned first
          }
          return { cacheName, createdAt };
        }),
      );
      const expiredCaches = cachesWithAge
        .sort((cacheA, cacheB) => cacheB.createdAt - cacheA.createdAt)
        .slice(MAX_RETAINED_CACHES)
        .filter(({ cacheName }) => cacheName !== CACHE_NAME);
      await Promise.all(expiredCaches.map(({ cacheName }) => caches.delete(cacheName)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || request.mode === 'navigate') {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname === CACHE_META_PATH || !ROOT_ASSET_PATTERN.test(url.pathname)) {
    return;
  }
  // Cross-cache match (all retained versions) keeps still-open old tabs working after a deploy.
  // The network fallback covers new-version assets requested while an older worker is still active.
  event.respondWith(caches.match(url.pathname).then((cachedResponse) => cachedResponse || fetch(request)));
});
