import { SW_PRECACHE_PREFIX } from '@jetstream/shared/constants';
import templateSource from '../sw.template.js?raw';

/**
 * Exercises the service worker template (sw.template.js) by substituting the build-time
 * placeholders and evaluating it against mocked SW globals. Covers the logic that has no other
 * automated coverage: delta install (copy from retained caches), meta-after-success ordering,
 * activate-time cache retention, and the fetch interception rules.
 */

const ORIGIN = 'https://getjetstream.app';
const META_PATH = '/__sw-cache-meta__';

class MockResponse {
  constructor(public body: string) {}
  async json() {
    return JSON.parse(this.body);
  }
}

interface MockFetchEvent {
  request: { url: string; method: string; mode: string };
  respondWith: (response: Promise<unknown>) => void;
}

type EventHandler = (event: { waitUntil: (promise: Promise<unknown>) => void } & Partial<MockFetchEvent> & { data?: unknown }) => void;

function createHarness({ version, manifest, failFetchFor = [] }: { version: string; manifest: string[]; failFetchFor?: string[] }) {
  const cacheStores = new Map<string, Map<string, MockResponse>>();
  const fetchedPaths: string[] = [];

  const mockFetch = async (request: string | { url: string }) => {
    const url = typeof request === 'string' ? request : request.url;
    const path = url.replace(ORIGIN, '');
    if (failFetchFor.includes(path)) {
      throw new Error(`fetch failed: ${path}`);
    }
    fetchedPaths.push(path);
    return new MockResponse(`network:${path}`);
  };

  const openCache = (cacheName: string) => {
    if (!cacheStores.has(cacheName)) {
      cacheStores.set(cacheName, new Map());
    }
    const store = cacheStores.get(cacheName) as Map<string, MockResponse>;
    return {
      match: async (path: string) => store.get(path),
      put: async (path: string, response: MockResponse) => {
        store.set(path, response);
      },
      addAll: async (paths: string[]) => {
        for (const path of paths) {
          store.set(path, await mockFetch(path));
        }
      },
      keys: async () => [...store.keys()],
    };
  };

  const caches = {
    open: async (cacheName: string) => openCache(cacheName),
    keys: async () => [...cacheStores.keys()],
    delete: async (cacheName: string) => cacheStores.delete(cacheName),
    match: async (path: string) => {
      for (const store of cacheStores.values()) {
        if (store.has(path)) {
          return store.get(path);
        }
      }
      return undefined;
    },
  };

  const handlers: Record<string, EventHandler> = {};
  const self = {
    addEventListener: (type: string, handler: EventHandler) => {
      handlers[type] = handler;
    },
    location: { origin: ORIGIN },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(async () => undefined) },
  };

  const source = templateSource.replaceAll('__SW_VERSION__', version).replaceAll('__PRECACHE_MANIFEST__', JSON.stringify(manifest));
  // eslint-disable-next-line no-new-func -- evaluating the SW template against mocked globals is the point of this spec
  new Function('self', 'caches', 'Response', 'fetch', source)(self, caches, MockResponse, mockFetch);

  const runInstall = async () => {
    let installPromise: Promise<unknown> = Promise.resolve();
    handlers.install({ waitUntil: (promise) => (installPromise = promise) });
    await installPromise;
  };
  const runActivate = async () => {
    let activatePromise: Promise<unknown> = Promise.resolve();
    handlers.activate({ waitUntil: (promise) => (activatePromise = promise) });
    await activatePromise;
  };
  const dispatchFetch = async (request: MockFetchEvent['request']): Promise<{ intercepted: boolean; response: unknown }> => {
    let responded: Promise<unknown> | null = null;
    handlers.fetch({ request, respondWith: (response) => (responded = response) } as never);
    return { intercepted: responded !== null, response: responded === null ? null : await responded };
  };
  const seedCache = async (cacheName: string, paths: string[], createdAt: number | null) => {
    const cache = openCache(cacheName);
    for (const path of paths) {
      await cache.put(path, new MockResponse(`seeded:${cacheName}:${path}`));
    }
    if (createdAt !== null) {
      await cache.put(META_PATH, new MockResponse(JSON.stringify({ createdAt })));
    }
  };

  return { cacheStores, fetchedPaths, handlers, self, runInstall, runActivate, dispatchFetch, seedCache };
}

