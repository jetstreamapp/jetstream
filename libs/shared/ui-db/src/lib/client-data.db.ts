/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from '@jetstream/shared/client-logger';
import { INDEXED_DB } from '@jetstream/shared/constants';
import { createUserLocalStore, getLocalStore, getUnscopedLocalStore, hasLocalStore, setLocalStore } from '@jetstream/shared/data';
import { delay } from '@jetstream/shared/utils';
import { ApiHistoryItem, LoadSavedMappingItem, QueryHistoryItem } from '@jetstream/types';
import Dexie, { type Table } from 'dexie';
import 'dexie-observable';
import 'dexie-syncable';
import { initializeDexieSync } from './client-data-sync.db';
import { registerDbHooks } from './db-hooks';
import {
  AdoptableTables,
  createDexieInstance,
  DEXIE_DB_BASE_NAME,
  DEXIE_DB_SYNC_NAME,
  dexieDataSync,
  getDexieDb,
  getHashedRecordKey,
  getScopedDexieDbName,
  hasDexieDb,
  setDexieDbInstance,
  SyncableTables,
} from './ui-db';

/**
 * localStorage flag marking that the legacy (pre-user-scoping) shared stores have been
 * adopted into a per-user database. Stored per-origin so it is shared across every account
 * that signs in on the same machine/profile — this is what limits adoption to the first
 * account after the upgrade and prevents a later account from inheriting the prior data.
 */
const LEGACY_CLAIM_KEY = 'JETSTREAM_LEGACY_STORE_CLAIMED';

/**
 * localStorage flag recording which user started adoption, written before any data is copied.
 * Adoption is not atomic (it can be interrupted by a closed tab or a quit app), so the completion
 * marker alone is not enough: without this, an interrupted adoption would let the *next* account on
 * the machine re-run it and inherit the same legacy data. Owning the claim up front locks every
 * other account out immediately while still allowing the claiming user to retry.
 *
 * The value is a *hash* of the user id, matching `getScopedDexieDbName` and the localforage store
 * name. This marker outlives the session it was written in and is readable by every later account on
 * the machine, so storing the raw id would hand the next user an identifier for the previous one —
 * on canvas that id is a Salesforce username, which is email-shaped.
 */
const LEGACY_CLAIM_OWNER_KEY = 'JETSTREAM_LEGACY_STORE_CLAIM_OWNER';

/**
 * localStorage counter of failed adoption attempts by the claim owner. Adoption re-copies
 * everything on retry, so a persistent failure (e.g. a quota error on the blob-heavy tables)
 * would otherwise cost the user a full re-copy on every sign-in forever. After
 * {@link MAX_LEGACY_ADOPTION_ATTEMPTS} failures the store is stamped claimed and adoption gives
 * up, keeping whatever partial data landed (the small, irreplaceable tables copy first).
 */
const LEGACY_ADOPTION_ATTEMPTS_KEY = 'JETSTREAM_LEGACY_STORE_ADOPTION_ATTEMPTS';
const MAX_LEGACY_ADOPTION_ATTEMPTS = 3;

let syncProtocolRegistered = false;

/**
 * The first user this page scoped local storage to. Deliberately never cleared — it has to outlive
 * a logout so {@link isDifferentUserThanPageSession} can tell "the same user signed back in" apart
 * from "a different account took over a page that still holds the previous user's in-memory state".
 */
let pageSessionUserId: string | null = null;

class DexieInitializer {
  private static instance: DexieInitializer;
  private scopedUserId: string | null = null;
  private scopeReadyPromise: Promise<void> | null = null;
  private initPromise: Promise<void> | null = null;

  /** Tracks whether the current instance has an active sync connection (reset per user). */
  private hasConnectedSync = false;

  static getInstance(): DexieInitializer {
    if (!this.instance) {
      this.instance = new this();
    }
    return this.instance;
  }

