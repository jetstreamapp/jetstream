import { logger } from '@jetstream/shared/client-logger';
import { describeSObject } from '@jetstream/shared/data';
import { REGEX } from '@jetstream/shared/utils';
import { QueryHistoryItem, SalesforceOrgUi } from '@jetstream/types';
import { dexieDb } from './client-data.db';

export const queryHistoryDb = {
  getAllQueryHistory,
  getOrInitQueryHistoryItem,
  saveQueryHistoryItem,
  setAsFavorite,
  deleteAllQueryHistoryForOrg,
  TEMP_deleteItem,
};

function generateKey(orgUniqueId: string, sObject: string, soql: string): string {
  return `qh_${orgUniqueId}:${sObject}${soql.replace(REGEX.NOT_ALPHANUMERIC_OR_UNDERSCORE, '')}`.toLowerCase();
}

async function getAllQueryHistory(): Promise<QueryHistoryItem[]> {
  return await dexieDb.query_history.toArray();
}

// FIXME: should be customLabel
async function setAsFavorite(key: string, isFavorite: boolean, label?: string): Promise<QueryHistoryItem> {
  const updates: Partial<QueryHistoryItem> = { isFavorite };
  if (label) {
    updates.label = label;
  }
  await dexieDb.query_history.update(key, { isFavorite });
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return (await dexieDb.query_history.get(key))!;
}

async function getOrInitQueryHistoryItem(
  org: SalesforceOrgUi,
  soql: string,
  sObject: string,
  sObjectLabel?: string,
  isTooling = false
): Promise<QueryHistoryItem> {
  // FIXME: isTooling should be part of key - not a huge deal either way but could have some edge-cases for the few duplicate objects
  const key = generateKey(org.uniqueId, sObject, soql);
  const existingItem = await dexieDb.query_history.get(key);

  sObjectLabel = sObjectLabel || existingItem?.label;

  if (!sObjectLabel) {
    const resultsWithCache = await describeSObject(org, sObject, isTooling);
    const results = resultsWithCache.data;
    sObject = results.name;
    sObjectLabel = results.label;
  }

  const queryHistoryItem: QueryHistoryItem = {
    key,
    label: sObjectLabel, // TODO: need to introduce customLabel
    soql,
    org: org.uniqueId,
    runCount: existingItem?.runCount || 0,
    sObject,
    lastRun: new Date(),
    isTooling,
    isFavorite: existingItem?.isFavorite ?? false,
    created: existingItem?.created || new Date(),
    updatedAt: new Date(),
  };

  return queryHistoryItem;
}

async function saveQueryHistoryItem(
  org: SalesforceOrgUi,
  soql: string,
  sObject: string,
  {
    customLabel,
    incrementRunCount,
    isFavorite,
    isTooling,
    sObjectLabel,
  }: {
    sObjectLabel?: string;
    customLabel?: string;
    isFavorite?: boolean;
    isTooling?: boolean;
    incrementRunCount?: boolean;
  } = {}
): Promise<QueryHistoryItem> {
  const queryHistoryItem = await getOrInitQueryHistoryItem(org, soql, sObject);

  if (incrementRunCount) {
    queryHistoryItem.runCount++;
  }

  queryHistoryItem.isFavorite = isFavorite ?? queryHistoryItem.isFavorite;
  queryHistoryItem.label = customLabel ?? sObjectLabel ?? queryHistoryItem.label;
  queryHistoryItem.isTooling = isTooling ?? queryHistoryItem.isTooling;

  await dexieDb.query_history.put(queryHistoryItem);
  return queryHistoryItem;
}

async function TEMP_deleteItem(key: string): Promise<void> {
  try {
    await dexieDb.query_history.where({ key }).delete();
  } catch (ex) {
    logger.error('[DB] Error deleting query history for key', key, ex);
  }
}

async function deleteAllQueryHistoryForOrg(org: SalesforceOrgUi): Promise<void> {
  try {
    await dexieDb.query_history.where({ org: org.uniqueId }).delete();
  } catch (ex) {
    logger.error('[DB] Error deleting query history for org', ex);
  }
}
