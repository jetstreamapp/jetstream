import { logger } from '@jetstream/shared/client-logger';
import {
  DataHistoryBackendConfig,
  DataHistoryItem,
  DataHistorySettings,
  dataHistorySettingsSchema,
  dataHistoryStorageBackendSchema,
} from '@jetstream/types';
import { LocalOnlyTables, getDexieDb, wrapApiWithReopenOnDatabaseClosed } from './ui-db';

/**
 * Row-level persistence for the local Data History feature (searchable catalog only — payload
 * files live in the pluggable file store owned by `@jetstream/ui/data-history`).
 *
 * Wrapped in `wrapApiWithReopenOnDatabaseClosed` like every other `*Db` api here: dexie-observable
 * can close the shared connection mid-session (see the note on that helper), and because history
 * capture swallows its own errors by design, an unwrapped DatabaseClosedError would silently stop
 * ALL capture for the rest of the session with nothing surfaced to the user.
 */
export const dataHistoryDb = {
  // Pure uuid generation, no db access — kept outside the wrapper, which only wraps async fns
  generateKey,
  ...wrapApiWithReopenOnDatabaseClosed({
    saveEntry,
    updateEntry,
    getEntry,
    getAllEntries,
    getAllEntryKeys,
    getEntries,
    getEntryCount,
    getPinnedCount,
    getTotalSizeBytes,
    setPinned,
    deleteEntries,
    getSettings,
    saveSettings,
    getBackendConfig,
    saveBackendConfig,
    getPaidPlanLastSeenAt,
    savePaidPlanLastSeenAt,
    getDeletedEntryTombstones,
    addDeletedEntryTombstone,
    addDeletedEntryTombstones,
  }),
};

/**
 * Narrowing for the history list — deliberately limited to what the `[org+createdAt]` / `createdAt`
 * indexes can serve. Anything else is the table's own column filters, which only ever see rows the
 * query already returned.
 */
export interface DataHistoryListFilter {
  org?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  limit?: number;
}

function generateKey(): DataHistoryItem['key'] {
  return `${LocalOnlyTables.data_history.keyPrefix}_${globalThis.crypto.randomUUID()}`;
}

async function saveEntry(item: DataHistoryItem): Promise<DataHistoryItem> {
  await getDexieDb().data_history.put(item);
  return item;
}

async function updateEntry(key: string, changes: Partial<DataHistoryItem>): Promise<DataHistoryItem | undefined> {
  await getDexieDb().data_history.update(key, { ...changes, updatedAt: new Date() });
  return await getDexieDb().data_history.get(key);
}

async function getEntry(key: string): Promise<DataHistoryItem | undefined> {
  return await getDexieDb().data_history.get(key);
}

async function getAllEntries(): Promise<DataHistoryItem[]> {
  return await getDexieDb().data_history.toArray();
}

/**
 * Every entry key without reading the rows. Used by the orphan-directory sweep, which only needs to
 * answer "does a row exist for this directory" — loading full rows there is wasted deserialization.
 */
async function getAllEntryKeys(): Promise<string[]> {
  return (await getDexieDb().data_history.toCollection().primaryKeys()) as string[];
}

/**
 * List entries newest-first. Uses the `[org+createdAt]` index when an org filter is provided and
 * the `createdAt` index otherwise.
 */
async function getEntries(filter: DataHistoryListFilter = {}): Promise<DataHistoryItem[]> {
  const { org, createdAfter, createdBefore, limit } = filter;
  const { data_history } = getDexieDb();

  let collection = org
    ? data_history
        .where('[org+createdAt]')
        .between([org, createdAfter ?? new Date(0)], [org, createdBefore ?? new Date(8.64e15)], true, true)
    : data_history.where('createdAt').between(createdAfter ?? new Date(0), createdBefore ?? new Date(8.64e15), true, true);

  collection = collection.reverse();

  if (limit && limit > 0) {
    collection = collection.limit(limit);
  }

  // toArray honors reverse() by traversing the (org+)createdAt index descending -> newest first
  return await collection.toArray();
}

async function getEntryCount(): Promise<number> {
  return await getDexieDb().data_history.count();
}

