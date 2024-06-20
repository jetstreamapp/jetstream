import { logger } from '@jetstream/shared/client-logger';
import { INDEXED_DB } from '@jetstream/shared/constants';
import { describeSObject } from '@jetstream/shared/data';
import { groupByFlat, orderObjectsBy, REGEX } from '@jetstream/shared/utils';
import { QueryHistoryItem, QueryHistorySelection, SalesforceOrgUi } from '@jetstream/types';
import { addDays } from 'date-fns/addDays';
import { isBefore } from 'date-fns/isBefore';
import { parseISO } from 'date-fns/parseISO';
import { startOfDay } from 'date-fns/startOfDay';
import localforage from 'localforage';
import isString from 'lodash/isString';
import orderBy from 'lodash/orderBy';
import { atom, selector } from 'recoil';
import * as fromAppState from './app-state';

let didRunCleanup = false;

const defaultSelectedObject: QueryHistorySelection = {
  key: 'all',
  name: 'all',
  label: 'All Objects',
  isTooling: false,
};

export type QueryHistoryType = 'HISTORY' | 'SAVED';
export type WhichOrgType = 'ALL' | 'SELECTED';

/**
 * If query history grows to a very large size,
 * prune older entries
 */
export async function cleanUpHistoryState(): Promise<Record<string, QueryHistoryItem> | undefined> {
  const ITEMS_UNTIL_PRUNE = 750; // require this many items before taking action
  const DAYS_TO_KEEP = 90; // if action is taken, remove items older than this, keep all others
  try {
    if (didRunCleanup) {
      return;
    }
    didRunCleanup = true;
    const history = await initQueryHistory();
    if (Object.keys(history || {}).length > ITEMS_UNTIL_PRUNE) {
      logger.info('[QUERY-HISTORY][CLEANUP]', 'Cleaning up query history');
      const dateCutOff = startOfDay(addDays(new Date(), -1 * DAYS_TO_KEEP));
      const itemsToKeep = groupByFlat(
        Object.values(history).filter((item) => {
          // keep favorites no matter what
          if (item.isFavorite) {
            return true;
          }
          // Remove if older than DAYS_TO_KEEP
          return isBefore(dateCutOff, item.lastRun);
        }),
        'key'
      );

      if (Object.keys(history).length === Object.keys(itemsToKeep).length) {
        logger.info('[QUERY-HISTORY][CLEANUP]', 'No items to cleanup');
        return;
      }

      logger.info('[QUERY-HISTORY][CLEANUP]', 'Keeping items', itemsToKeep);
      await localforage.setItem<Record<string, QueryHistoryItem>>(INDEXED_DB.KEYS.queryHistory, itemsToKeep);
      return itemsToKeep;
    }
  } catch (ex) {
    logger.warn('[QUERY-HISTORY][CLEANUP]', 'Error cleaning up query history', ex);
  }
}

export async function initQueryHistory(): Promise<Record<string, QueryHistoryItem>> {
  try {
    return (await localforage.getItem<Record<string, QueryHistoryItem>>(INDEXED_DB.KEYS.queryHistory)) || {};
  } catch (ex) {
    logger.error('[QUERY-HISTORY][INIT]', 'Error initializing query history', ex);
    return {};
  }
}

// FIXME: there is some really poor naming conventions surrounding the entire query history

/**
 * Get new history item to save
 * If we do not know the label of the object, then we go fetch it
 *
 * @returns an initialized query history item and a fresh copy of the history state from storage
 */
