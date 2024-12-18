import { logger } from '@jetstream/shared/client-logger';
import { QueryHistoryItem, QueryHistoryObject, SalesforceOrgUi } from '@jetstream/types';
import { dexieDb } from './client-data.db';

export const queryHistoryObjectDb = {
  saveQueryHistoryObject,
  saveQueryHistoryObjectFromKey,
  deleteAllQueryHistoryObjectForOrg,
};

function generateKey(orgUniqueId: string, sObject: string, isTooling: boolean): string {
  return `qho_${orgUniqueId}:${sObject}:${isTooling}`.toLowerCase();
}

function getQueryHistoryObject(queryHistoryItem: QueryHistoryItem): QueryHistoryObject {
  return {
    key: generateKey(queryHistoryItem.org, queryHistoryItem.sObject, queryHistoryItem.isTooling),
    org: queryHistoryItem.org,
    sObject: queryHistoryItem.sObject,
    sObjectLabel: queryHistoryItem.label,
    isTooling: queryHistoryItem.isTooling ? 'true' : 'false',
  };
}

async function saveQueryHistoryObject(queryHistoryItem: QueryHistoryItem): Promise<void> {
  try {
    const item = getQueryHistoryObject(queryHistoryItem);
    await dexieDb._query_history_object.put(item);
  } catch (ex) {
    logger.warn('[DB] Error saving query history object', ex);
  }
}

async function saveQueryHistoryObjectFromKey(queryHistoryItemKey: string): Promise<void> {
  try {
    const queryHistoryItem = await dexieDb.query_history.get(queryHistoryItemKey);
    if (!queryHistoryItem) {
      return;
    }
    const item = getQueryHistoryObject(queryHistoryItem);
    await dexieDb._query_history_object.put(item);
  } catch (ex) {
    logger.warn('[DB] Error saving query history object', ex);
  }
}

async function deleteAllQueryHistoryObjectForOrg(org: SalesforceOrgUi): Promise<void> {
  try {
    await dexieDb._query_history_object.where({ org: org.uniqueId }).delete();
  } catch (ex) {
    logger.error('[DB] Error deleting query history object for org', ex);
  }
}
