import { logger } from '@jetstream/shared/client-logger';
import { INDEXED_DB } from '@jetstream/shared/constants';
import { groupByFlat, truncate } from '@jetstream/shared/utils';
import { SalesforceApiHistoryItem, SalesforceApiHistoryRequest, SalesforceApiHistoryResponse, SalesforceOrgUi } from '@jetstream/types';
import { fromAppState, fromQueryHistoryState } from '@jetstream/ui-core';
import { addDays } from 'date-fns/addDays';
import { isBefore } from 'date-fns/isBefore';
import { startOfDay } from 'date-fns/startOfDay';
import localforage from 'localforage';
import orderBy from 'lodash/orderBy';
import { atom, selector } from 'recoil';

let didRunCleanup = false;

/**
 * If history grows to a very large size,
 * prune older entries
 */
export async function cleanUpHistoryState(): Promise<Record<string, SalesforceApiHistoryItem> | undefined> {
  const ITEMS_UNTIL_PRUNE = 100; // require this many items before taking action
  const DAYS_TO_KEEP = 60; // if action is taken, remove items older than this, keep all others
  try {
    if (didRunCleanup) {
      return;
    }
    didRunCleanup = true;
    const history = await initSalesforceApiHistory();
    if (Object.keys(history).length > ITEMS_UNTIL_PRUNE) {
      logger.info('[API-HISTORY][CLEANUP]', 'Cleaning up api history');
      const dateCutOff = startOfDay(addDays(new Date(), -1 * DAYS_TO_KEEP));
      const itemsToKeep = groupByFlat(
        Object.values(history).filter((item) => isBefore(dateCutOff, item.lastRun)),
        'key'
      );

      if (Object.keys(history).length === Object.keys(itemsToKeep).length) {
        logger.info('[API-HISTORY][CLEANUP]', 'No items to cleanup');
        return;
      }

      logger.info('[API-HISTORY][CLEANUP]', 'Keeping items', itemsToKeep);
      await localforage.setItem<Record<string, SalesforceApiHistoryItem>>(INDEXED_DB.KEYS.salesforceApiHistory, itemsToKeep);
      return itemsToKeep;
    }
  } catch (ex) {
    logger.warn('[API-HISTORY][CLEANUP]', 'Error cleaning up api history', ex);
  }
}

async function initSalesforceApiHistory(): Promise<Record<string, SalesforceApiHistoryItem>> {
  try {
    return (await localforage.getItem<Record<string, SalesforceApiHistoryItem>>(INDEXED_DB.KEYS.salesforceApiHistory)) || {};
  } catch (ex) {
    logger.error('Error getting salesforceApiHistory from localforage', ex);
    return {};
  }
}

/**
 * Get new history item to save
 * If we do not know the label of the object, then we go fetch it
 */
function getSalesforceApiHistoryItem(
  org: SalesforceOrgUi,
  request: SalesforceApiHistoryRequest,
  response?: SalesforceApiHistoryResponse
): SalesforceApiHistoryItem {
  const SalesforceApiHistoryItem: SalesforceApiHistoryItem = {
    key: `${org.uniqueId}:${request.method}:${request.url}`,
    org: org.uniqueId,
    label: `${request.method}: ${truncate(request.url, 50)}`,
    request,
    response,
    lastRun: new Date(),
  };
  return SalesforceApiHistoryItem;
}

/**
 * Initialize a new item and return a new item using current DB value
 * This ensures that multiple browser tabs opened will not have contention
 *
 * @param org
 * @param request
 * @param response
 * @returns
 */
export async function initSalesforceApiHistoryItem(
  org: SalesforceOrgUi,
  request: SalesforceApiHistoryRequest,
  response?: SalesforceApiHistoryResponse
) {
  const historyItems = await initSalesforceApiHistory();
  const newItem = getSalesforceApiHistoryItem(org, request, response);
  return { ...historyItems, [newItem.key]: newItem };
}

export const salesforceApiHistoryState = atom<Record<string, SalesforceApiHistoryItem>>({
  key: 'salesforceApiHistory.salesforceApiHistoryState',
  default: initSalesforceApiHistory(),
});

export const salesforceApiHistoryWhichOrg = atom<fromQueryHistoryState.WhichOrgType>({
  key: 'salesforceApiHistory.salesforceApiHistoryWhichOrg',
  default: 'SELECTED',
});

/**
 * Returns based on selected org and either all items or saved items
 */
const selectSalesforceApiHistoryItems = selector({
  key: 'salesforceApiHistory.selectSalesforceApiHistoryItems',
  get: ({ get }) => {
    const whichOrg = get(salesforceApiHistoryWhichOrg);
    const salesforceApiHistoryItems = get(salesforceApiHistoryState);
    const selectedOrg = get(fromAppState.selectedOrgState);
    if (!selectedOrg || !salesforceApiHistoryItems) {
      return [];
    }

    return Object.values(salesforceApiHistoryItems).filter((item) => {
      if (whichOrg === 'SELECTED' && item.org !== selectedOrg.uniqueId) {
        return false;
      }
      return true;
    });
  },
});

export const selectSalesforceApiHistoryState = selector({
  key: 'salesforceApiHistory.selectSalesforceApiHistoryState',
  get: ({ get }) => {
    const salesforceApiHistoryItems = get(selectSalesforceApiHistoryItems);
    return orderBy<SalesforceApiHistoryItem>(salesforceApiHistoryItems, ['lastRun'], ['desc']);
  },
});
