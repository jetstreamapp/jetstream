import { INDEXED_DB, LEGACY_LOCAL_STORAGE_KEYS } from '@jetstream/shared/constants';
import { getLocalStore, hasLocalStore } from '@jetstream/shared/data';
import { sha1Hex } from '@jetstream/shared/utils';
import localforage from 'localforage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  adoptLegacyAnonymousApexDraft,
  clearLocalStorageScope,
  ensureLocalStorageReady,
  isDifferentUserThanPageSession,
} from '../client-data.db';
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

describe('adoptLegacyAnonymousApexDraft', () => {
  // The on-disk marker written by the legacy store adoption, keyed by the hashed user id
  const LEGACY_CLAIM_OWNER_KEY = 'JETSTREAM_LEGACY_STORE_CLAIM_OWNER';
  const OWNER_USER_ID = 'draft-owner';
  const OTHER_USER_ID = 'draft-other-user';
  const SHARED_DRAFT = 'System.debug(1);';

  let userStore: Map<string, unknown>;

  beforeEach(() => {
    localStorage.clear();
    userStore = new Map();
    vi.spyOn(localforage, 'createInstance').mockImplementation(
      () =>
        ({
          ready: () => Promise.resolve(),
          getItem: (key: string) => Promise.resolve(userStore.has(key) ? userStore.get(key) : null),
          setItem: (key: string, value: unknown) => {
            userStore.set(key, value);
            return Promise.resolve(value);
          },
        }) as unknown as ReturnType<typeof localforage.createInstance>,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearLocalStorageScope();
    localStorage.clear();
  });

  async function signInWithSharedDraft(userId: string) {
    localStorage.setItem(LEGACY_CLAIM_OWNER_KEY, await sha1Hex(OWNER_USER_ID));
    localStorage.setItem(LEGACY_LOCAL_STORAGE_KEYS.anonymousApexDraft, SHARED_DRAFT);
    await ensureLocalStorageReady({ userId, dbName: 'Jetstream' });
  }

  it('moves the shared draft into the per-user store of the account that owns the legacy claim', async () => {
    await signInWithSharedDraft(OWNER_USER_ID);

    await adoptLegacyAnonymousApexDraft(OWNER_USER_ID);

    expect(userStore.get(INDEXED_DB.KEYS.anonymousApexDraft)).toBe(SHARED_DRAFT);
    expect(localStorage.getItem(LEGACY_LOCAL_STORAGE_KEYS.anonymousApexDraft)).toBeNull();
  });

  it('never hands the shared draft to an account that does not own the legacy claim', async () => {
    await signInWithSharedDraft(OTHER_USER_ID);

    await adoptLegacyAnonymousApexDraft(OTHER_USER_ID);

    expect(userStore.has(INDEXED_DB.KEYS.anonymousApexDraft)).toBe(false);
    // Left in place for the owner's next sign-in
    expect(localStorage.getItem(LEGACY_LOCAL_STORAGE_KEYS.anonymousApexDraft)).toBe(SHARED_DRAFT);
  });

  it('does not adopt when no account has claimed the legacy stores', async () => {
    localStorage.setItem(LEGACY_LOCAL_STORAGE_KEYS.anonymousApexDraft, SHARED_DRAFT);
    await ensureLocalStorageReady({ userId: OWNER_USER_ID, dbName: 'Jetstream' });

    await adoptLegacyAnonymousApexDraft(OWNER_USER_ID);

    expect(userStore.has(INDEXED_DB.KEYS.anonymousApexDraft)).toBe(false);
    expect(localStorage.getItem(LEGACY_LOCAL_STORAGE_KEYS.anonymousApexDraft)).toBe(SHARED_DRAFT);
  });

  it("keeps the owner's own draft and still removes the shared copy", async () => {
    await signInWithSharedDraft(OWNER_USER_ID);
    userStore.set(INDEXED_DB.KEYS.anonymousApexDraft, 'mine');

    await adoptLegacyAnonymousApexDraft(OWNER_USER_ID);

    expect(userStore.get(INDEXED_DB.KEYS.anonymousApexDraft)).toBe('mine');
    expect(localStorage.getItem(LEGACY_LOCAL_STORAGE_KEYS.anonymousApexDraft)).toBeNull();
  });

  it('keeps the shared draft when the per-user write fails, so the owner retries on their next sign-in', async () => {
    await signInWithSharedDraft(OWNER_USER_ID);
    vi.spyOn(getLocalStore(), 'setItem').mockRejectedValueOnce(new Error('QuotaExceededError'));

    await adoptLegacyAnonymousApexDraft(OWNER_USER_ID);

    expect(userStore.has(INDEXED_DB.KEYS.anonymousApexDraft)).toBe(false);
    expect(localStorage.getItem(LEGACY_LOCAL_STORAGE_KEYS.anonymousApexDraft)).toBe(SHARED_DRAFT);

    await adoptLegacyAnonymousApexDraft(OWNER_USER_ID);

    expect(userStore.get(INDEXED_DB.KEYS.anonymousApexDraft)).toBe(SHARED_DRAFT);
    expect(localStorage.getItem(LEGACY_LOCAL_STORAGE_KEYS.anonymousApexDraft)).toBeNull();
  });
});
