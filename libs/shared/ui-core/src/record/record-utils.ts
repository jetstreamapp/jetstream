import { logger } from '@jetstream/shared/client-logger';
import { INDEXED_DB } from '@jetstream/shared/constants';
import { getLocalStore } from '@jetstream/shared/data';
import { REGEX } from '@jetstream/shared/utils';
import { composeQuery, getField, WhereClause } from '@jetstreamapp/soql-parser-js';
import uniqBy from 'lodash/uniqBy';

type RecentRecordStorageMap = Record<string, RecentRecord[]>;
export interface RecentRecord {
  recordId: string;
  sobject: string;
  name?: string;
}

const NUM_HISTORY_ITEMS = 25;
let recentItemsMapCache: RecentRecordStorageMap | null = null;
/**
 * The store the cached map was read from. Each user gets a distinct store instance, so comparing
 * identity invalidates the cache on an account switch that happens without a reload. Without this
 * the previous user's records would be served — and written back into the new user's store, since
 * the callers below mutate this map and persist it wholesale.
 */
let cachedForStore: ReturnType<typeof getLocalStore> | null = null;

/**
 * Recent records are a convenience, never load-bearing, so every access here is best effort:
 * a storage failure (including reading before a user is scoped) degrades to an empty list.
 */
function persistRecentRecords(recentItems: RecentRecordStorageMap) {
  try {
    getLocalStore()
      .setItem<RecentRecordStorageMap>(INDEXED_DB.KEYS.recentRecords, recentItems)
      .catch((err) => {
        logger.warn('[ERROR] Could not save recent record history', err);
      });
  } catch (err) {
    logger.warn('[ERROR] Could not save recent record history', err);
  }
}

export async function getRecentRecordsFromStorage(): Promise<RecentRecordStorageMap> {
  let localStore: ReturnType<typeof getLocalStore>;
  try {
    localStore = getLocalStore();
  } catch {
    // No user is scoped (logged out, or the store failed to initialize) — drop the cache instead of
    // handing back whatever the last scoped user left in memory.
    recentItemsMapCache = null;
    cachedForStore = null;
    return {};
  }

  if (cachedForStore !== localStore) {
    recentItemsMapCache = null;
    cachedForStore = localStore;
  }
  if (recentItemsMapCache) {
    return recentItemsMapCache;
  }

  try {
    recentItemsMapCache = await localStore.getItem<RecentRecordStorageMap>(INDEXED_DB.KEYS.recentRecords);
  } catch (err) {
    logger.warn('[ERROR] Could not read recent record history', err);
  }
  return recentItemsMapCache || {};
}

export async function addRecentRecordToStorage(record: RecentRecord, orgUniqueId: string) {
  if (!record.recordId || !record?.sobject) {
    return getRecentRecordsFromStorage().then((recentItems) => recentItems[orgUniqueId] || []);
  }
  const { recordId, sobject, name } = record;

  const recentItems = await getRecentRecordsFromStorage();

  recentItems[orgUniqueId] = recentItems[orgUniqueId] || [];
  const existingItem = recentItems[orgUniqueId].find((item) => item.recordId === recordId);
  recentItems[orgUniqueId].unshift({ recordId, sobject, name: name || existingItem?.name });
  recentItems[orgUniqueId] = uniqBy(recentItems[orgUniqueId], 'recordId').slice(0, NUM_HISTORY_ITEMS);

  persistRecentRecords(recentItems);

  return recentItems[orgUniqueId];
}

export async function updateRecentRecordItem(recordId: string, record: Partial<RecentRecord>, orgUniqueId: string) {
  if (!recordId) {
    return getRecentRecordsFromStorage().then((recentItems) => recentItems[orgUniqueId] || []);
  }

  const recentItems = await getRecentRecordsFromStorage();

  recentItems[orgUniqueId] = recentItems[orgUniqueId] || [];
  recentItems[orgUniqueId] = recentItems[orgUniqueId].map((item) => (item.recordId !== recordId ? item : { ...item, ...record }));

  persistRecentRecords(recentItems);

  return recentItems[orgUniqueId];
}

export async function removeRecentRecordItem(recordId: string, orgUniqueId: string) {
  if (!recordId) {
    return getRecentRecordsFromStorage().then((recentItems) => recentItems[orgUniqueId] || []);
  }

  const recentItems = await getRecentRecordsFromStorage();

  recentItems[orgUniqueId] = recentItems[orgUniqueId] || [];
  recentItems[orgUniqueId] = recentItems[orgUniqueId].filter((item) => item.recordId !== recordId);

  persistRecentRecords(recentItems);

  return recentItems[orgUniqueId];
}

export function getSearchUserSoql(value: string) {
  let whereClause: WhereClause = {
    left: {
      field: 'Name',
      operator: 'LIKE',
      value: `%${value}%`,
      literalType: 'STRING',
    },
    operator: 'OR',
    right: {
      left: {
        field: 'Email',
        operator: 'LIKE',
        value: `%${value}%`,
        literalType: 'STRING',
      },
      operator: 'OR',
      right: {
        left: {
          field: 'Username',
          operator: 'LIKE',
          value: `%${value}%`,
          literalType: 'STRING',
        },
      },
    },
  };

  if (REGEX.SFDC_ID.test(value)) {
    whereClause = {
      left: {
        field: 'Id',
        operator: '=',
        value,
        literalType: 'STRING',
      },
      operator: 'OR',
      right: whereClause,
    };
  }

  const soql = composeQuery({
    fields: [
      getField('Id'),
      getField('Name'),
      getField('Alias'),
      getField('FORMAT(CreatedDate)'),
      getField('Email'),
      getField('IsActive'),
      getField('Profile.Id'),
      getField('Profile.Name'),
      getField('Username'),
      getField('UserRole.Id'),
      getField('UserRole.Name'),
      getField('UserType'),
    ],
    sObject: 'User',
    where: value ? whereClause : undefined,
    orderBy: [{ field: 'Name' }],
    limit: 50,
  });

  return soql;
}
