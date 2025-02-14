import { logger } from '@jetstream/shared/client-logger';
import { describeSObject } from '@jetstream/shared/data';
import { REGEX } from '@jetstream/shared/utils';
import { QueryHistoryItem, SalesforceOrgUi } from '@jetstream/types';
import { dexieDb, getHashedRecordKey, SyncableTables } from './ui-db';

export const queryHistoryDb = {
  getAllQueryHistory,
  getOrInitQueryHistoryItem,
  saveQueryHistoryItem,
  setAsFavorite,
  deleteAllQueryHistoryForOrg,
  TEMP_deleteItem,
};

/**
 * Boolean fields cannot be indexes, so we store a string version of the same field
 */
dexieDb.query_history.hook('updating', function (mods, primaryKey, obj, transaction) {
  if ('isFavorite' in mods) {
    return { ...mods, isFavoriteIdx: mods.isFavorite ? 'true' : 'false' };
  }
});

function generateKey(orgUniqueId: string, sObject: string, soql: string): QueryHistoryItem['key'] {
  return `${SyncableTables.query_history.keyPrefix}_${orgUniqueId}:${sObject}${soql.replace(
    REGEX.NOT_ALPHANUMERIC_OR_UNDERSCORE,
    ''
  )}`.toLowerCase() as QueryHistoryItem['key'];
}

async function getAllQueryHistory(): Promise<QueryHistoryItem[]> {
  return await dexieDb.query_history.toArray();
}

async function setAsFavorite(key: QueryHistoryItem['key'], isFavorite: boolean, customLabel?: string): Promise<QueryHistoryItem> {
  const updates: Partial<QueryHistoryItem> = { isFavorite };
  // update custom label if provided
  if (customLabel) {
    updates.customLabel = customLabel;
  } else if (!isFavorite) {
    updates.customLabel = null;
  }
  await dexieDb.query_history.update(key, updates);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return (await dexieDb.query_history.get(key))!;
}

async function getOrInitQueryHistoryItem(
  org: SalesforceOrgUi,
  soql: string,
  sObject: string,
  sObjectLabel?: string,
  customLabel?: string,
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
    hashedKey: existingItem?.hashedKey ?? (await getHashedRecordKey(key)),
    label: sObjectLabel,
    customLabel: existingItem?.customLabel ?? customLabel,
    soql,
    org: org.uniqueId,
    runCount: existingItem?.runCount || 0,
    sObject,
    lastRun: new Date(),
    isTooling,
    isFavorite: existingItem?.isFavorite ?? false,
    createdAt: existingItem?.createdAt || new Date(),
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
  queryHistoryItem.label = sObjectLabel ?? queryHistoryItem.label;
  queryHistoryItem.customLabel = customLabel ?? queryHistoryItem.customLabel;
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
