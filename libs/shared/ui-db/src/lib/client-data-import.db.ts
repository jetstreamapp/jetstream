import { logger } from '@jetstream/shared/client-logger';
import { INDEXED_DB } from '@jetstream/shared/constants';
import {
  ApexHistoryItem,
  ApiHistoryItem,
  CLIENT_DATA_EXPORT_VERSION,
  ClientDataExportEnvelope,
  ClientDataExportEnvelopeSchema,
  ClientDataExportRecentRecord,
  LoadSavedMappingItem,
  QueryHistoryItem,
  RecentHistoryItem,
  SalesforceApiHistoryItem,
  SalesforceDeployHistoryItem,
} from '@jetstream/types';
import localforage from 'localforage';
import uniqBy from 'lodash/uniqBy';
import {
  mergeApiRequestHistory,
  mergeLoadSavedMapping,
  mergeQueryHistory,
  mergeRecentHistoryItem,
  toQueryHistoryObject,
} from './client-data-merge.utils';
import { dexieDb, getHashedRecordKey } from './ui-db';

const RECENT_RECORDS_MAX_ITEMS = 25; // mirrors record-utils.ts
const DEPLOY_HISTORY_MAX_ITEMS = 500; // mirrors deploy-metadata.utils.tsx

export interface ImportResultSummary {
  query_history: number;
  load_saved_mapping: number;
  recent_history_item: number;
  api_request_history: number;
  apex_history: number;
  salesforce_api_history: number;
  deploy_history: number;
  recent_records: number;
}

/**
 * Imports a previously exported history envelope into the browser, upserting by each record's
 * deterministic content-based key so re-importing the same file never creates duplicates.
 *
 * Validation (shape, app marker, version, date revival, reserved-key stripping) happens up front via
 * the Zod schema — no data is written until the envelope is known-good. Conflicts are resolved with a
 * smart merge per dataset (most-recently-run record wins, favorites are unioned, run counts take the
 * max) rather than a blind overwrite, which keeps re-imports idempotent.
 *
 * @throws ZodError when the file is not a valid Jetstream history export.
 * @throws Error when the file was produced by a newer, unsupported export version.
 */
export async function importClientHistoryData(raw: unknown): Promise<ImportResultSummary> {
  const envelope = ClientDataExportEnvelopeSchema.parse(raw) as unknown as ClientDataExportEnvelope;

  if (envelope.version > CLIENT_DATA_EXPORT_VERSION) {
    throw new Error(
      'This backup was created by a newer version of Jetstream and cannot be imported. Please update Jetstream and try again.',
    );
  }

  const { data } = envelope;

  return {
    query_history: await upsertQueryHistory(data.query_history),
    load_saved_mapping: await upsertLoadSavedMapping(data.load_saved_mapping),
    recent_history_item: await upsertRecentHistoryItems(data.recent_history_item),
    api_request_history: await upsertApiRequestHistory(data.api_request_history),
    apex_history: await mergeLocalforageHistoryMap<ApexHistoryItem>(INDEXED_DB.KEYS.apexHistory, data.apex_history),
    salesforce_api_history: await mergeLocalforageHistoryMap<SalesforceApiHistoryItem>(
      INDEXED_DB.KEYS.salesforceApiHistory,
      data.salesforce_api_history,
    ),
    deploy_history: await mergeDeployHistory(data.deploy_history),
    recent_records: await mergeRecentRecords(data.recent_records),
  };
}

/**
 * Dexie tables — `hashedKey` (and `isFavoriteIdx` for query history) are always recomputed rather than
 * trusted from the file, mirroring the localforage→dexie migration. `bulkPut` of the merged set
 * produces a dexie-observable change per record, so normal sync pushes imported records to the server
 * for paid users with no extra handling.
 */

async function upsertQueryHistory(imported: QueryHistoryItem[]): Promise<number> {
  if (!imported.length) {
    return 0;
  }
  const existingList = await dexieDb.query_history.bulkGet(imported.map((item) => item.key));
  const merged: QueryHistoryItem[] = [];
  for (let i = 0; i < imported.length; i++) {
    const item = mergeQueryHistory(existingList[i] ?? undefined, imported[i]);
    item.hashedKey = await getHashedRecordKey(item.key);
    item.isFavoriteIdx = item.isFavorite ? 'true' : 'false';
    merged.push(item);
  }
  await dexieDb.query_history.bulkPut(merged);
  await deriveQueryHistoryObjects(merged);
  return merged.length;
}

async function upsertApiRequestHistory(imported: ApiHistoryItem[]): Promise<number> {
  if (!imported.length) {
    return 0;
  }
  const existingList = await dexieDb.api_request_history.bulkGet(imported.map((item) => item.key));
  const merged: ApiHistoryItem[] = [];
  for (let i = 0; i < imported.length; i++) {
    const item = mergeApiRequestHistory(existingList[i] ?? undefined, imported[i]);
    item.hashedKey = await getHashedRecordKey(item.key);
    merged.push(item);
  }
  await dexieDb.api_request_history.bulkPut(merged);
  return merged.length;
}

