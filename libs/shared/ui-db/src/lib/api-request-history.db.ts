import { logger } from '@jetstream/shared/client-logger';
import { ApiHistoryItem, HttpMethod, SalesforceApiHistoryRequest, SalesforceApiHistoryResponse, SalesforceOrgUi } from '@jetstream/types';
import { dexieDb, getHashedRecordKey, SyncableTables } from './ui-db';

export const apiRequestHistoryDb = {
  getAllQueryHistory,
  saveApiHistoryItem,
  deleteAllApiHistoryForOrg,
};

function generateKey(orgUniqueId: string, method: HttpMethod, url: string): ApiHistoryItem['key'] {
  return `${SyncableTables.api_request_history.keyPrefix}_${orgUniqueId}:${method}:${url}`.toLowerCase() as ApiHistoryItem['key'];
}

async function getAllQueryHistory(): Promise<ApiHistoryItem[]> {
  return await dexieDb.api_request_history.toArray();
}

async function saveApiHistoryItem(
  org: SalesforceOrgUi,
  request: SalesforceApiHistoryRequest,
  response: SalesforceApiHistoryResponse,
): Promise<ApiHistoryItem> {
  const key = generateKey(org.uniqueId, request.method, request.url);
  const hashedKey = await getHashedRecordKey(key);
  const existingItem = await dexieDb.api_request_history.get(key);
  const item: ApiHistoryItem = {
    key,
    hashedKey,
    org: org.uniqueId,
    label: request.url,
    lastRun: new Date(),
    isFavorite: existingItem?.isFavorite === 'true' ? 'true' : 'false',
    request,
    response,
    createdAt: existingItem?.createdAt || new Date(),
    updatedAt: new Date(),
  };

  await dexieDb.api_request_history.put(item);
  return item;
}

async function deleteAllApiHistoryForOrg(org: SalesforceOrgUi): Promise<void> {
  try {
    await dexieDb.api_request_history.where({ org: org.uniqueId }).delete();
  } catch (ex) {
    logger.error('[DB] Error deleting query history for org', ex);
  }
}
