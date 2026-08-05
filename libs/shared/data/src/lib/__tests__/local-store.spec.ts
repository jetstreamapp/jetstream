import localforage from 'localforage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createUserLocalStore, getLocalStore, getUnscopedLocalStore, hasLocalStore, setLocalStore } from '../local-store';

type LocalStore = ReturnType<typeof localforage.createInstance>;

function fakeLocalStore(name: string): LocalStore {
  return { name, ready: () => Promise.resolve() } as unknown as LocalStore;
}

describe('local-store (per-user scoping)', () => {
  beforeEach(() => {
    setLocalStore(null);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    setLocalStore(null);
  });

  it('throws instead of silently falling back to the shared instance before a user is bound', () => {
    expect(hasLocalStore()).toBe(false);
    expect(() => getLocalStore()).toThrow(/has not been initialized/);
  });

  it('exposes the shared instance only through the explicit un-scoped accessor', () => {
    expect(getUnscopedLocalStore()).toBe(localforage);
  });

  it('creates the store scoped by a hash of the user id, without binding it', async () => {
    const fakeInstance = fakeLocalStore('scoped');
    const createInstance = vi.spyOn(localforage, 'createInstance').mockReturnValue(fakeInstance);

    const store = await createUserLocalStore({ dbName: 'Jetstream', userId: 'user-123' });

    expect(store).toBe(fakeInstance);
    expect(createInstance).toHaveBeenCalledWith(
      // 40 hex chars = SHA-1
      expect.objectContaining({ name: 'Jetstream', storeName: expect.stringMatching(/^u_[0-9a-f]{40}$/) }),
    );
    // Creation alone must not bind — the scope owner commits via setLocalStore
    expect(hasLocalStore()).toBe(false);
  });

  it('never uses the raw user id in the store name', async () => {
    const userId = 'alice@example.com';
    const createInstance = vi.spyOn(localforage, 'createInstance');
    await createUserLocalStore({ dbName: 'Jetstream', userId });
    const [{ storeName }] = createInstance.mock.calls[0] as unknown as [{ storeName: string }];
    expect(storeName).not.toContain(userId);
  });

  it('is deterministic for the same user and distinct for different users', async () => {
    const createInstance = vi.spyOn(localforage, 'createInstance');
    await createUserLocalStore({ dbName: 'Jetstream', userId: 'user-a' });
    await createUserLocalStore({ dbName: 'Jetstream', userId: 'user-a' });
    await createUserLocalStore({ dbName: 'Jetstream', userId: 'user-b' });
    const [[first], [second], [third]] = createInstance.mock.calls as unknown as Array<[{ storeName: string }]>;
    expect(first.storeName).toBe(second.storeName);
    expect(first.storeName).not.toBe(third.storeName);
  });

  it('binds and unbinds through setLocalStore so reads fail closed after a logout', () => {
    const store = fakeLocalStore('scoped');
    setLocalStore(store);
    expect(hasLocalStore()).toBe(true);
    expect(getLocalStore()).toBe(store);

    setLocalStore(null);
    expect(hasLocalStore()).toBe(false);
    expect(() => getLocalStore()).toThrow(/has not been initialized/);
  });
});
