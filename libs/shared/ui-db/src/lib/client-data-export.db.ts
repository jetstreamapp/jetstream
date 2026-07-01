import { logger } from '@jetstream/shared/client-logger';
import { INDEXED_DB } from '@jetstream/shared/constants';
import {
  ApexHistoryItem,
  ApiHistoryItem,
  CLIENT_DATA_EXPORT_APP,
  CLIENT_DATA_EXPORT_VERSION,
  ClientDataExportEnvelope,
  ClientDataExportRecentRecord,
  LoadSavedMappingItem,
  QueryHistoryItem,
  RecentHistoryItem,
  SalesforceApiHistoryItem,
  SalesforceDeployHistoryItem,
} from '@jetstream/types';
import localforage from 'localforage';
import { dexieDb } from './ui-db';

/**
 * Builds a single portable envelope of the user's browser-stored history so it can be saved to a file
 * and re-imported later (or on another device). Reads the Dexie synced tables and the localforage
 * local-only datasets. Deploy history is included as metadata only — the large binary package files
 * (stored under `HISTORY:DEPLOY:FILE:*`) are intentionally excluded to keep the export small.
 *
 * Date fields are left as `Date` objects; `JSON.stringify` serializes them to ISO strings when the
 * caller writes the file, and they are revived on import.
 */
export async function exportClientHistoryData(): Promise<ClientDataExportEnvelope> {
  const [
    query_history,
    load_saved_mapping,
    recent_history_item,
    api_request_history,
    apex_history,
    salesforce_api_history,
    deploy_history,
    recent_records,
  ] = await Promise.all([
    dexieDb.query_history.toArray(),
    dexieDb.load_saved_mapping.toArray(),
    dexieDb.recent_history_item.toArray(),
    dexieDb.api_request_history.toArray(),
    getLocalforageMap<ApexHistoryItem>(INDEXED_DB.KEYS.apexHistory),
    getLocalforageMap<SalesforceApiHistoryItem>(INDEXED_DB.KEYS.salesforceApiHistory),
    getDeployHistoryMetadata(),
    getLocalforageMap<ClientDataExportRecentRecord[]>(INDEXED_DB.KEYS.recentRecords),
  ]);

  return {
    version: CLIENT_DATA_EXPORT_VERSION,
    app: CLIENT_DATA_EXPORT_APP,
    exportedAt: new Date().toISOString(),
    data: {
      query_history: query_history as QueryHistoryItem[],
      load_saved_mapping: load_saved_mapping as LoadSavedMappingItem[],
      recent_history_item: recent_history_item as RecentHistoryItem[],
      api_request_history: api_request_history as ApiHistoryItem[],
      apex_history,
      salesforce_api_history,
      deploy_history,
      recent_records,
    },
  };
}

async function getLocalforageMap<T>(key: string): Promise<Record<string, T>> {
  try {
    return (await localforage.getItem<Record<string, T>>(key)) || {};
  } catch (ex) {
    logger.warn('[DB][EXPORT] Error reading localforage key', key, ex);
    return {};
  }
}

/**
 * Deploy history is stored as an array. We strip `fileKey` so an imported item never dangle-references
 * a missing package blob (the blobs themselves are not exported).
 */
async function getDeployHistoryMetadata(): Promise<SalesforceDeployHistoryItem[]> {
  try {
    const items = (await localforage.getItem<SalesforceDeployHistoryItem[]>(INDEXED_DB.KEYS.deployHistory)) || [];
    return items.map(({ fileKey, ...item }) => item);
  } catch (ex) {
    logger.warn('[DB][EXPORT] Error reading deploy history', ex);
    return [];
  }
}