  /**
   * Point both local stores — the localforage instance and the Dexie database — at the given user.
   * Resolves as soon as they exist, deliberately BEFORE the slower legacy-adoption and sync steps,
   * so UI gated on readiness (via React `use()`/Suspense) is not held on those. The promise is
   * cached per user with a stable identity; switching users rebuilds it and invalidates any prior
   * full-init/sync state.
   */
  ensureScopeReady(userId: string, dbName: string): Promise<void> {
    if (this.scopedUserId === userId && this.scopeReadyPromise) {
      return this.scopeReadyPromise;
    }
    // New user (or first init): drop the prior user's stores up front so reads fail closed while
    // the new ones are built rather than handing out the previous account's data. Any prior sync
    // connection and full-init promise no longer apply.
    this.clearScope();
    this.scopedUserId = userId;
    pageSessionUserId = pageSessionUserId ?? userId;
    this.scopeReadyPromise = (async () => {
      try {
        const [userLocalStore, scopedDbName] = await Promise.all([createUserLocalStore({ dbName, userId }), getScopedDexieDbName(userId)]);
        if (this.isSupersededScope(userId)) {
          return;
        }
        // Commit both stores back to back with no awaits in between, so they can never disagree
        // about which user is bound — a superseded or failed build simply never commits either one.
        const dexieInstance = createDexieInstance(scopedDbName, registerDbHooks);
        setLocalStore(userLocalStore);
        setDexieDbInstance(dexieInstance);
        // The preferences key is read at first paint (theme), well before the full legacy adoption
        // in `initDexieDb` runs — make it available before any consumer can read it and cache defaults.
        await adoptLegacyUserPreferences(userId);
      } catch (ex) {
        if (this.isSupersededScope(userId)) {
          return;
        }
        // Nothing was committed, so reads keep failing closed. Forget this attempt (rather than
        // caching the failure as "ready") so the next render retries, but never reject: this
        // promise gates app render via Suspense and must not take the app down.
        this.clearScope();
        logger.error('[DB] Error scoping local storage to user', ex);
      }
    })();
    return this.scopeReadyPromise;
  }

  /**
   * True when a newer user (or a logout) took over while this scope was still being built. Both
   * stores are module-level singletons, so a superseded scope must never commit — doing so would
   * rebind the app to an account it has already moved on from.
   */
  private isSupersededScope(userId: string): boolean {
    return this.scopedUserId !== userId;
  }

  /**
   * Drop both stores and all per-user state (user switch or logout) so reads throw instead of
   * serving the previous account's data until the next user is scoped.
   */
  clearScope(): void {
    if (!this.scopedUserId && !hasDexieDb() && !hasLocalStore()) {
      return;
    }
    this.scopedUserId = null;
    this.scopeReadyPromise = null;
    this.initPromise = null;
    this.hasConnectedSync = false;
    setDexieDbInstance(null);
    setLocalStore(null);
  }

  async init(userId: string, dbName: string) {
    try {
      // Guarantee the stores exist (and reset stale state if the user changed) before full init.
      await this.ensureScopeReady(userId, dbName);
      if (this.initPromise) {
        await this.initPromise;
        return;
      }
      this.initPromise = this._init(userId);
      await this.initPromise;
    } catch (ex) {
      // The scope itself is either valid or already failed closed inside `ensureScopeReady` — a
      // migration failure must not tear down working stores, so just drop the promise to let a
      // later call retry.
      this.initPromise = null;
      logger.error('[DB] Error initializing db', ex);
    }
  }

  async enableSync(enable: boolean) {
    // ensure we are initialized
    if (this.initPromise) {
      await this.initPromise;
    } else if (!this.scopedUserId) {
      return;
    }
    // Sync is disabled — disconnect if we have an active connection, otherwise no-op
    if (!enable) {
      if (this.hasConnectedSync) {
        await dexieDataSync.disconnect();
        this.hasConnectedSync = false;
      }
      return;
    }
    // The scope failed to build (stores unbound) — there is no database to sync against
    if (!hasDexieDb()) {
      return;
    }
    // Register the sync protocol once per process (the protocol name is instance-independent)
    if (!syncProtocolRegistered) {
      initializeDexieSync(DEXIE_DB_SYNC_NAME);
      syncProtocolRegistered = true;
    }
    // sometimes the connection does not initialize properly, delaying to ensure it does
    await delay(1000);
    await dexieDataSync.connect();
    this.hasConnectedSync = true;
  }

