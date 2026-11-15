/// <reference types="chrome" />
import { logger } from '@jetstream/shared/client-logger';
import { sha1Hex } from '@jetstream/shared/utils';
import type {
  AnalysisJobHistoryItem,
  ApiHistoryItem,
  AutomationControlHistoryEntry,
  DataHistoryConfigItem,
  DataHistoryItem,
  LoadSavedMappingItem,
  QueryHistoryItem,
  QueryHistoryObject,
  RecentHistoryItem,
} from '@jetstream/types';
import Dexie, { type EntityTable } from 'dexie';

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
  data_history: EntityTable<DataHistoryItem, 'key'>;
  data_history_config: EntityTable<DataHistoryConfigItem, 'key'>;
  automation_control_history: EntityTable<AutomationControlHistoryEntry, 'key'>;
  /** Local changes to syncable tables that the server has not accepted yet - one entry per record */
  _sync_outbox: EntityTable<SyncOutboxEntry, 'key'>;
  /** The server revision this device last received (or had accepted) for each synced record */
  _sync_meta: EntityTable<SyncMetaEntry, 'key'>;
  /** Singleton row holding the sync cursor */
  _sync_state: EntityTable<SyncStateEntry, 'id'>;
};

export interface SyncOutboxEntry {
  /** Key of the changed record - also this entry's primary key, so repeated edits collapse into one entry */
  key: string;
  table: SyncableEntity;
  op: 'put' | 'delete';
  /**
   * Regenerated on every local change. An entry is only removed once the server has answered for the
   * exact change that was sent, so an edit made while a push is in flight is never lost.
   */
  nonce: string;
  changedAt: Date;
  /** Set when the server reported the change can never be accepted as-is; cleared by the next local edit */
  error?: string | null;
}

export interface SyncMetaEntry {
  key: string;
  revision: number;
}

export const SYNC_STATE_ID = 'state';

export interface SyncStateEntry {
  id: typeof SYNC_STATE_ID;
  /** Server revision this device is caught up to */
  cursor: number;
  lastSyncedAt: Date | null;
  /** Null until the local data has been reconciled against the server from scratch */
  reconciledAt: Date | null;
  /** Unpushed deletes left behind by the previous (dexie-syncable) engine have been carried over */
  legacyAddonStateMigrated?: boolean;
}

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
  data_history: {
    name: 'data_history',
    keyPrefix: 'dh',
  },
  data_history_config: {
    name: 'data_history_config',
    keyPrefix: 'dhc',
  },
  automation_control_history: {
    name: 'automation_control_history',
    keyPrefix: 'ach',
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
export const SYNC_OUTBOX_TABLE = '_sync_outbox';

/**
 * Stores created by the dexie-observable / dexie-syncable addons this app used for history sync
 * before it had its own sync engine (`./sync`). The addons injected these into every schema version,
 * so they are declared from version 1 to match what is already on disk: declaring them any later (or
 * not at all) makes Dexie drop or re-create them during the upgrade.
 *
 * Kept, unused, so that (a) a tab still running the previous build keeps working after another tab
 * upgrades the database, (b) the release can be rolled back, and (c) the first sync on the new engine
 * can carry over deletes the addon had not pushed yet. Safe to remove in a later schema version.
 */
const LEGACY_SYNC_ADDON_STORES = {
  _changes: '++rev',
  _syncNodes: '++id,myRevision,lastHeartBeat,&url,isMaster,type,status',
  _intercomm: '++id,destinationNode',
  _uncommittedChanges: '++id,node',
};

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
    ...LEGACY_SYNC_ADDON_STORES,
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

  /**
   * Every `data_history` index below is read by a query in `data-history.db.ts`, and the entry row is
   * written several times per capture — so an index that serves no query is pure write cost on the
   * hot path of every data load. Do not add one speculatively:
   *
   * - `createdAt`      — the default newest-first list
   * - `[org+createdAt]` — the same list narrowed to one org (a standalone `org` index would be
   *                       redundant: the compound index serves org-only lookups too)
   * - `pinnedIdx`      — pinned count without deserializing rows (booleans cannot be Dexie indexes,
   *                       so `db-hooks` mirrors `pinned` into this string field)
   * - `sizeBytes`      — total usage summed straight from the index, read on every settings/history
   *                       page mount over an unbounded number of rows on tiers with no entry cap
   */
  db.version(5).stores({
    data_history: 'key,createdAt,pinnedIdx,sizeBytes,[org+createdAt]',
    data_history_config: 'key',
  });

  /** `[org+createdAt]` serves both the per-org newest-first list and the per-org retention prune */
  db.version(6).stores({
    automation_control_history: 'key,[org+createdAt]',
  });

  /** History sync bookkeeping - see `./sync` */
  db.version(7).stores({
    _sync_outbox: 'key',
    _sync_meta: 'key',
    _sync_state: 'id',
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
 * IndexedDB connection on the departing user's database, so no background work (including a sync
 * cycle still in flight, which is bound to its own instance) continues against it after a logout
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
 * The shared connection can be closed mid-session - another tab running a newer build upgrades the
 * schema (`versionchange`), or the browser drops it - after which every write throws
 * DatabaseClosedError until the page reloads. Reopening restores full function, so retry the
 * operation once after reopening.
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
