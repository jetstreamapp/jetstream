/// <reference types="chrome" />
import { logger } from '@jetstream/shared/client-logger';
import type { LoadSavedMappingItem, QueryHistoryItem, QueryHistoryObject } from '@jetstream/types';
import Dexie, { type EntityTable } from 'dexie';
import 'dexie-observable';
import 'dexie-syncable';

/**
 * This library is intentionally kept very small to allow importing in chrome extension without importing the entire ui-core
 */

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
} as const;

const isChromeExtension = () => {
  try {
    return !!window?.__IS_CHROME_EXTENSION__ || !!window?.chrome?.runtime?.id;
  } catch (ex) {
    return false;
  }
};

export const DEXIE_DB_NAME = isChromeExtension() ? 'jetstream-web-extension' : 'jetstream';
export const DEXIE_DB_SYNC_NAME = isChromeExtension() ? 'jetstream-web-extension' : 'jetstream';
export const DEXIE_DB_SYNC_PATH = '/';

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
};

export const SyncableEntities = new Set<SyncableEntity>(Object.keys(SyncableTables) as Array<SyncableEntity>);

dexieDb.version(1).stores({
  _migration: 'entity',
  _query_history_object: 'key,org,sObject,[org+sObject]',
  query_history: 'key,org,sObject,updatedAt,lastRun,isFavoriteIdx,[sObject+org],[sObject+isFavoriteIdx],[org+isFavoriteIdx]',
  load_saved_mapping: 'key,sobject,*csvFields,*sobjectFields',
});

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