describe('sw.template.js', () => {
  it('hard-codes the same cache prefix as SW_PRECACHE_PREFIX (cannot import it)', () => {
    expect(templateSource).toContain(`const CACHE_PREFIX = '${SW_PRECACHE_PREFIX}';`);
  });

  describe('install', () => {
    it('fetches every asset on a first-ever install and writes meta last', async () => {
      const manifest = ['/index-AAA.js', '/src-BBB.js', '/index-CCC.css'];
      const harness = createHarness({ version: 'v1', manifest });

      await harness.runInstall();

      const store = harness.cacheStores.get(`${SW_PRECACHE_PREFIX}v1`);
      expect([...harness.fetchedPaths].sort()).toEqual([...manifest].sort());
      expect(store?.size).toBe(manifest.length + 1);
      await expect(store?.get(META_PATH)?.json()).resolves.toMatchObject({ version: 'v1' });
    });

    it('copies unchanged assets from retained caches and fetches only the delta', async () => {
      const harness = createHarness({ version: 'v2', manifest: ['/shared-AAA.js', '/src-NEW.js'] });
      await harness.seedCache(`${SW_PRECACHE_PREFIX}v1`, ['/shared-AAA.js', '/src-OLD.js'], 1);

      await harness.runInstall();

      expect(harness.fetchedPaths).toEqual(['/src-NEW.js']);
      const store = harness.cacheStores.get(`${SW_PRECACHE_PREFIX}v2`);
      expect(store?.get('/shared-AAA.js')?.body).toBe(`seeded:${SW_PRECACHE_PREFIX}v1:/shared-AAA.js`);
      expect(store?.has('/src-OLD.js')).toBe(false);
      expect(store?.has(META_PATH)).toBe(true);
    });

    it('leaves no meta entry when an asset fetch fails, so the partial cache prunes first', async () => {
      const harness = createHarness({ version: 'v1', manifest: ['/index-AAA.js', '/src-404.js'], failFetchFor: ['/src-404.js'] });

      await expect(harness.runInstall()).rejects.toThrow('fetch failed');
      expect(harness.cacheStores.get(`${SW_PRECACHE_PREFIX}v1`)?.has(META_PATH)).toBe(false);
    });
  });

  describe('activate', () => {
    it('keeps the newest 3 caches, prunes meta-less partial caches first, and claims clients', async () => {
      const harness = createHarness({ version: 'v5', manifest: ['/index-EEE.js'] });
      await harness.seedCache(`${SW_PRECACHE_PREFIX}v1`, ['/a.js'], 1);
      await harness.seedCache(`${SW_PRECACHE_PREFIX}v2`, ['/b.js'], 2);
      await harness.seedCache(`${SW_PRECACHE_PREFIX}v3`, ['/c.js'], 3);
      await harness.seedCache(`${SW_PRECACHE_PREFIX}v4`, ['/d.js'], 4);
      await harness.seedCache(`${SW_PRECACHE_PREFIX}partial`, ['/e.js'], null);

      await harness.runInstall();
      await harness.runActivate();

      expect([...harness.cacheStores.keys()].sort()).toEqual(
        [`${SW_PRECACHE_PREFIX}v5`, `${SW_PRECACHE_PREFIX}v4`, `${SW_PRECACHE_PREFIX}v3`].sort(),
      );
      expect(harness.self.clients.claim).toHaveBeenCalled();
    });

    it('never prunes the current cache regardless of meta ordering', async () => {
      const harness = createHarness({ version: 'current', manifest: ['/index-AAA.js'] });
      await harness.runInstall();
      // Seed newer-looking caches AFTER install so their createdAt sorts ahead of the current one
      await harness.seedCache(`${SW_PRECACHE_PREFIX}n1`, ['/a.js'], Date.now() + 1000);
      await harness.seedCache(`${SW_PRECACHE_PREFIX}n2`, ['/b.js'], Date.now() + 2000);
      await harness.seedCache(`${SW_PRECACHE_PREFIX}n3`, ['/c.js'], Date.now() + 3000);

      await harness.runActivate();

      expect(harness.cacheStores.has(`${SW_PRECACHE_PREFIX}current`)).toBe(true);
    });
  });

  describe('fetch', () => {
    const setup = async () => {
      const harness = createHarness({ version: 'v1', manifest: ['/index-AAA.js', '/index-BBB.css'] });
      await harness.runInstall();
      return harness;
    };

    it('serves precached root assets from cache, with network fallback for unknown hashes', async () => {
      const harness = await setup();
      const cached = await harness.dispatchFetch({ url: `${ORIGIN}/index-AAA.js`, method: 'GET', mode: 'no-cors' });
      expect(cached.intercepted).toBe(true);
      expect((cached.response as MockResponse).body).toBe('network:/index-AAA.js');

      const unknown = await harness.dispatchFetch({ url: `${ORIGIN}/src-NEWHASH.js`, method: 'GET', mode: 'no-cors' });
      expect(unknown.intercepted).toBe(true);
      expect(harness.fetchedPaths).toContain('/src-NEWHASH.js');
    });

    it('serves an older version chunk from a retained cache (still-open old tab after a deploy)', async () => {
      const harness = await setup();
      await harness.seedCache(`${SW_PRECACHE_PREFIX}v0`, ['/src-OLDTAB.js'], 0);
      const result = await harness.dispatchFetch({ url: `${ORIGIN}/src-OLDTAB.js`, method: 'GET', mode: 'no-cors' });
      expect(result.intercepted).toBe(true);
      expect((result.response as MockResponse).body).toBe(`seeded:${SW_PRECACHE_PREFIX}v0:/src-OLDTAB.js`);
    });

    it.each([
      ['navigation', { url: `${ORIGIN}/app`, method: 'GET', mode: 'navigate' }],
      ['API call', { url: `${ORIGIN}/api/heartbeat`, method: 'GET', mode: 'no-cors' }],
      ['socket.io polling', { url: `${ORIGIN}/socket.io/?EIO=4`, method: 'GET', mode: 'no-cors' }],
      ['monaco AMD file', { url: `${ORIGIN}/assets/js/monaco/vs/loader.js`, method: 'GET', mode: 'no-cors' }],
      ['streamed download', { url: `${ORIGIN}/api/file/stream-download?x=1`, method: 'GET', mode: 'no-cors' }],
      ['POST to a root path', { url: `${ORIGIN}/index-AAA.js`, method: 'POST', mode: 'no-cors' }],
      ['cross-origin script', { url: 'https://cdn.example.com/lib.js', method: 'GET', mode: 'no-cors' }],
      ['cache meta path', { url: `${ORIGIN}${META_PATH}`, method: 'GET', mode: 'no-cors' }],
      ['oauth redirect', { url: `${ORIGIN}/oauth/sfdc/auth`, method: 'GET', mode: 'no-cors' }],
    ])('never intercepts: %s', async (_label, request) => {
      const harness = await setup();
      const result = await harness.dispatchFetch(request);
      expect(result.intercepted).toBe(false);
    });
  });

  describe('message', () => {
    it('honors SKIP_WAITING', () => {
      const harness = createHarness({ version: 'v1', manifest: [] });
      harness.handlers.message({ data: { type: 'SKIP_WAITING' }, waitUntil: () => undefined });
      expect(harness.self.skipWaiting).toHaveBeenCalled();
    });
  });
});