/** Count of pinned entries via the `pinnedIdx` index (booleans cannot be Dexie indexes) — no rows deserialized */
async function getPinnedCount(): Promise<number> {
  return await getDexieDb().data_history.where('pinnedIdx').equals('true').count();
}

/**
 * Total bytes across every entry, summed from the `sizeBytes` INDEX so no row is ever deserialized —
 * same motivation as `getAllEntryKeys` above. This runs on every settings/history page mount, and
 * for users whose tier has no entry cap that is an unbounded number of rows.
 *
 * IndexedDB omits records with a missing index key, so a row without `sizeBytes` is skipped — which
 * is what summing it as 0 would have done anyway.
 */
async function getTotalSizeBytes(): Promise<number> {
  const sizes = (await getDexieDb().data_history.orderBy('sizeBytes').keys()) as unknown[];
  return sizes.reduce<number>((total, size) => total + (typeof size === 'number' ? size : 0), 0);
}

async function setPinned(key: string, pinned: boolean): Promise<DataHistoryItem | undefined> {
  return await updateEntry(key, { pinned });
}

async function deleteEntries(keys: string[]): Promise<void> {
  if (keys.length === 0) {
    return;
  }
  await getDexieDb().data_history.bulkDelete(keys);
}

async function getSettings(defaults: DataHistorySettings): Promise<DataHistorySettings> {
  try {
    const row = await getDexieDb().data_history_config.get('settings');
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
  await getDexieDb().data_history_config.put({ key: 'settings', value: settings, updatedAt: new Date() });
}

async function getBackendConfig(): Promise<DataHistoryBackendConfig> {
  try {
    const row = await getDexieDb().data_history_config.get('backend');
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
  await getDexieDb().data_history_config.put({ key: 'backend', value: config, updatedAt: new Date() });
}

/**
 * Last time a paid-plan signal was observed. Free-tier limits are enforced destructively (entries
 * deleted), so the service keeps paid limits for a grace window after the signal disappears — a
 * transient billing lapse (PAST_DUE from an expired card) must not delete a year of history.
 */
async function getPaidPlanLastSeenAt(): Promise<Date | null> {
  try {
    const row = await getDexieDb().data_history_config.get('paidPlanLastSeenAt');
    const value = row?.value;
    if (typeof value === 'string' || typeof value === 'number' || value instanceof Date) {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  } catch (ex) {
    logger.warn('[DB][DATA_HISTORY] Error reading paid plan marker', ex);
  }
  return null;
}

async function savePaidPlanLastSeenAt(date: Date): Promise<void> {
  await getDexieDb().data_history_config.put({ key: 'paidPlanLastSeenAt', value: date, updatedAt: new Date() });
}

/** Bounded so a pathological delete loop cannot grow the row forever */
const TOMBSTONE_LIMIT = 1000;

/**
 * Keys of entries the user deleted while their files could not be removed (e.g. lost folder
 * permission). Folder re-indexing skips these so a deleted entry cannot resurrect from its
 * leftover manifest.
 */
async function getDeletedEntryTombstones(): Promise<string[]> {
  try {
    const row = await getDexieDb().data_history_config.get('deletedEntryTombstones');
    if (Array.isArray(row?.value)) {
      return (row.value as unknown[]).filter((key): key is string => typeof key === 'string');
    }
  } catch (ex) {
    logger.warn('[DB][DATA_HISTORY] Error reading tombstones', ex);
  }
  return [];
}

async function addDeletedEntryTombstone(key: string): Promise<void> {
  await addDeletedEntryTombstones([key]);
}

/**
 * Add many tombstones in ONE read + ONE write. The tombstone list is a single row holding the whole
 * array, so bulk callers (delete-all) must not loop over the single-key variant — that rewrites the
 * full list once per entry.
 */
async function addDeletedEntryTombstones(keys: string[]): Promise<void> {
  if (keys.length === 0) {
    return;
  }
  const addedKeys = new Set(keys);
  const existing = await getDeletedEntryTombstones();
  const updated = [...existing.filter((existingKey) => !addedKeys.has(existingKey)), ...addedKeys].slice(-TOMBSTONE_LIMIT);
  await getDexieDb().data_history_config.put({ key: 'deletedEntryTombstones', value: updated, updatedAt: new Date() });
}
