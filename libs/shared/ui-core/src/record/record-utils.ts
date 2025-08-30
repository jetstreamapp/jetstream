import { logger } from '@jetstream/shared/client-logger';
import { INDEXED_DB } from '@jetstream/shared/constants';
import { REGEX } from '@jetstream/shared/utils';
import { composeQuery, getField, WhereClause } from '@jetstreamapp/soql-parser-js';
import localforage from 'localforage';
import uniqBy from 'lodash/uniqBy';

type RecentRecordStorageMap = Record<string, RecentRecord[]>;
export interface RecentRecord {
  recordId: string;
  sobject: string;
  name?: string;
}

const NUM_HISTORY_ITEMS = 25;
let recentItemsMapCache: RecentRecordStorageMap | null = null;

export async function getRecentRecordsFromStorage() {
  try {
    if (recentItemsMapCache) {
      return recentItemsMapCache;
    }
    recentItemsMapCache = await localforage.getItem<RecentRecordStorageMap>(INDEXED_DB.KEYS.userPreferences);
    return recentItemsMapCache || {};
  } catch (ex) {
    return recentItemsMapCache || {};
  }
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

  localforage.setItem<RecentRecordStorageMap>(INDEXED_DB.KEYS.userPreferences, recentItems).catch((err) => {
    logger.warn('[ERROR] Could not save recent record history', err);
  });

  return recentItems[orgUniqueId];
}

export async function updateRecentRecordItem(recordId: string, record: Partial<RecentRecord>, orgUniqueId: string) {
  if (!recordId) {
    return getRecentRecordsFromStorage().then((recentItems) => recentItems[orgUniqueId] || []);
  }

  const recentItems = await getRecentRecordsFromStorage();

  recentItems[orgUniqueId] = recentItems[orgUniqueId] || [];
  recentItems[orgUniqueId] = recentItems[orgUniqueId].map((item) => (item.recordId !== recordId ? item : { ...item, ...record }));

  localforage.setItem<RecentRecordStorageMap>(INDEXED_DB.KEYS.userPreferences, recentItems).catch((err) => {
    logger.warn('[ERROR] Could not save recent record history', err);
  });

  return recentItems[orgUniqueId];
}

export async function removeRecentRecordItem(recordId: string, orgUniqueId: string) {
  if (!recordId) {
    return getRecentRecordsFromStorage().then((recentItems) => recentItems[orgUniqueId] || []);
  }

  const recentItems = await getRecentRecordsFromStorage();

  recentItems[orgUniqueId] = recentItems[orgUniqueId] || [];
  recentItems[orgUniqueId] = recentItems[orgUniqueId].filter((item) => item.recordId !== recordId);

  localforage.setItem<RecentRecordStorageMap>(INDEXED_DB.KEYS.userPreferences, recentItems).catch((err) => {
    logger.warn('[ERROR] Could not save recent record history', err);
  });

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
