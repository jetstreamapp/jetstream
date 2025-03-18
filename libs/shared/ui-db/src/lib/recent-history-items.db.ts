import { logger } from '@jetstream/shared/client-logger';
import { groupByFlat } from '@jetstream/shared/utils';
import { RecentHistoryItem, RecentHistoryItemType } from '@jetstream/types';
import uniqBy from 'lodash/uniqBy';
import { dexieDb, getHashedRecordKey, SyncableTables } from './ui-db';

export const recentHistoryItemsDb = {
  addItemToRecentHistoryItems,
  getRecentHistoryFromRecords,
  saveRecentHistoryItem,
  clearRecentHistoryItemsForCurrentOrg,
  clearRecentHistoryItemsForAllOrgs,
};

const MAX_ITEM_SIZE = 75;

function generateKey(orgUniqueId: string, recentItemsKey: RecentHistoryItemType): RecentHistoryItem['key'] {
  return `${SyncableTables.recent_history_item.keyPrefix}_${orgUniqueId}:${recentItemsKey}`.toLowerCase() as RecentHistoryItem['key'];
}

async function getRecentHistoryFromRecords<T extends { name: string }>({
  orgUniqueId,
  recentItemsKey,
  records,
}: {
  orgUniqueId: string;
  recentItemsKey: RecentHistoryItemType;
  records: T[];
}) {
  const recordsByName = groupByFlat(records, 'name');

  const items = await dexieDb.recent_history_item
    .get(generateKey(orgUniqueId, recentItemsKey))
    .then((record) => record?.items?.map(({ name }) => name) || []);
  return items?.map((name) => recordsByName[name]).filter(Boolean);
}

async function addItemToRecentHistoryItems(orgUniqueId: string, recentItemsKey: RecentHistoryItemType, itemNames: string[]) {
  try {
    const key = generateKey(orgUniqueId, recentItemsKey);

    let newOrExistingRecord = await dexieDb.recent_history_item.get(generateKey(orgUniqueId, recentItemsKey));
    if (!newOrExistingRecord) {
      newOrExistingRecord = {
        key,
        hashedKey: await getHashedRecordKey(key),
        org: orgUniqueId,
        items: [],
        updatedAt: new Date(),
        createdAt: new Date(),
      };
    }
    itemNames.forEach((itemName) => {
      newOrExistingRecord.items.unshift({ name: itemName, lastUsed: new Date() });
    });

    await saveRecentHistoryItem(newOrExistingRecord);
  } catch (ex) {
    logger.error('Error adding item to recent history items', ex);
  }
}

async function clearRecentHistoryItemsForCurrentOrg(orgUniqueId: string) {
  try {
    await dexieDb.recent_history_item.where('org').equals(orgUniqueId).delete();
  } catch (ex) {
    logger.error('Error deleting item to recent history items', ex);
  }
}

async function clearRecentHistoryItemsForAllOrgs() {
  try {
    await dexieDb.recent_history_item.clear();
  } catch (ex) {
    logger.error('Error deleting item to recent history items', ex);
  }
}

async function saveRecentHistoryItem(
  recentHistoryItem: Pick<RecentHistoryItem, 'key' | 'items' | 'org'> & Partial<Pick<RecentHistoryItem, 'hashedKey' | 'createdAt'>>
) {
  const items = uniqBy(recentHistoryItem.items, 'name')
    .sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime())
    .slice(0, MAX_ITEM_SIZE);

  const newItem: RecentHistoryItem = {
    ...recentHistoryItem,
    hashedKey: recentHistoryItem.hashedKey || (await getHashedRecordKey(recentHistoryItem.key)),
    items,
    createdAt: recentHistoryItem.createdAt || new Date(),
    updatedAt: new Date(),
  };
  return await dexieDb.recent_history_item.put(newItem);
}
