/// <reference types="chrome" />
import { logger } from '@jetstream/shared/client-logger';
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
 */

interface Migration {
  entity: string;
  completedAt: Date;
}

export type DexieDb = typeof dexieDb;
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

const isWebExtension = () => {
  try {
    return !!globalThis.__IS_BROWSER_EXTENSION__ || !!window?.chrome?.runtime?.id;
  } catch {
    return false;
  }
};

export async function getHashedRecordKey(key: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export const DEXIE_DB_NAME = isWebExtension() ? 'jetstream-web-extension' : 'jetstream';
export const DEXIE_DB_SYNC_NAME = isWebExtension() ? 'jetstream-web-extension' : 'jetstream';
export const DEXIE_DB_SYNC_PATH = '/';

// dexie-observable coordinates multi-tab state through localStorage and writes a brand-new
// `Dexie.Observable/deadnode:<id>` key on every unload with no try/catch — for users whose
// localStorage sits at quota this throws an unhandled QuotaExceededError on page close (new keys
// fail even when same-size overwrites succeed). Cross-tab signaling still requires REAL localStorage
// writes (other tabs listen for storage events), so wrap the impl to swallow storage failures rather
// than replacing it. Must run before `new Dexie(...)` — the addon captures the impl at construction.
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

export const dexieDb = new Dexie(DEXIE_DB_NAME) as Dexie & {
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

export const SyncableEntities = new Set<SyncableEntity>(Object.keys(SyncableTables) as Array<SyncableEntity>);

dexieDb.version(1).stores({
  _migration: 'entity',
  _query_history_object: 'key,org,sObject,[org+sObject]',
  query_history: 'key,org,sObject,updatedAt,lastRun,isFavoriteIdx,[sObject+org],[sObject+isFavoriteIdx],[org+isFavoriteIdx]',
  load_saved_mapping: 'key,sobject,*csvFields,*sobjectFields',
});

dexieDb.version(2).stores({
  recent_history_item: 'key,org',
});

dexieDb.version(3).stores({
  api_request_history: 'key,org,lastRun,isFavorite,[org+isFavorite]',
});

dexieDb.version(4).stores({
  analysis_job_history: 'key,org,jobType,createdAt,pinned,[org+jobType+createdAt]',
});

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
    if ((ex as Error)?.name === 'DatabaseClosedError') {
      logger.warn('[DB] Database was closed - reopening and retrying');
      await dexieDb.open();
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
    const status = await dexieDb.syncable.getStatus('/');
    if (status === -1 /** SyncStatus.ERROR */) {
      logger.warn('[DB][SYNC] Resetting sync due to error status');
      await dexieDb.syncable.delete(DEXIE_DB_SYNC_PATH);
    }
    await dexieDb.syncable.connect(DEXIE_DB_SYNC_NAME, '/');
  },
  disconnect: async () => {
    await dexieDb.syncable.disconnect(DEXIE_DB_SYNC_PATH);
  },
  reset: async (reconnect?: boolean) => {
    try {
      await Promise.race([
        dexieDb.syncable.disconnect(DEXIE_DB_SYNC_PATH),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Disconnect timeout')), 5000)),
      ]);
    } catch (ex) {
      // may not have been connected
      logger.error('[DB][SYNC] Error resetting sync', ex);
    }
    try {
      await dexieDb.syncable.delete(DEXIE_DB_SYNC_PATH);
      if (reconnect) {
        await dexieDataSync.connect();
      }
    } catch (ex) {
      logger.error('[DB][SYNC] Error resetting sync', ex);
    }
  },
};
