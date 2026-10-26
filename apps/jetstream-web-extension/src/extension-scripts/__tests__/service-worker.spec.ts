/**
 * Regression coverage for the frequent-logout fix in the browser extension service worker.
 *
 * handleVerifyAuth must only sign out on a DEFINITIVE auth failure — an HTTP 401 with a parseable
 * { success: false } body — and then only on this install: the token is shared through Chrome Sync,
 * so it is recorded as rejected in storage.local instead of being removed from storage.sync.
 * Transient conditions (network failure, 5xx, other non-401 status, or an unparseable/HTML body from
 * an upstream proxy) must keep the cached session so the user is not logged out spuriously.
 *
 * The service worker keeps the verified token in a module-level cache (storageSyncCache) that is
 * normally hydrated by the real storage.onChanged listener. The tests reuse that listener (captured
 * from the mocked webextension-polyfill) to seed the cache before invoking handleVerifyAuth.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleVerifyAuth } from '../service-worker';

const swMock = vi.hoisted(() => {
  const state: {
    syncStore: Record<string, unknown>;
    localStore: Record<string, unknown>;
    onChangedListener: ((changes: Record<string, { newValue: unknown }>, namespace: string) => void) | null;
  } = { syncStore: {}, localStore: {}, onChangedListener: null };

  const sync = {
    get: vi.fn(async (keys?: string | string[]) => {
      if (keys == null) {
        return { ...state.syncStore };
      }
      const keyArr = Array.isArray(keys) ? keys : [keys];
      const result: Record<string, unknown> = {};
      for (const key of keyArr) {
        if (key in state.syncStore) {
          result[key] = state.syncStore[key];
        }
      }
      return result;
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(state.syncStore, items);
    }),
    remove: vi.fn(async (key: string) => {
      delete state.syncStore[key];
    }),
  };

  const local = {
    get: vi.fn(async (key: string) => (key in state.localStore ? { [key]: state.localStore[key] } : {})),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(state.localStore, items);
    }),
    remove: vi.fn(async (key: string) => {
      delete state.localStore[key];
    }),
  };

  const browser = {
    storage: {
      sync,
      local,
      session: {
        get: vi.fn(async () => ({})),
        set: vi.fn(async () => undefined),
      },
      onChanged: {
        addListener: vi.fn((cb: (changes: Record<string, { newValue: unknown }>, namespace: string) => void) => {
          state.onChangedListener = cb;
        }),
      },
    },
    runtime: {
      onInstalled: { addListener: vi.fn() },
      onMessage: { addListener: vi.fn() },
      onMessageExternal: { addListener: vi.fn() },
      getManifest: vi.fn(() => ({ version: '1.2.3' })),
      getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
    },
    tabs: { onActivated: { addListener: vi.fn() }, create: vi.fn() },
    commands: { onCommand: { addListener: vi.fn() } },
    cookies: { get: vi.fn(), getAll: vi.fn() },
  };

  return { state, browser, sync, local };
});

vi.mock('webextension-polyfill', () => ({ default: swMock.browser }));
vi.mock('../../environments/environment', () => ({ environment: { serverUrl: 'https://server.test', production: false } }));
vi.mock('../../utils/api-client', () => ({ initApiClientAndOrg: vi.fn() }));
vi.mock('../../utils/data-collection-consent', () => ({ registerSyncDataCollectionGuard: vi.fn() }));
vi.mock('@jetstream/shared/client-logger', () => ({
  enableLogger: vi.fn(),
  logger: { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('jwt-decode', () => ({ jwtDecode: vi.fn(() => ({ exp: 4102444800 })) }));

const AUTH_KEY = 'authTokens';
const REJECTED_KEY = 'rejectedAccessToken';
const senderMock = { tab: undefined } as never;

function seedAuth(accessToken: string, overrides: Record<string, unknown> = {}) {
  const authTokens = {
    accessToken,
    userProfile: { id: 'user-1', email: 'test@example.com' },
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    lastChecked: null,
    loggedIn: true,
    ...overrides,
  };
  const extIdentifier = { id: 'device-1' };
  // Hydrate storageSyncCache through the real onChanged listener the SUT registered on import.
  swMock.state.onChangedListener?.({ authTokens: { newValue: authTokens }, extIdentifier: { newValue: extIdentifier } }, 'sync');
  // Also reflect into the backing store so the pre-write re-read inside handleVerifyAuth matches.
  swMock.state.syncStore.authTokens = authTokens;
  swMock.state.syncStore.extIdentifier = extIdentifier;
  return authTokens;
}

function jsonResponse(status: number, data: unknown) {
  return { status, json: async () => ({ data }) } as unknown as Response;
}

/** The API's generic error handler body, used when the auth middleware rejects a token before the verify controller runs */
function errorHandlerResponse(status: number, message: string) {
  return { status, json: async () => ({ error: true, success: false, message }) } as unknown as Response;
}

