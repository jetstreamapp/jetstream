import { logger } from '@jetstream/shared/client-logger';
import {
  DataHistoryBackendConfig,
  DataHistoryItem,
  DataHistorySettings,
  DataHistorySource,
  DataHistoryStatus,
  dataHistorySettingsSchema,
  dataHistoryStorageBackendSchema,
} from '@jetstream/types';
import { LocalOnlyTables, dexieDb } from './ui-db';

/**
 * Row-level persistence for the local Data History feature (searchable catalog only — payload
 * files live in the pluggable file store owned by `@jetstream/ui/data-history`).
 */
export const dataHistoryDb = {
  generateKey,
  saveEntry,
  updateEntry,
  getEntry,
  getAllEntries,
  getEntries,
  getEntryCount,
  getTotalSizeBytes,
  setPinned,
  deleteEntries,
  getSettings,
  saveSettings,
  getBackendConfig,
  saveBackendConfig,
};

export interface DataHistoryListFilter {
  org?: string;
  source?: DataHistorySource;
  status?: DataHistoryStatus;
  pinnedOnly?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  limit?: number;
}

/**
 * Boolean fields cannot be indexes, so we store a string version of the same field
 */
dexieDb.data_history.hook('creating', function (primaryKey, record) {
  record.pinnedIdx = record.pinned ? 'true' : 'false';
});

dexieDb.data_history.hook('updating', function (mods) {
  if ('pinned' in mods) {
    return { ...mods, pinnedIdx: mods.pinned ? 'true' : 'false' };
  }
  return undefined;
});

function generateKey(): DataHistoryItem['key'] {
  return `${LocalOnlyTables.data_history.keyPrefix}_${globalThis.crypto.randomUUID()}`;
}

async function saveEntry(item: DataHistoryItem): Promise<DataHistoryItem> {
  await dexieDb.data_history.put(item);
  return item;
}

async function updateEntry(key: string, changes: Partial<DataHistoryItem>): Promise<DataHistoryItem | undefined> {
  await dexieDb.data_history.update(key, { ...changes, updatedAt: new Date() });
  return await dexieDb.data_history.get(key);
}

async function getEntry(key: string): Promise<DataHistoryItem | undefined> {
  return await dexieDb.data_history.get(key);
}

async function getAllEntries(): Promise<DataHistoryItem[]> {
  return await dexieDb.data_history.toArray();
}

/**
 * List entries newest-first. Uses the `[org+createdAt]` index when an org filter is provided and
 * the `createdAt` index otherwise; remaining filters are applied in memory (result sets are small
 * once org/date narrowing is applied, and `sobjects` is an array which Dexie cannot index).
 */
async function getEntries(filter: DataHistoryListFilter = {}): Promise<DataHistoryItem[]> {
  const { org, source, status, pinnedOnly, createdAfter, createdBefore, limit } = filter;

  let collection = org
    ? dexieDb.data_history
        .where('[org+createdAt]')
        .between([org, createdAfter ?? new Date(0)], [org, createdBefore ?? new Date(8.64e15)], true, true)
    : dexieDb.data_history.where('createdAt').between(createdAfter ?? new Date(0), createdBefore ?? new Date(8.64e15), true, true);

  collection = collection.reverse();

  if (source || status || pinnedOnly) {
    collection = collection.filter(
      (row) => (!source || row.source === source) && (!status || row.status === status) && (!pinnedOnly || row.pinned),
    );
  }

  if (limit && limit > 0) {
    collection = collection.limit(limit);
  }

  // toArray honors reverse() by traversing the (org+)createdAt index descending -> newest first
  return await collection.toArray();
}

async function getEntryCount(): Promise<number> {
  return await dexieDb.data_history.count();
}

async function getTotalSizeBytes(): Promise<number> {
  let total = 0;
  await dexieDb.data_history.each((row) => {
    total += row.sizeBytes || 0;
  });
  return total;
}

async function setPinned(key: string, pinned: boolean): Promise<DataHistoryItem | undefined> {
  return await updateEntry(key, { pinned });
}

async function deleteEntries(keys: string[]): Promise<void> {
  if (keys.length === 0) {
    return;
  }
  await dexieDb.data_history.bulkDelete(keys);
}

async function getSettings(defaults: DataHistorySettings): Promise<DataHistorySettings> {
  try {
    const row = await dexieDb.data_history_config.get('settings');
    if (!row) {
      return defaults;
    }
    const parsed = dataHistorySettingsSchema.safeParse(row.value);
    return parsed.success ? parsed.data : defaults;
  } catch (ex) {
    logger.warn('[DB][DATA_HISTORY] Error reading settings, using defaults', ex);
    return defaults;
  }
}

async function saveSettings(settings: DataHistorySettings): Promise<void> {
  await dexieDb.data_history_config.put({ key: 'settings', value: settings, updatedAt: new Date() });
}

async function getBackendConfig(): Promise<DataHistoryBackendConfig> {
  try {
    const row = await dexieDb.data_history_config.get('backend');
    const value = row?.value as DataHistoryBackendConfig | undefined;
    if (value && dataHistoryStorageBackendSchema.safeParse(value.active).success) {
      return value;
    }
  } catch (ex) {
    logger.warn('[DB][DATA_HISTORY] Error reading backend config, using OPFS', ex);
  }
  return { active: 'opfs' };
}

async function saveBackendConfig(config: DataHistoryBackendConfig): Promise<void> {
  await dexieDb.data_history_config.put({ key: 'backend', value: config, updatedAt: new Date() });
}