  private async _init(userId: string) {
    // The scope failed to build (see `ensureScopeReady`'s catch) — there is nothing to migrate
    // into, and starting adoption now would burn the legacy claim against unusable stores.
    if (!hasDexieDb() || !hasLocalStore()) {
      return;
    }

    // Adopt the pre-user-scoping shared data exactly once per machine/profile (first user post-upgrade)
    await adoptLegacySharedData(userId);

    // Backfill hashed keys on this user's own database (idempotent, per-user gated)
    await addHashedKeyToRecord();
  }
}

/** Stable resolved promise for the no-user state, so React `use()` never suspends without a user. */
const NOOP_STORAGE_READY = Promise.resolve();

export interface LocalStorageScope {
  /** Authenticated user id, or null when there is no signed-in user yet. */
  userId: string | null | undefined;
  /** IndexedDB database name for the localforage store — the app's environment name. */
  dbName: string;
}

/**
 * Resolve once the given user's local stores exist, so `getLocalStore()` and {@link getDexieDb} are
 * safe to call. Returns a stable per-user promise intended for React `use()` / Suspense, so no
 * descendant renders (and reads local storage) before the stores are scoped to the current user.
 * The heavier legacy-adoption and sync work runs separately in {@link initDexieDb} and is
 * intentionally not awaited here.
 *
 * With no user this is a pure no-op: tearing the stores down here would be a side effect during
 * render. Call {@link clearLocalStorageScope} explicitly where a session actually ends — on the
 * surfaces that render a logged-out state in place instead of reloading or navigating away, that
 * call is what keeps the departing account's stores from staying bound.
 */
export function ensureLocalStorageReady({ userId, dbName }: LocalStorageScope): Promise<void> {
  if (!userId) {
    return NOOP_STORAGE_READY;
  }
  return DexieInitializer.getInstance().ensureScopeReady(userId, dbName);
}

/**
 * End the current user's local storage session: close the Dexie connection and unbind both stores
 * so nothing can read the departing account's data. Call from logout, before reloading.
 */
export function clearLocalStorageScope(): void {
  DexieInitializer.getInstance().clearScope();
}

/**
 * True when `userId` is a different account than the one this page already scoped local storage to.
 *
 * Local storage re-scopes per user, but nothing else in the page does: jotai atoms and module level
 * caches keep serving whatever the previous account loaded. The web app and canvas can only change
 * users through a page load, but the desktop app and the browser extension can swap the signed-in
 * user in place (a session that expired back to the login screen, or auth state arriving over
 * `browser.storage`), so both check this and reload before rendering anything for the new user.
 */
export function isDifferentUserThanPageSession(userId: string | null | undefined): boolean {
  return !!userId && !!pageSessionUserId && userId !== pageSessionUserId;
}

export async function initDexieDb({ userId, dbName, recordSyncEnabled }: LocalStorageScope & { recordSyncEnabled: boolean }) {
  if (!userId) {
    return;
  }
  try {
    await DexieInitializer.getInstance().init(userId, dbName);

    await DexieInitializer.getInstance().enableSync(recordSyncEnabled);
  } catch (ex) {
    logger.error('[DB] Error initializing db', ex);
  }
}

/**
 * ADOPT-ONCE MIGRATION
 *
 * Before per-user scoping there was a single shared Dexie database (and a single localforage
 * store). Those stores cannot be attributed to a specific user, so we hand them to the first
 * account that signs in after the upgrade (virtually always the single real user of the
 * machine) and then mark them claimed so no later account on the same machine can read them.
 * Adoption copies rather than moves: the legacy stores are left on disk, claimed and ignored.
 * (`deleteAllLocalData` is the one flow that does remove them, since that copy belongs to the
 * account being deleted.)
 */

function getLegacyStoreClaim(): string | null {
  try {
    return globalThis.localStorage?.getItem(LEGACY_CLAIM_KEY) ?? null;
  } catch {
    return null;
  }
}

function isLegacyStoreClaimed(): boolean {
  return !!getLegacyStoreClaim();
}

function setLegacyStoreClaimed(claimedAt = new Date().toISOString()): void {
  try {
    globalThis.localStorage?.setItem(LEGACY_CLAIM_KEY, claimedAt);
  } catch (ex) {
    logger.warn('[DB] Unable to persist legacy store claim marker', ex);
  }
}