async function upsertLoadSavedMapping(imported: LoadSavedMappingItem[]): Promise<number> {
  if (!imported.length) {
    return 0;
  }
  const existingList = await dexieDb.load_saved_mapping.bulkGet(imported.map((item) => item.key));
  const merged: LoadSavedMappingItem[] = [];
  for (let i = 0; i < imported.length; i++) {
    const item = mergeLoadSavedMapping(existingList[i] ?? undefined, imported[i]);
    item.hashedKey = await getHashedRecordKey(item.key);
    merged.push(item);
  }
  await dexieDb.load_saved_mapping.bulkPut(merged);
  return merged.length;
}

async function upsertRecentHistoryItems(imported: RecentHistoryItem[]): Promise<number> {
  if (!imported.length) {
    return 0;
  }
  const existingList = await dexieDb.recent_history_item.bulkGet(imported.map((item) => item.key));
  const merged: RecentHistoryItem[] = [];
  for (let i = 0; i < imported.length; i++) {
    const item = mergeRecentHistoryItem(existingList[i] ?? undefined, imported[i]);
    item.hashedKey = await getHashedRecordKey(item.key);
    merged.push(item);
  }
  await dexieDb.recent_history_item.bulkPut(merged);
  return merged.length;
}

/**
 * Re-derive the (non-synced) `_query_history_object` lookup rows that power the object filter list in
 * the query history modal, rather than exporting/importing them directly.
 */
async function deriveQueryHistoryObjects(items: QueryHistoryItem[]): Promise<void> {
  try {
    const objects = uniqBy(items.map(toQueryHistoryObject), 'key');
    await dexieDb._query_history_object.bulkPut(objects);
  } catch (ex) {
    logger.warn('[DB][IMPORT] Error deriving query history objects', ex);
  }
}

/**
 * localforage datasets (local-only, never synced).
 */

/** Shared merge for the keyed history maps (apex, salesforce api) — later `lastRun` wins per key. */
async function mergeLocalforageHistoryMap<T extends { lastRun: Date }>(storageKey: string, imported: Record<string, T>): Promise<number> {
  const importedKeys = Object.keys(imported);
  if (!importedKeys.length) {
    return 0;
  }
  try {
    const existing = (await localforage.getItem<Record<string, T>>(storageKey)) || {};
    const merged: Record<string, T> = { ...existing };
    for (const [key, item] of Object.entries(imported)) {
      const current = merged[key];
      merged[key] = !current || new Date(item.lastRun).getTime() >= new Date(current.lastRun).getTime() ? item : current;
    }
    await localforage.setItem(storageKey, merged);
  } catch (ex) {
    logger.warn('[DB][IMPORT] Error merging localforage history map', storageKey, ex);
    throw ex;
  }
  return importedKeys.length;
}

async function mergeRecentRecords(imported: Record<string, ClientDataExportRecentRecord[]>): Promise<number> {
  const orgIds = Object.keys(imported);
  if (!orgIds.length) {
    return 0;
  }
  let importedCount = 0;
  try {
    const existing = (await localforage.getItem<Record<string, ClientDataExportRecentRecord[]>>(INDEXED_DB.KEYS.recentRecords)) || {};
    const merged: Record<string, ClientDataExportRecentRecord[]> = { ...existing };
    for (const [orgId, importedItems] of Object.entries(imported)) {
      importedCount += importedItems.length;
      const combined = [...(merged[orgId] || []), ...importedItems];
      merged[orgId] = uniqBy(combined, 'recordId').slice(0, RECENT_RECORDS_MAX_ITEMS);
    }
    await localforage.setItem(INDEXED_DB.KEYS.recentRecords, merged);
  } catch (ex) {
    logger.warn('[DB][IMPORT] Error merging recent records', ex);
    throw ex;
  }
  return importedCount;
}

/**
 * Deploy history dedups by `key`; existing items are kept on collision because they may reference a
 * local package blob that the export intentionally omitted. Imported items are guaranteed to have no
 * `fileKey` so they can never dangle-reference a missing blob.
 */
async function mergeDeployHistory(imported: SalesforceDeployHistoryItem[]): Promise<number> {
  if (!imported.length) {
    return 0;
  }
  try {
    const existing = (await localforage.getItem<SalesforceDeployHistoryItem[]>(INDEXED_DB.KEYS.deployHistory)) || [];
    const byKey = new Map<string, SalesforceDeployHistoryItem>();
    for (const item of existing) {
      byKey.set(item.key, item);
    }
    for (const { fileKey, ...item } of imported) {
      if (!byKey.has(item.key)) {
        byKey.set(item.key, item);
      }
    }
    const merged = Array.from(byKey.values())
      .sort((a, b) => new Date(b.finish).getTime() - new Date(a.finish).getTime())
      .slice(0, DEPLOY_HISTORY_MAX_ITEMS);
    await localforage.setItem(INDEXED_DB.KEYS.deployHistory, merged);
  } catch (ex) {
    logger.warn('[DB][IMPORT] Error merging deploy history', ex);
    throw ex;
  }
  return imported.length;
}