function unparseableResponse(status: number) {
  return {
    status,
    json: async () => {
      throw new SyntaxError('Unexpected token < in JSON at position 0');
    },
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

describe('service-worker handleVerifyAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    swMock.state.syncStore = {};
    swMock.state.localStore = {};
    // The rejected token lives in a module-level variable too, reset it through the real onChanged listener
    swMock.state.onChangedListener?.({ [REJECTED_KEY]: { newValue: undefined } }, 'local');
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the cached session when the fetch rejects (offline / DNS failure)', async () => {
    seedAuth('token-1');
    fetchMock.mockRejectedValue(new Error('Failed to fetch'));

    const result = await handleVerifyAuth(senderMock);

    expect(result).toEqual({ hasTokens: true, loggedIn: true });
    expect(swMock.sync.remove).not.toHaveBeenCalled();
    expect(swMock.state.syncStore.authTokens).toBeDefined();
  });

  it('keeps the cached session on a 5xx response', async () => {
    seedAuth('token-1');
    fetchMock.mockResolvedValue(jsonResponse(500, { success: false, error: 'server error' }));

    const result = await handleVerifyAuth(senderMock);

    expect(result).toEqual({ hasTokens: true, loggedIn: true });
    expect(swMock.sync.remove).not.toHaveBeenCalled();
  });

  it('keeps the cached session when the body is unparseable/HTML even with a 401 status', async () => {
    seedAuth('token-1');
    fetchMock.mockResolvedValue(unparseableResponse(401));

    const result = await handleVerifyAuth(senderMock);

    expect(result).toEqual({ hasTokens: true, loggedIn: true });
    expect(swMock.sync.remove).not.toHaveBeenCalled();
  });

  it('signs out this install on a definitive 401 with a { success: false } body', async () => {
    seedAuth('token-1');
    fetchMock.mockResolvedValue(jsonResponse(401, { success: false, error: 'Invalid session' }));

    const result = await handleVerifyAuth(senderMock);

    expect(result).toEqual({ hasTokens: true, loggedIn: false, error: 'Invalid session' });
    expect(swMock.sync.remove).not.toHaveBeenCalled();
    expect(swMock.state.localStore[REJECTED_KEY]).toBe('token-1');
  });

  it('signs out this install when the auth middleware rejects an expired or revoked token', async () => {
    seedAuth('token-1');
    fetchMock.mockResolvedValue(errorHandlerResponse(401, 'Unauthorized'));

    const result = await handleVerifyAuth(senderMock);

    expect(result).toEqual({ hasTokens: true, loggedIn: false, error: 'Unauthorized' });
    expect(swMock.sync.remove).not.toHaveBeenCalled();
    expect(swMock.state.localStore[REJECTED_KEY]).toBe('token-1');
    expect(await handleVerifyAuth(senderMock)).toEqual({ hasTokens: false, loggedIn: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('leaves the shared token alone when another install rotated it but Chrome Sync has not delivered the replacement', async () => {
    const seeded = seedAuth('token-1');
    fetchMock.mockResolvedValueOnce(errorHandlerResponse(401, 'Unauthorized'));

    const result = await handleVerifyAuth(senderMock);

    expect(result).toEqual({ hasTokens: true, loggedIn: false, error: 'Unauthorized' });
    expect(swMock.sync.remove).not.toHaveBeenCalled();
    expect(swMock.sync.set).not.toHaveBeenCalled();
    expect(swMock.state.syncStore.authTokens).toEqual(seeded);

    // The rotated token arrives later and signs this install back in
    seedAuth('token-2');
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { success: true }));

    expect(await handleVerifyAuth(senderMock)).toEqual({ hasTokens: true, loggedIn: true });
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token-2' }) }),
    );
  });

  it('keeps the cached session on a 5xx from the API error handler', async () => {
    seedAuth('token-1');
    fetchMock.mockResolvedValue(errorHandlerResponse(500, 'Internal Server Error'));

    const result = await handleVerifyAuth(senderMock);

    expect(result).toEqual({ hasTokens: true, loggedIn: true });
    expect(swMock.sync.remove).not.toHaveBeenCalled();
  });

  it('keeps a token that Chrome Sync replaced while the rejected verify was in flight', async () => {
    const seeded = seedAuth('token-1');
    const syncedFromOtherInstall = { ...seeded, accessToken: 'token-2' };
    fetchMock.mockImplementation(async () => {
      swMock.state.syncStore.authTokens = syncedFromOtherInstall;
      return errorHandlerResponse(401, 'Unauthorized');
    });

    const result = await handleVerifyAuth(senderMock);

    expect(result).toEqual({ hasTokens: true, loggedIn: true });
    expect(swMock.sync.remove).not.toHaveBeenCalled();
    expect(swMock.state.syncStore.authTokens).toEqual(syncedFromOtherInstall);
  });

  it('writes back a rotated token on success', async () => {
    seedAuth('token-1');
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, accessToken: 'rotated-token' }));

    const result = await handleVerifyAuth(senderMock);

    expect(result).toEqual({ hasTokens: true, loggedIn: true });
    expect(swMock.sync.remove).not.toHaveBeenCalled();
    expect(swMock.sync.set).toHaveBeenCalledWith(
      expect.objectContaining({ [AUTH_KEY]: expect.objectContaining({ accessToken: 'rotated-token', loggedIn: true }) }),
    );
    expect((swMock.state.syncStore.authTokens as { accessToken: string }).accessToken).toBe('rotated-token');
  });

  it('persists the fresh userProfile from the verify response so feature flags stay current', async () => {
    seedAuth('token-1');
    const freshProfile = {
      id: 'user-1',
      email: 'test@example.com',
      featureFlags: { 'analysis-tools': true },
      featureFlagsSignature: 'signature',
    };
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, userProfile: freshProfile }));

    const result = await handleVerifyAuth(senderMock);

    expect(result).toEqual({ hasTokens: true, loggedIn: true });
    expect((swMock.state.syncStore.authTokens as { userProfile: unknown }).userProfile).toEqual(freshProfile);
  });

  it('keeps the stored userProfile when the verify response omits it', async () => {
    const seeded = seedAuth('token-1');
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true }));

    const result = await handleVerifyAuth(senderMock);

    expect(result).toEqual({ hasTokens: true, loggedIn: true });
    expect((swMock.state.syncStore.authTokens as { userProfile: unknown }).userProfile).toEqual(seeded.userProfile);
  });
});
