/// <reference types="chrome" />
import { logger } from '@jetstream/shared/client-logger';
import { sha1Hex } from '@jetstream/shared/utils';
import type {
  AnalysisJobHistoryItem,
  ApiHistoryItem,
  LoadSavedMappingItem,
  QueryHistoryItem,
  QueryHistoryObject,
  RecentHistoryItem,
} from '@jetstream/types';
import Dexie, { type EntityTable } from 'dexie';
import 'dexie-observable';
import 'dexie-syncable';

/**
 * This library is intentionally kept very small to allow importing in browser extension without importing the entire ui-core
 *
 * This module must not import the feature-specific `*.db.ts` modules — they all import from here,
 * and a cycle would make module evaluation order load-bearing. Anything a table hook needs from a
 * feature module is passed in via `createDexieInstance`'s `registerHooks` argument instead.
 */

interface Migration {
  entity: string;
  completedAt: Date;
}

/**
 * Local IndexedDB, scoped per authenticated user (see {@link getScopedDexieDbName}).
 * The instance is created lazily at login via {@link initDexieDb} rather than at module
 * import, because the authenticated user id is not known until then. Consumers must go
 * through {@link getDexieDb} instead of referencing a module-level singleton.
 */
export type DexieDb = Dexie & {
  /**
   * Keeps track of migration from localforage to dexie for any given table
   */
  _migration: EntityTable<Migration, 'entity'>;
  /**
   * Keeps track of objects used for query history
   */
  _query_history_object: EntityTable<QueryHistoryObject, 'key'>;
  query_history: EntityTable<QueryHistoryItem, 'key'>;
  load_saved_mapping: EntityTable<LoadSavedMappingItem, 'key'>;
  recent_history_item: EntityTable<RecentHistoryItem, 'key'>;
  api_request_history: EntityTable<ApiHistoryItem, 'key'>;
  analysis_job_history: EntityTable<AnalysisJobHistoryItem, 'key'>;
};

export type SyncableEntity = keyof typeof SyncableTables;

export const SyncableTables = {
  query_history: {
    name: 'query_history',
    keyPrefix: 'qh',
  },
  load_saved_mapping: {
    name: 'load_saved_mapping',
    keyPrefix: 'lsm',
  },
  recent_history_item: {
    name: 'recent_history_item',
    keyPrefix: 'ri',
  },
  api_request_history: {
    name: 'api_request_history',
    keyPrefix: 'api',
  },
} as const;

/**
 * Local-only Dexie tables. Not synced cross-device; the sync layer pulls only from `SyncableTables`.
 * Kept separate from `SyncableTables` so the sync code stays type-tight without an extra prefix case.
 */
export const LocalOnlyTables = {
  analysis_job_history: {
    name: 'analysis_job_history',
    keyPrefix: 'aj',
  },
} as const;

/**
 * Tables copied when adopting the legacy shared database into a per-user database
 * (see `adoptLegacySharedData`). Order matters:
 *
 * - `_migration` must be included and copied: its completed markers are what stop the old
 *   localforage→Dexie migrations from re-running against the fresh per-user database — the
 *   pre-Dexie localforage snapshot was never deleted and its migrated keys collide with current
 *   row keys, so a re-run would overwrite the adopted rows (favorites, labels, run counts) with
 *   years-old data.
 * - `analysis_job_history` is last: its rows carry large result blobs, so if the copy dies on
 *   quota the small, irreplaceable tables have already landed.
 */
export const AdoptableTables = [
  '_migration',
  '_query_history_object',
  'query_history',
  'load_saved_mapping',
  'recent_history_item',
  'api_request_history',
  'analysis_job_history',
] as const;

const isWebExtension = () => {
  try {
    return !!globalThis.__IS_BROWSER_EXTENSION__ || !!window?.chrome?.runtime?.id;
  } catch {
    return false;
  }
};

export const getHashedRecordKey = sha1Hex;

/**
 * Un-scoped database name. Two roles: the prefix every per-user database name is built from
 * (see {@link getScopedDexieDbName}), and — on its own — the name of the legacy shared database
 * that existed before per-user scoping, which the adopt-once migration reads from. Never open it
 * for normal reads/writes.
 */
export const DEXIE_DB_BASE_NAME = isWebExtension() ? 'jetstream-web-extension' : 'jetstream';
/**
 * Sync protocol name — a stable identifier registered once with `Dexie.Syncable`,
 * independent of the per-user database name.
 */
export const DEXIE_DB_SYNC_NAME = DEXIE_DB_BASE_NAME;
export const DEXIE_DB_SYNC_PATH = '/';

// dexie-observable coordinates multi-tab state through localStorage and writes a brand-new
// `Dexie.Observable/deadnode:<id>` key on every unload with no try/catch — for users whose
// localStorage sits at quota this throws an unhandled QuotaExceededError on page close (new keys
// fail even when same-size overwrites succeed). Cross-tab signaling still requires REAL localStorage
// writes (other tabs listen for storage events), so wrap the impl to swallow storage failures rather
// than replacing it. Must run before any `new Dexie(...)` (see `createDexieInstance`) — the addon
// captures the impl at construction, so this stays at module scope.
const DexieObservable = (Dexie as unknown as { Observable?: { localStorageImpl?: unknown } }).Observable;
if (DexieObservable && typeof localStorage !== 'undefined') {
  DexieObservable.localStorageImpl = {
    getItem: (key: string) => localStorage.getItem(key),
    setItem: (key: string, value: string) => {
      try {
        localStorage.setItem(key, value);
      } catch (ex) {
        logger.warn('[DB] localStorage write failed', key, ex);
      }
    },
    removeItem: (key: string) => {
      try {
        localStorage.removeItem(key);
      } catch (ex) {
        logger.warn('[DB] localStorage remove failed', key, ex);
      }
    },
  };
}

