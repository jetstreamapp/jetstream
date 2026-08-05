import { getLocalStore, hasLocalStore } from '@jetstream/shared/data';
import { sha1Hex } from '@jetstream/shared/utils';
import localforage from 'localforage';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearLocalStorageScope, ensureLocalStorageReady, isDifferentUserThanPageSession } from '../client-data.db';
import { getDexieDb, getScopedDexieDbName, hasDexieDb } from '../ui-db';

/**
 * Runs as a single sequential test because the page session user is module state — the whole point
 * is that it is captured once per page and survives a logout.
 */
describe('isDifferentUserThanPageSession', () => {
  it('tracks the user this page scoped storage to, across sign out and back in', async () => {
    expect(isDifferentUserThanPageSession('user-a')).toBe(false);

    await ensureLocalStorageReady({ userId: 'user-a', dbName: 'Jetstream' });
    expect(isDifferentUserThanPageSession('user-a')).toBe(false);
    expect(isDifferentUserThanPageSession('user-b')).toBe(true);

    // Signing out must not forget who this page belongs to, otherwise the next account to sign in
    // would look like the original user and keep the previous user's in-memory state.
    clearLocalStorageScope();
    expect(isDifferentUserThanPageSession('user-a')).toBe(false);
    expect(isDifferentUserThanPageSession('user-b')).toBe(true);

    // Re-scoping to another user does not reset it either — the page still has to reload.
    await ensureLocalStorageReady({ userId: 'user-b', dbName: 'Jetstream' });
    expect(isDifferentUserThanPageSession('user-b')).toBe(true);
  });

  it('ignores the no-user state so a logged out page never asks for a reload', () => {
    expect(isDifferentUserThanPageSession(null)).toBe(false);
    expect(isDifferentUserThanPageSession(undefined)).toBe(false);
    expect(isDifferentUserThanPageSession('')).toBe(false);
  });
});

describe('ensureLocalStorageReady scope ownership', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearLocalStorageScope();
  });

  it('binds only the newest user when scope builds race, and both stores commit together', async () => {
    type LocalStore = ReturnType<typeof localforage.createInstance>;
    const createInstance = vi.spyOn(localforage, 'createInstance').mockImplementation(
      (options) =>
        ({
          name: options?.storeName,
          ready: () => Promise.resolve(),
          getItem: () => Promise.resolve(null),
        }) as unknown as LocalStore,
    );

    // Start user-a's build, then take over with user-b before it can commit. The synchronous claim
    // in ensureScopeReady means the superseded build must never bind either store.
    const first = ensureLocalStorageReady({ userId: 'race-user-a', dbName: 'Jetstream' });
    const second = ensureLocalStorageReady({ userId: 'race-user-b', dbName: 'Jetstream' });
    await Promise.all([first, second]);

    expect(createInstance.mock.results).toHaveLength(2);
    expect(hasLocalStore()).toBe(true);
    expect(hasDexieDb()).toBe(true);
    // Both bound stores belong to user-b — the superseded user-a build never committed either one
    expect((getLocalStore() as unknown as { name: string }).name).toBe(`u_${await sha1Hex('race-user-b')}`);
    expect(getDexieDb().name).toBe(await getScopedDexieDbName('race-user-b'));
  });

  it('fails closed when the store build throws, then recovers on the next attempt', async () => {
    vi.spyOn(localforage, 'createInstance').mockImplementationOnce(() => {
      throw new Error('storage unavailable');
    });

    // The promise must resolve (it gates render via Suspense), but nothing may be bound.
    await ensureLocalStorageReady({ userId: 'failing-user', dbName: 'Jetstream' });
    expect(hasLocalStore()).toBe(false);
    expect(hasDexieDb()).toBe(false);
    expect(() => getDexieDb()).toThrow(/has not been initialized/);

    // The failed attempt is forgotten rather than cached as "ready", so a retry succeeds.
    await ensureLocalStorageReady({ userId: 'failing-user', dbName: 'Jetstream' });
    expect(hasLocalStore()).toBe(true);
    expect(hasDexieDb()).toBe(true);
  });
});
