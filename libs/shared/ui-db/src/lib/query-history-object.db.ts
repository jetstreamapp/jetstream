import { logger } from '@jetstream/shared/client-logger';
import { QueryHistoryItem, QueryHistoryObject, SalesforceOrgUi } from '@jetstream/types';
import { DexieDb, getDexieDb, wrapApiWithReopenOnDatabaseClosed } from './ui-db';

export const queryHistoryObjectDb = wrapApiWithReopenOnDatabaseClosed({
  deleteAllQueryHistoryObjectForOrg,
});

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

/**
 * Write the derived object row for a query history item.
 *
 * Takes the database explicitly instead of calling `getDexieDb()`: the only caller is the
 * `query_history` creating hook, which defers this write out of the creating transaction, and the
 * active database can be swapped in that window (logout / account switch). Going through the global
 * accessor would land the departing user's row in the next user's database.
 */
export async function saveQueryHistoryObject(db: DexieDb, queryHistoryItem: QueryHistoryItem): Promise<void> {
  try {
    await db._query_history_object.put(getQueryHistoryObject(queryHistoryItem));
  } catch (ex) {
    logger.warn('[DB] Error saving query history object', ex);
  }
}

async function deleteAllQueryHistoryObjectForOrg(org: SalesforceOrgUi): Promise<void> {
  try {
    await getDexieDb()._query_history_object.where({ org: org.uniqueId }).delete();
  } catch (ex) {
    logger.error('[DB] Error deleting query history object for org', ex);
  }
}