export async function getQueryHistoryItem(
  org: SalesforceOrgUi,
  soql: string,
  sObject: string,
  sObjectLabel?: string,
  isTooling = false
): Promise<{ queryHistoryItem: QueryHistoryItem; refreshedQueryHistory: Record<string, QueryHistoryItem> }> {
  if (!sObjectLabel) {
    const resultsWithCache = await describeSObject(org, sObject, isTooling);
    const results = resultsWithCache.data;
    sObjectLabel = results.name;
  }
  const queryHistoryItem: QueryHistoryItem = {
    key: `${org.uniqueId}:${sObject}${soql.replace(REGEX.NOT_ALPHANUMERIC_OR_UNDERSCORE, '')}`,
    label: sObjectLabel,
    soql,
    org: org.uniqueId,
    runCount: 1,
    sObject,
    lastRun: new Date(),
    created: new Date(),
    isTooling,
    isFavorite: false,
  };
  // ensure we have the most up-to-date version of the query history to avoid overwriting changes made elsewhere
  const refreshedQueryHistory = await initQueryHistory();
  return { queryHistoryItem, refreshedQueryHistory };
}

export const selectedObjectState = atom<string>({
  key: 'queryHistory.queryHistorySelectedObject',
  default: 'all',
});

// selectedOrgState

export const queryHistoryState = atom<Record<string, QueryHistoryItem>>({
  key: 'queryHistory.queryHistoryState',
  default: initQueryHistory(),
  effects: [
    ({ setSelf, onSet }) => {
      onSet((newQueryHistory) => {
        localforage
          .getItem<Record<string, QueryHistoryItem>>(INDEXED_DB.KEYS.queryHistory)
          .then((storedHistory) =>
            localforage.setItem<Record<string, QueryHistoryItem>>(INDEXED_DB.KEYS.queryHistory, { ...storedHistory, ...newQueryHistory })
          )
          .then(() => setSelf(newQueryHistory))
          .catch((ex) => {
            logger.error('[QUERY-HISTORY][SAVE]', 'Error saving query history', ex);
          });
      });
    },
  ],
});

export const queryHistoryWhichType = atom<QueryHistoryType>({
  key: 'queryHistory.queryHistoryWhichType',
  default: 'HISTORY',
});

export const queryHistoryWhichOrg = atom<WhichOrgType>({
  key: 'queryHistory.queryHistoryWhichOrg',
  default: 'SELECTED',
});

/**
 * Returns based on selected org and either all items or saved items
 */
const selectQueryHistoryItems = selector({
  key: 'queryHistory.selectQueryHistoryItems',
  get: ({ get }) => {
    const whichOrg = get(queryHistoryWhichOrg);
    const whichType = get(queryHistoryWhichType);
    const queryHistoryItems = get(queryHistoryState);
    const selectedOrg = get(fromAppState.selectedOrgState);
    if (!selectedOrg || !queryHistoryItems) {
      return [];
    }

    return Object.values(queryHistoryItems).filter((item) => {
      if (whichOrg === 'SELECTED' && item.org !== selectedOrg.uniqueId) {
        return false;
      }
      if (whichType === 'SAVED' && !item.isFavorite) {
        return false;
      }
      return true;
    });
  },
});

export const selectQueryHistoryState = selector({
  key: 'queryHistory.selectQueryHistoryState',
  get: ({ get }) => {
    const queryHistoryItems = get(selectQueryHistoryItems);
    const selectedObject = get(selectedObjectState);
    /** For some reason, locally, all the values were strings for lastRun?!?! */
    return orderBy(
      queryHistoryItems
        .map((item) => ({ ...item, lastRun: isString(item.lastRun) ? parseISO(item.lastRun as any) : item.lastRun }))
        .filter((item) => {
          if (selectedObject === 'all') {
            return true;
          }
          return item.sObject === selectedObject;
        }),
      ['lastRun'],
      ['desc']
    );
  },
});

/**
 * Get list of all objects for org, in order by label
 */
export const selectObjectsList = selector<QueryHistorySelection[]>({
  key: 'queryHistory.selectObjectsList',
  get: ({ get }) => {
    const queryHistoryItems = get(selectQueryHistoryItems);
    const objectList = Object.values(
      queryHistoryItems.reduce((items: Record<string, QueryHistorySelection>, item) => {
        items[item.sObject] = {
          key: item.sObject,
          name: item.sObject,
          label: item.label,
          isTooling: item.isTooling,
        };
        return items;
      }, {})
    );

    return [defaultSelectedObject].concat(orderObjectsBy(objectList, 'label'));
  },
});