function getLegacyClaimOwner(): string | null {
  try {
    return globalThis.localStorage?.getItem(LEGACY_CLAIM_OWNER_KEY) ?? null;
  } catch {
    return null;
  }
}

/**
 * Records the claim owner and reports whether it verifiably persisted. Adoption is gated entirely on
 * this marker, so a write that silently fails (blocked or full storage) would leave the legacy stores
 * unclaimed and adoptable by every account that later signs in on this machine.
 */
function setLegacyClaimOwner(hashedUserId: string): boolean {
  try {
    globalThis.localStorage?.setItem(LEGACY_CLAIM_OWNER_KEY, hashedUserId);
  } catch (ex) {
    logger.warn('[DB] Unable to persist legacy store claim owner', ex);
  }
  return getLegacyClaimOwner() === hashedUserId;
}

/**
 * The legacy stores are adoptable only by the first account to claim them — and only until adoption
 * completes. An unfinished claim stays open to the owning user (so an interrupted adoption is
 * retried on their next login) and closed to everyone else.
 */
function canAdoptLegacyStore(hashedUserId: string): boolean {
  if (isLegacyStoreClaimed()) {
    return false;
  }
  const claimOwner = getLegacyClaimOwner();
  return !claimOwner || claimOwner === hashedUserId;
}

/**
 * Wipe localStorage without losing the legacy store claim.
 *
 * `deleteAllLocalData` uses this instead of `localStorage.clear()` so the claim markers survive:
 * even though that flow also deletes the legacy stores, keeping the markers guarantees the next
 * account signing in on this machine cannot re-run adoption against anything that reappears.
 */
function clearLocalStorageRetainingLegacyClaim(): void {
  const claimedAt = getLegacyStoreClaim();
  const claimOwner = getLegacyClaimOwner();
  try {
    globalThis.localStorage?.clear();
  } catch (ex) {
    logger.warn('[DB] Unable to clear localStorage', ex);
  }
  if (claimedAt) {
    setLegacyStoreClaimed(claimedAt);
  }
  if (claimOwner) {
    setLegacyClaimOwner(claimOwner);
  }
}

/**
 * Erase every local trace of the current account (account deletion).
 *
 * Covers both the per-user stores and the legacy shared stores: adoption *copies* rather than
 * moves, so for the account that won the claim the legacy database still holds a full copy of its
 * history. Best-effort per step — a local cleanup failure must not block deleting the account
 * server-side.
 */
export async function deleteAllLocalData(userId: string): Promise<void> {
  clearLocalStorageRetainingLegacyClaim();

  const localforageStores = hasLocalStore() ? [getLocalStore(), getUnscopedLocalStore()] : [getUnscopedLocalStore()];
  for (const store of localforageStores) {
    try {
      await store.clear();
    } catch (ex) {
      logger.warn('[DB] Unable to clear localforage store', ex);
    }
  }

  const databaseNames = [DEXIE_DB_BASE_NAME];
  try {
    databaseNames.unshift(await getScopedDexieDbName(userId));
  } catch (ex) {
    logger.warn('[DB] Unable to resolve scoped database name', ex);
  }
  // Close the active connection first — Dexie.delete blocks while one is open.
  clearLocalStorageScope();
  for (const databaseName of databaseNames) {
    try {
      // Another tab holding the database open blocks the delete indefinitely, which would hang the
      // account deletion this is part of. Give up after a few seconds — the server-side delete is
      // what matters, and the leftover database is unreachable once this account is gone.
      await Promise.race([
        Dexie.delete(databaseName),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Delete timed out, database may be open in another tab')), 5000)),
      ]);
    } catch (ex) {
      logger.warn('[DB] Unable to delete database', databaseName, ex);
    }
  }
}

