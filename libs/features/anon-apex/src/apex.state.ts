import { logger } from '@jetstream/shared/client-logger';
import { DATE_FORMATS, INDEXED_DB } from '@jetstream/shared/constants';
import { getLocalStore } from '@jetstream/shared/data';
import { groupByFlat, hashString, pluralizeFromNumber, truncate } from '@jetstream/shared/utils';
import { ApexHistoryItem, SalesforceOrgUi } from '@jetstream/types';
import { selectedOrgState } from '@jetstream/ui/app-state';
import { addDays } from 'date-fns/addDays';
import { formatDate } from 'date-fns/format';
import { isBefore } from 'date-fns/isBefore';
import { startOfDay } from 'date-fns/startOfDay';
import { atom } from 'jotai';
import { atomWithLazy } from 'jotai/utils';
import orderBy from 'lodash/orderBy';

let didRunCleanup = false;

/**
 * If history grows to a very large size,
 * prune older entries
 */
export async function cleanUpHistoryState(): Promise<Record<string, ApexHistoryItem> | undefined> {
  const ITEMS_UNTIL_PRUNE = 100; // require this many items before taking action
  const DAYS_TO_KEEP = 60; // if action is taken, remove items older than this, keep all others
  try {
    if (didRunCleanup) {
      return;
    }
    didRunCleanup = true;
    const history = await initApexHistory();
    if (Object.keys(history).length > ITEMS_UNTIL_PRUNE) {
      logger.info('[APEX-HISTORY][CLEANUP]', 'Cleaning up apex history');
      const dateCutOff = startOfDay(addDays(new Date(), -1 * DAYS_TO_KEEP));
      const itemsToKeep = groupByFlat(
        Object.values(history).filter((item) => isBefore(dateCutOff, item.lastRun)),
        'key',
      );

      if (Object.keys(history).length === Object.keys(itemsToKeep).length) {
        logger.info('[APEX-HISTORY][CLEANUP]', 'No items to cleanup');
        return;
      }

      logger.info('[APEX-HISTORY][CLEANUP]', 'Keeping items', itemsToKeep);
      try {
        await getLocalStore().setItem<Record<string, ApexHistoryItem>>(INDEXED_DB.KEYS.apexHistory, itemsToKeep);
      } catch (ex) {
        logger.warn('[APEX-HISTORY][CLEANUP]', 'Error saving cleaned up apex history', ex);
      }
      return itemsToKeep;
    }
  } catch (ex) {
    logger.warn('[APEX-HISTORY][CLEANUP]', 'Error cleaning up apex history', ex);
  }
}

const initApexHistory = async (): Promise<Record<string, ApexHistoryItem>> => {
  try {
    return (await getLocalStore().getItem<Record<string, ApexHistoryItem>>(INDEXED_DB.KEYS.apexHistory)) || {};
  } catch (ex) {
    logger.error('[APEX-HISTORY][INIT]', 'Error initializing apex history', ex);
    return {};
  }
};

/**
 * Get new history item to save
 * If we do not know the label of the object, then we go fetch it
 */
function getApexHistoryItem(org: SalesforceOrgUi, apex: string): ApexHistoryItem {
  const date = formatDate(new Date(), DATE_FORMATS.YYYY_MM_DD_HH_mm_ss_a);
  const lineCount = apex.split('\n').length;
  const ApexHistoryItem: ApexHistoryItem = {
    key: `${org.uniqueId}:${hashString(apex)}`,
    org: org.uniqueId,
    label: `${date} [${lineCount} ${pluralizeFromNumber('line', lineCount)}] ${truncate(apex.trimLeft(), 50)} ...`,
    apex,
    lastRun: new Date(),
  };
  return ApexHistoryItem;
}

/**
 * Initialize a new item and return a new item using current DB value
 * This ensures that multiple browser tabs opened will not have contention
 *
 * @param org
 * @param apex
 * @returns
 */
export async function initNewApexHistoryItem(org: SalesforceOrgUi, apex: string) {
  const historyItems = await initApexHistory();
  const newItem = getApexHistoryItem(org, apex);
  return { ...historyItems, [newItem.key]: newItem };
}

/**
 * Lazy so the storage read happens on first use (after `ensureLocalStorageReady` has scoped the
 * store to the current user). The browser extension imports this module eagerly, so an eager read
 * would hit the shared un-scoped store while every write lands in the per-user one.
 */
export const apexHistoryState = atomWithLazy<Promise<Record<string, ApexHistoryItem>> | Record<string, ApexHistoryItem>>(initApexHistory);

/**
 * History for the selected org. Unlike query and API history there is no all-orgs view — the apex
 * history picker is a plain select with nowhere to put the toggle.
 */
const selectApexHistoryItems = atom((get) => {
  const apexHistoryItems = get(apexHistoryState) as Record<string, ApexHistoryItem>;
  const selectedOrg = get(selectedOrgState) as SalesforceOrgUi;
  if (!selectedOrg?.uniqueId || !apexHistoryItems) {
    return [];
  }

  return Object.values(apexHistoryItems).filter((item) => item.org === selectedOrg.uniqueId);
});

export const selectApexHistoryState = atom((get) => {
  const apexHistoryItems = get(selectApexHistoryItems);
  return orderBy<ApexHistoryItem>(apexHistoryItems, ['lastRun'], ['desc']);
});
