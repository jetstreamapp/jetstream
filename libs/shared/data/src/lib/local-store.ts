import { logger } from '@jetstream/shared/client-logger';
import { sha1Hex } from '@jetstream/shared/utils';
import localforage from 'localforage';

/**
 * Per-user localforage store.
 *
 * Before per-user scoping every account on a machine shared a single localforage store, so one
 * user's history/preferences were readable by the next (see security finding F7). The store is
 * now scoped per authenticated user by `storeName` (an object store) *within* the app's existing
 * IndexedDB database — the database name is intentionally left unchanged because it is historically
 * load-bearing. Callers must go through {@link getLocalStore} rather than the default localforage
 * instance so their data always lands in the current user's store.
 *
 * This module is deliberately a dumb holder plus a factory. Which user is active — including every
 * race around a fast user switch — is owned by a single authority, `DexieInitializer` in
 * `@jetstream/ui/db`, which builds the instance via {@link createUserLocalStore} and commits it via
 * {@link setLocalStore} together with the matching Dexie instance, so the two stores can never
 * disagree about which account is bound.
 *
 * {@link getLocalStore} throws when no user has been scoped yet, mirroring `getDexieDb()`. That is
 * deliberate: a silent fallback to the shared instance is exactly the pre-fix behavior, and it is
 * invisible — a caller that reads before scoping (e.g. at module evaluation) would read the shared
 * store while its writes land in the per-user one. The handful of surfaces that genuinely have no
 * user must opt in explicitly via {@link getUnscopedLocalStore}.
 */

type LocalStore = ReturnType<typeof localforage.createInstance>;

let localStore: LocalStore | null = null;

export interface CreateUserLocalStoreOptions {
  /** IndexedDB database name — the app's environment name, unchanged from the legacy store. */
  dbName: string;
  /** Authenticated user id used to scope the object store name. */
  userId: string;
}

/**
 * Create the per-user store instance without binding it — the caller decides whether to commit it
 * via {@link setLocalStore} (a build can be superseded by a faster user switch).
 *
 * The user id is hashed so it is never exposed verbatim as an IndexedDB object store name —
 * matching `getScopedDexieDbName`. This matters most for canvas, where the scope id is a
 * Salesforce username (an email-shaped value).
 */
export async function createUserLocalStore({ dbName, userId }: CreateUserLocalStoreOptions): Promise<LocalStore> {
  const store = localforage.createInstance({ name: dbName, storeName: `u_${await sha1Hex(userId)}` });
  // Settle the driver up front so `driver()` is meaningful synchronously — deploy history only
  // stores package files when IndexedDB is the active driver, and on a freshly created instance
  // that check would otherwise run before a driver has been selected.
  await store.ready().catch((ex) => logger.warn('[LOCAL-STORE] Storage driver failed to initialize', ex));
  return store;
}

/**
 * Bind the active per-user store, or unbind it with `null` (logout / account switch) so no read
 * can reach the previous user's data. Only the scope owner (`DexieInitializer` in
 * `@jetstream/ui/db`) may call this — everything else reads through {@link getLocalStore}.
 */
export function setLocalStore(store: LocalStore | null): void {
  localStore = store;
}

/**
 * Return the current user's store. Throws if called before a user has been scoped — every caller
 * reached from authenticated UI is gated behind `ensureLocalStorageReady`, so this indicates a read
 * that escaped that gate (typically an eagerly evaluated module-level read).
 */
export function getLocalStore(): LocalStore {
  if (!localStore) {
    throw new Error('Local store has not been initialized. Await ensureLocalStorageReady() before accessing local storage.');
  }
  return localStore;
}

/**
 * The default, un-scoped localforage instance — shared by every account on the machine.
 *
 * Only for the few contexts that legitimately run without a signed-in user: reading the cached theme
 * before React mounts, and reading the pre-user-scoping data during the adopt-once migration. Never
 * use this for user data on an authenticated surface; use {@link getLocalStore}.
 */
export function getUnscopedLocalStore(): LocalStore {
  return localforage;
}

/** True once a user-scoped store has been bound. */
export function hasLocalStore(): boolean {
  return !!localStore;
}