async function adoptLegacySharedData(userId: string): Promise<void> {
  const hashedUserId = await getHashedRecordKey(userId);
  if (!canAdoptLegacyStore(hashedUserId)) {
    return;
  }
  // Take ownership before copying anything — adoption is not atomic, and an interrupted run must
  // stay closed to every other account on this machine while remaining retryable by this user.
  // Without a durable claim there is no lock at all, so skip adoption rather than risk handing the
  // same legacy data to every account that signs in here.
  if (!setLegacyClaimOwner(hashedUserId)) {
    logger.warn('[DB] Skipping legacy data adoption, unable to persist claim owner');
    return;
  }
  try {
    // 1) Legacy shared Dexie database -> this user's per-user database
    await copyLegacyDexieData();
    // 2) Legacy localforage store -> this user's per-user Dexie tables (existing migrations)
    await migrateQueryHistory();
    await migrateLoadSavedMapping();
    await migrateApiRequestHistory();
    // 3) Legacy localforage default store -> this user's per-user localforage store
    await copyLegacyLocalforageData();
  } catch (ex) {
    // Leave the completion marker unwritten so this user retries on their next sign in (each step
    // is separately idempotent), up to the attempt cap. The claim owner marker stays, so no other
    // account on this machine can adopt in the meantime. Swallowing here instead would strand a
    // half-copied store as permanently "adopted".
    recordFailedAdoptionAttempt(ex);
    return;
  }
  setLegacyStoreClaimed();
  try {
    globalThis.localStorage?.removeItem(LEGACY_ADOPTION_ATTEMPTS_KEY);
  } catch {
    // best-effort cleanup; the claim marker already ends adoption
  }
}

/**
 * Count a failed adoption attempt and give up for good once the cap is reached — a user whose copy
 * persistently fails (e.g. quota) must not pay a full re-copy on every sign-in forever. Giving up
 * stamps the claim, keeping whatever partial data already landed.
 */
function recordFailedAdoptionAttempt(ex: unknown): void {
  let attempts = 1;
  try {
    attempts = Number(globalThis.localStorage?.getItem(LEGACY_ADOPTION_ATTEMPTS_KEY) || 0) + 1;
    globalThis.localStorage?.setItem(LEGACY_ADOPTION_ATTEMPTS_KEY, String(attempts));
  } catch {
    // If the counter cannot persist, adoption just keeps its retry-on-next-sign-in behavior.
  }
  if (attempts >= MAX_LEGACY_ADOPTION_ATTEMPTS) {
    logger.warn(`[DB] Legacy data adoption failed ${attempts} times, giving up and keeping partial data`, ex);
    setLegacyStoreClaimed();
    return;
  }
  logger.warn('[DB] Legacy data adoption did not complete, will retry on next sign in', ex);
}

/**
 * Copy just the (tiny) user-preferences key ahead of the full legacy adoption, before the scope
 * ready promise resolves. The preference atom is read at first paint — structurally before the
 * `initDexieDb` effect that runs adoption — and jotai caches that first read for the session, so
 * without this the first sign-in after upgrade would show default preferences (e.g. light theme
 * for a dark-theme user) even though adoption copies them moments later.
 *
 * Runs before the durable claim is taken, gated on the same `canAdoptLegacyStore` predicate as the
 * full adoption, so it can never hand preferences to an account the claim already excludes. In the
 * unclaimed window it may copy to an account that would have lost the claim race — acceptable for
 * a cosmetic color scheme / notification flag, in exchange for having them ready on first paint.
 * Never throws: by the time this runs both stores are committed, and a failure here must not make
 * `ensureScopeReady`'s catch unbind them.
 */
async function adoptLegacyUserPreferences(userId: string): Promise<void> {
  try {
    if (!hasLocalStore()) {
      return;
    }
    const hashedUserId = await getHashedRecordKey(userId);
    if (!canAdoptLegacyStore(hashedUserId)) {
      return;
    }
    const targetStore = getLocalStore();
    // Never clobber preferences the user has already written into their per-user store
    if ((await targetStore.getItem(INDEXED_DB.KEYS.userPreferences)) !== null) {
      return;
    }
    const legacyPreferences = await getUnscopedLocalStore().getItem(INDEXED_DB.KEYS.userPreferences);
    if (legacyPreferences !== null) {
      await targetStore.setItem(INDEXED_DB.KEYS.userPreferences, legacyPreferences);
    }
  } catch (ex) {
    logger.warn('[DB] Unable to copy legacy user preferences', ex);
  }
}