export const SyncableEntities = new Set<SyncableEntity>(Object.keys(SyncableTables) as Array<SyncableEntity>);

/**
 * Per-user database name. The authenticated user id is hashed so the raw id is never
 * exposed in the IndexedDB database name.
 */
export async function getScopedDexieDbName(userId: string): Promise<string> {
  const hashedUserId = await getHashedRecordKey(userId);
  return `${DEXIE_DB_BASE_NAME}-u-${hashedUserId}`;
}

function applySchema(db: DexieDb) {
  db.version(1).stores({
    _migration: 'entity',
    _query_history_object: 'key,org,sObject,[org+sObject]',
    query_history: 'key,org,sObject,updatedAt,lastRun,isFavoriteIdx,[sObject+org],[sObject+isFavoriteIdx],[org+isFavoriteIdx]',
    load_saved_mapping: 'key,sobject,*csvFields,*sobjectFields',
  });

  db.version(2).stores({
    recent_history_item: 'key,org',
  });

  db.version(3).stores({
    api_request_history: 'key,org,lastRun,isFavorite,[org+isFavorite]',
  });

  db.version(4).stores({
    analysis_job_history: 'key,org,jobType,createdAt,pinned,[org+jobType+createdAt]',
  });
}

/**
 * Build a Dexie instance for a given database name with the full schema applied.
 *
 * Table hooks are passed in (see `registerDbHooks`) rather than imported here, both to keep this
 * module free of feature-module imports and because the legacy database — opened read-only by the
 * adopt-once migration — deliberately gets no write hooks.
 */
export function createDexieInstance(name: string, registerHooks?: (db: DexieDb) => void): DexieDb {
  const db = new Dexie(name) as DexieDb;
  applySchema(db);
  registerHooks?.(db);
  return db;
}

let dexieDbInstance: DexieDb | null = null;

/**
 * Swap the active database instance, closing the one being replaced. Closing releases the
 * IndexedDB connection and stops dexie-observable's heartbeat and any dexie-syncable connection
 * on the departing user's database, so no background work continues against it after a logout
 * or user switch.
 */
export function setDexieDbInstance(db: DexieDb | null) {
  const previousDb = dexieDbInstance;
  dexieDbInstance = db;
  if (previousDb && previousDb !== db) {
    try {
      previousDb.close();
    } catch (ex) {
      logger.warn('[DB] Error closing previous database instance', ex);
    }
  }
}

/**
 * Access the active per-user database. Throws if accessed before {@link initDexieDb} has run —
 * every history/data feature is gated behind authentication, which is where init happens.
 */
export function getDexieDb(): DexieDb {
  if (!dexieDbInstance) {
    throw new Error('Dexie database has not been initialized. Call initDexieDb() before accessing the database.');
  }
  return dexieDbInstance;
}

export function hasDexieDb(): boolean {
  return !!dexieDbInstance;
}

/**
 * dexie-observable can close the shared connection permanently mid-session (its multi-tab heartbeat
 * calls `db.close()` when a frozen/slept tab's sync node has been reaped by another tab), after which
 * every write throws DatabaseClosedError until the page reloads. Reopening restores full function —
 * the observable addon recreates its sync node on open — so retry the operation once after reopening.
 */
export async function withReopenOnDatabaseClosed<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (ex) {
    // The instance is torn down on logout, so only retry while one is still active — otherwise
    // `getDexieDb()` would throw and mask the original error.
    if ((ex as Error)?.name === 'DatabaseClosedError' && hasDexieDb()) {
      logger.warn('[DB] Database was closed - reopening and retrying');
      await getDexieDb().open();
      return await operation();
    }
    throw ex;
  }
}

/**
 * Wrap every function of a `*Db` api object with `withReopenOnDatabaseClosed` so all user-triggered
 * reads/writes self-heal from a closed connection. Apply at the export boundary — internal calls
 * between the module's own functions stay unwrapped, avoiding redundant nested retries.
 */
export function wrapApiWithReopenOnDatabaseClosed<T extends Record<string, (...args: never[]) => Promise<unknown>>>(api: T): T {
  return Object.fromEntries(
    Object.entries(api).map(([name, fn]) => [name, (...args: never[]) => withReopenOnDatabaseClosed(() => fn(...args))]),
  ) as T;
}

export const dexieDataSync = {
  connect: async () => {
    const db = getDexieDb();
    const status = await db.syncable.getStatus('/');
    if (status === -1 /** SyncStatus.ERROR */) {
      logger.warn('[DB][SYNC] Resetting sync due to error status');
      await db.syncable.delete(DEXIE_DB_SYNC_PATH);
    }
    await db.syncable.connect(DEXIE_DB_SYNC_NAME, '/');
  },
  disconnect: async () => {
    await getDexieDb().syncable.disconnect(DEXIE_DB_SYNC_PATH);
  },
  reset: async (reconnect?: boolean) => {
    const db = getDexieDb();
    try {
      await Promise.race([
        db.syncable.disconnect(DEXIE_DB_SYNC_PATH),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Disconnect timeout')), 5000)),
      ]);
    } catch (ex) {
      // may not have been connected
      logger.error('[DB][SYNC] Error resetting sync', ex);
    }
    try {
      await db.syncable.delete(DEXIE_DB_SYNC_PATH);
      if (reconnect) {
        await dexieDataSync.connect();
      }
    } catch (ex) {
      logger.error('[DB][SYNC] Error resetting sync', ex);
    }
  },
};
