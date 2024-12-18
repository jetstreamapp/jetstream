import { logger } from '@jetstream/shared/client-logger';
import { INDEXED_DB } from '@jetstream/shared/constants';
import { QueryHistoryItem, QueryHistoryObject } from '@jetstream/types';
import Dexie, { type EntityTable } from 'dexie';
import 'dexie-observable';
import 'dexie-syncable';
import localforage from 'localforage';
import { initSync } from './client-data-sync.db';
import { queryHistoryObjectDb } from './query-history-object.db';

declare module 'Dexie' {
  interface Transaction {
    _sourceFromSync?: boolean;
  }
}

interface Migration {
  entity: string;
  completedAt: Date;
}

export type DexieDb = typeof dexieDb;

// let syncManager: DataSyncManager;

export const dexieDb = new Dexie('jetstream') as Dexie & {
  /**
   * Keeps track of migration from localforage to dexie for any given table
   */
  _migration: EntityTable<Migration, 'entity'>;
  /**
   * Keeps track of objects used for query history
   */
  _query_history_object: EntityTable<QueryHistoryObject, 'key'>;
  query_history: EntityTable<QueryHistoryItem, 'key'>;
};

dexieDb.version(1).stores({
  _migration: 'entity',
  _query_history_object: 'key,org,sObject,[org+sObject]',
  query_history: 'key,org,sObject,updatedAt,isFavoriteIdx,[sObject+org],[sObject+isFavoriteIdx]',
});

dexieDb.query_history.hook('creating', function (primaryKey, obj, transaction) {
  obj.isFavoriteIdx = obj.isFavorite ? 'true' : 'false';
  this.onsuccess = function (key) {
    // this would consistently fail if done in the same transaction
    setTimeout(() => {
      queryHistoryObjectDb.saveQueryHistoryObjectFromKey(key);
    });
  };
});

dexieDb.query_history.hook('updating', function (mods, primaryKey, obj, transaction) {
  if ('isFavorite' in mods) {
    return { ...mods, isFavoriteIdx: mods.isFavorite ? 'true' : 'false' };
  }
});

let isInit = false;
let isSyncInit = false;

export async function initDexieDb({ featureFlagEnableSync }: { featureFlagEnableSync: boolean }) {
  if (!isInit) {
    isInit = true;
    try {
      await migrateQueryHistory();
    } catch (ex) {
      logger.error('[DB] Error initializing db', ex);
    }
  }
  if (featureFlagEnableSync && !isSyncInit) {
    isSyncInit = true;
    initDexieSync();
  }
}

async function initDexieSync() {
  initSync(); // TODO: rename this

  dexieDb.syncable.connect('jetstream-sync', '/');
}

export async function migrateQueryHistory() {
  try {
    const queryHistoryMigration = await dexieDb._migration.get('query_history');
    if (queryHistoryMigration?.completedAt) {
      return;
    }
    const queryHistory = await localforage.getItem<Record<string, QueryHistoryItem>>(INDEXED_DB.KEYS.queryHistory);
    if (queryHistory) {
      Object.values(queryHistory).forEach((item) => {
        item.key = `qh_${item.key.toUpperCase()}`;
        item.updatedAt = item.updatedAt || item.lastRun;
        item.isFavoriteIdx = item.isFavorite ? 'true' : 'false';
      });
      await dexieDb.query_history.bulkPut(Object.values(queryHistory)).catch((ex) => {
        if (ex.name === 'BulkError') {
          logger.warn('[DB] Error migrating query history', ex.failures);
        }
      });
    }
    await dexieDb._migration.put({ entity: 'query_history', completedAt: new Date() });
  } catch (ex) {
    logger.warn('[DB] Error migrating query history', ex);
  }
}