async function copyLegacyDexieData(): Promise<void> {
  if (!(await Dexie.exists(DEXIE_DB_BASE_NAME))) {
    return;
  }
  // No hooks: this instance is only read from, and its writes would target the wrong database.
  const legacyDb = createDexieInstance(DEXIE_DB_BASE_NAME);
  try {
    await legacyDb.open();
    const targetDb = getDexieDb();
    for (const tableName of AdoptableTables) {
      // Indexing by the union of table names yields a union of table types, so narrow to a generic
      // Table to call bulkPut/toArray uniformly.
      const legacyTable = legacyDb[tableName] as unknown as Table<any, any>;
      const targetTable = targetDb[tableName] as unknown as Table<any, any>;
      const rows = await legacyTable.toArray();
      if (rows.length) {
        await targetTable.bulkPut(rows).catch((ex: any) => {
          // Individual row failures are tolerable (and not retryable); anything else fails adoption.
          if (ex.name === 'BulkError') {
            logger.warn(`[DB] Error adopting legacy ${tableName}`, ex.failures);
          } else {
            throw ex;
          }
        });
      }
    }
  } finally {
    legacyDb.close();
  }
}

async function copyLegacyLocalforageData(): Promise<void> {
  // Without a user-scoped store the target would be the default (legacy) instance — copying it
  // onto itself is pointless and could clobber data, so only run when a per-user store is active.
  if (!hasLocalStore()) {
    return;
  }
  const targetStore = getLocalStore();
  const legacyStore = getUnscopedLocalStore();
  for (const key of await legacyStore.keys()) {
    // Skip the HTTP cache: it is regenerable (3 day TTL), it is by far the largest thing in the
    // store, and copying it would roughly double IndexedDB usage — the most likely way to blow
    // quota and fail an otherwise successful adoption.
    if (key.startsWith(INDEXED_DB.KEYS.httpCache)) {
      continue;
    }
    // Never clobber a value already in the per-user store: on an adoption retry the target may
    // hold newer data the user wrote during an earlier session (e.g. changed preferences).
    if ((await targetStore.getItem(key)) !== null) {
      continue;
    }
    await targetStore.setItem(key, await legacyStore.getItem(key));
  }
}

/**
 * MIGRATION FROM LOCALFORAGE TO DEXIE
 *
 * Each of these runs as part of `adoptLegacySharedData` and is independently gated by its own
 * `_migration` record, so failures propagate: adoption is left un-stamped and retries, and the
 * steps that already succeeded are skipped on the retry.
 *
 * For most users the gate is satisfied before these ever run: the legacy database already ran the
 * migration years ago and `copyLegacyDexieData` carries its `_migration` markers over (see
 * `AdoptableTables`), so these no-op — re-running them would overwrite the adopted, current rows
 * with the stale pre-Dexie localforage snapshot, which was never deleted. They only do real work
 * for a user whose legacy database never completed them (or never existed at all).
 */

async function migrateQueryHistory() {
  const dexieDb = getDexieDb();
  const migrationRecord = await dexieDb._migration.get('query_history');
  if (migrationRecord?.completedAt) {
    return;
  }
  const queryHistory = await getUnscopedLocalStore().getItem<Record<string, QueryHistoryItem>>(INDEXED_DB.KEYS.queryHistory);
  if (queryHistory) {
    for (const item of Object.values(queryHistory)) {
      const createdAt = new Date((item as any).created || item.createdAt || new Date());
      delete (item as any)['created'];
      item.key = `${SyncableTables.query_history.keyPrefix}_${item.key}`.toLowerCase() as QueryHistoryItem['key'];
      item.hashedKey = await getHashedRecordKey(item.key);
      item.updatedAt = new Date(item.updatedAt || item.lastRun);
      item.lastRun = new Date(item.lastRun);
      item.isFavoriteIdx = item.isFavorite ? 'true' : 'false';
      item.createdAt = createdAt;
    }
    await dexieDb.query_history.bulkPut(Object.values(queryHistory)).catch((ex) => {
      if (ex.name === 'BulkError') {
        logger.warn('[DB] Error migrating query history', ex.failures);
      } else {
        throw ex;
      }
    });
  }
  await dexieDb._migration.put({ entity: 'query_history', completedAt: new Date() });
}

