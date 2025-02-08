import { logger } from '@jetstream/shared/client-logger';
import { INDEXED_DB } from '@jetstream/shared/constants';
import { LoadSavedMappingItem, QueryHistoryItem } from '@jetstream/types';
import { DEXIE_DB_SYNC_NAME, dexieDataSync, dexieDb, hashRecordKey, SyncableTables } from '@jetstream/ui/db';
import 'dexie-observable';
import 'dexie-syncable';
import localforage from 'localforage';
import { initializeDexieSync } from './client-data-sync.db';

class DexieInitializer {
  private static instance: DexieInitializer;
  private hasInitialized = false;
  private initPromise: Promise<void> | null = null;

  private hasInitializedSync = false;

  static getInstance(): DexieInitializer {
    if (!this.instance) {
      this.instance = new this();
    }
    return this.instance;
  }

  async init() {
    // Perform data migration if needed
    try {
      if (this.hasInitialized) {
        return;
      }
      this.hasInitialized = true;
      this.initPromise = this._init();
      await this.initPromise;
    } catch (ex) {
      logger.error('[DB] Error initializing db', ex);
      this.hasInitialized = false;
    }
  }

  async enableSync(enable: boolean) {
    // ensure we are initialized
    if (this.initPromise) {
      await this.initPromise;
    } else if (!this.hasInitialized) {
      await this.init();
    }
    // Sync is disabled and has never been enabled, no action
    if (!enable && !this.hasInitializedSync) {
      return;
    }
    // Sync is now disabled, disconnect
    if (!enable && this.hasInitializedSync) {
      await dexieDataSync.disconnect();
      return;
    }
    // Register protocol and mark as initialized
    if (enable && !this.hasInitializedSync) {
      initializeDexieSync(DEXIE_DB_SYNC_NAME);
      this.hasInitializedSync = true;
    }
    // Connect to sync
    await dexieDataSync.connect();
  }

  private async _init() {
    await migrateQueryHistory();
    await migrateLoadSavedMapping();
    await addHashedKeyToRecord();
    this.hasInitialized = true;
  }
}

export async function initDexieDb({ recordSyncEnabled }: { recordSyncEnabled: boolean }) {
  try {
    await DexieInitializer.getInstance().init();

    await DexieInitializer.getInstance().enableSync(recordSyncEnabled);
  } catch (ex) {
    logger.error('[DB] Error initializing db', ex);
  }
}

/**
 * MIGRATION FROM LOCALFORAGE TO DEXIE
 */

async function migrateQueryHistory() {
  try {
    const migrationRecord = await dexieDb._migration.get('query_history');
    if (migrationRecord?.completedAt) {
      return;
    }
    const queryHistory = await localforage.getItem<Record<string, QueryHistoryItem>>(INDEXED_DB.KEYS.queryHistory);
    if (queryHistory) {
      for (const item of Object.values(queryHistory)) {
        const createdAt = new Date((item as any).created || item.createdAt || new Date());
        delete item['created'];
        item.key = `${SyncableTables.query_history.keyPrefix}_${item.key}`.toLowerCase() as QueryHistoryItem['key'];
        item.hashedKey = await hashRecordKey(item.key);
        item.updatedAt = new Date(item.updatedAt || item.lastRun);
        item.lastRun = new Date(item.lastRun);
        item.isFavoriteIdx = item.isFavorite ? 'true' : 'false';
        item.createdAt = createdAt;
      }
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

async function migrateLoadSavedMapping() {
  try {
    const migrationRecord = await dexieDb._migration.get('load_saved_mapping');
    if (migrationRecord?.completedAt) {
      return;
    }
    const loadSavedMapping = await localforage.getItem<Record<string, Record<string, LoadSavedMappingItem>>>(
      INDEXED_DB.KEYS.loadSavedMapping
    );
    if (loadSavedMapping) {
      const records: LoadSavedMappingItem[] = [];
      for (const sobject of Object.values(loadSavedMapping)) {
        for (let item of Object.values(sobject)) {
          item = { ...item };
          const createdAt = new Date((item as any).createdDate || item.createdAt || new Date());
          delete item['createdDate'];
          item.key = `${SyncableTables.load_saved_mapping.keyPrefix}_${item.key}`.toLowerCase() as LoadSavedMappingItem['key'];
          item.hashedKey = await hashRecordKey(item.key);
          item.createdAt = createdAt;
          item.updatedAt = createdAt;
          records.push(item);
        }
      }

      await dexieDb.load_saved_mapping.bulkPut(records).catch((ex) => {
        if (ex.name === 'BulkError') {
          logger.warn('[DB] Error migrating load_saved_mapping', ex.failures);
        }
      });
    }
    await dexieDb._migration.put({ entity: 'load_saved_mapping', completedAt: new Date() });
  } catch (ex) {
    logger.warn('[DB] Error migrating load_saved_mapping', ex);
  }
}

async function addHashedKeyToRecord() {
  try {
    const migrationRecord = await dexieDb._migration.get('hashed_key');
    if (migrationRecord?.completedAt) {
      return;
    }

    const queryHistory = await dexieDb.query_history.toArray();
    let didUpdate = false;
    for (const record of queryHistory) {
      if (!record.hashedKey) {
        record.hashedKey = await hashRecordKey(record.key);
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
        record.hashedKey = await hashRecordKey(record.key);
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
