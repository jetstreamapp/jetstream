import { logger } from '@jetstream/shared/client-logger';
import { INDEXED_DB } from '@jetstream/shared/constants';
import { groupByFlat } from '@jetstream/shared/utils';
import { SalesforceApiHistoryItem } from '@jetstream/types';
import { addDays } from 'date-fns/addDays';
import { isBefore } from 'date-fns/isBefore';
import { startOfDay } from 'date-fns/startOfDay';
import localforage from 'localforage';

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