async function migrateLoadSavedMapping() {
  const dexieDb = getDexieDb();
  const migrationRecord = await dexieDb._migration.get('load_saved_mapping');
  if (migrationRecord?.completedAt) {
    return;
  }
  const loadSavedMapping = await getUnscopedLocalStore().getItem<Record<string, Record<string, LoadSavedMappingItem>>>(
    INDEXED_DB.KEYS.loadSavedMapping,
  );
  if (loadSavedMapping) {
    const records: LoadSavedMappingItem[] = [];
    for (const sobject of Object.values(loadSavedMapping)) {
      for (let item of Object.values(sobject)) {
        item = { ...item };
        const createdAt = new Date((item as any).createdDate || item.createdAt || new Date());
        delete (item as any)['createdDate'];
        item.key = `${SyncableTables.load_saved_mapping.keyPrefix}_${item.key}`.toLowerCase() as LoadSavedMappingItem['key'];
        item.hashedKey = await getHashedRecordKey(item.key);
        item.createdAt = createdAt;
        item.updatedAt = createdAt;
        records.push(item);
      }
    }

    await dexieDb.load_saved_mapping.bulkPut(records).catch((ex) => {
      if (ex.name === 'BulkError') {
        logger.warn('[DB] Error migrating load_saved_mapping', ex.failures);
      } else {
        throw ex;
      }
    });
  }
  await dexieDb._migration.put({ entity: 'load_saved_mapping', completedAt: new Date() });
}

async function migrateApiRequestHistory() {
  const dexieDb = getDexieDb();
  const migrationRecord = await dexieDb._migration.get('api_request_history');
  if (migrationRecord?.completedAt) {
    return;
  }
  const recordsById = await getUnscopedLocalStore().getItem<Record<string, ApiHistoryItem>>(INDEXED_DB.KEYS.salesforceApiHistory);
  if (recordsById) {
    for (const item of Object.values(recordsById)) {
      const createdAt = new Date(item.lastRun || new Date());
      item.key = `${SyncableTables.api_request_history.keyPrefix}_${item.key}`.toLowerCase() as ApiHistoryItem['key'];
      item.hashedKey = await getHashedRecordKey(item.key);
      item.updatedAt = new Date(item.lastRun);
      item.lastRun = new Date(item.lastRun);
      item.isFavorite = 'false';
      item.createdAt = createdAt;
    }
    await dexieDb.api_request_history.bulkPut(Object.values(recordsById)).catch((ex) => {
      if (ex.name === 'BulkError') {
        logger.warn('[DB] Error migrating api history', ex.failures);
      } else {
        throw ex;
      }
    });
  }
  await dexieDb._migration.put({ entity: 'api_request_history', completedAt: new Date() });
}

async function addHashedKeyToRecord() {
  try {
    const dexieDb = getDexieDb();
    const migrationRecord = await dexieDb._migration.get('hashed_key');
    if (migrationRecord?.completedAt) {
      return;
    }

    const queryHistory = await dexieDb.query_history.toArray();
    let didUpdate = false;
    for (const record of queryHistory) {
      if (!record.hashedKey) {
        record.hashedKey = await getHashedRecordKey(record.key);
        didUpdate = true;
      }
    }
    if (didUpdate) {
      await dexieDb.query_history.bulkPut(queryHistory).catch((ex) => {
        if (ex.name === 'BulkError') {
          logger.warn('[DB] Error migrating query_history>hashed_key', ex.failures);
        }
      });
    }

    const loadSavedMapping = await dexieDb.load_saved_mapping.toArray();
    didUpdate = false;
    for (const record of loadSavedMapping) {
      if (!record.hashedKey) {
        record.hashedKey = await getHashedRecordKey(record.key);
        didUpdate = true;
      }
    }
    if (didUpdate) {
      await dexieDb.load_saved_mapping.bulkPut(loadSavedMapping).catch((ex) => {
        if (ex.name === 'BulkError') {
          logger.warn('[DB] Error migrating load_saved_mapping>hashed_key', ex.failures);
        }
      });
    }

    await dexieDb._migration.put({ entity: 'hashed_key', completedAt: new Date() });
  } catch (ex) {
    logger.warn('[DB] Error migrating hashed_key', ex);
  }
}
