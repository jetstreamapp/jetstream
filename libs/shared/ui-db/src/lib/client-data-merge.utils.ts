import { ApiHistoryItem, LoadSavedMappingItem, QueryHistoryItem, QueryHistoryObject, RecentHistoryItem } from '@jetstream/types';
import { max as maxDate } from 'date-fns/max';
import { min as minDate } from 'date-fns/min';
import uniqBy from 'lodash/uniqBy';

const RECENT_HISTORY_MAX_ITEMS = 75; // mirrors recent-history-items.db.ts

/**
 * Pure smart-merge helpers used when importing history. Kept free of Dexie/localforage so they can be
 * unit tested in isolation. The merges are designed to be idempotent: re-importing the same file must
 * not inflate counts or flip favorites back.
 */

export function mergeQueryHistory(existing: QueryHistoryItem | undefined, imported: QueryHistoryItem): QueryHistoryItem {
  if (!existing) {
    return { ...imported };
  }
  // Content fields (soql/label/sObject/...) come from whichever record ran most recently.
  const base = imported.lastRun.getTime() >= existing.lastRun.getTime() ? imported : existing;
  return {
    ...base,
    isFavorite: existing.isFavorite || imported.isFavorite,
    runCount: Math.max(existing.runCount ?? 0, imported.runCount ?? 0),
    lastRun: maxDate([existing.lastRun, imported.lastRun]),
    createdAt: minDate([existing.createdAt, imported.createdAt]),
    updatedAt: new Date(),
    customLabel: existing.customLabel ?? imported.customLabel ?? null,
  };
}

export function mergeApiRequestHistory(existing: ApiHistoryItem | undefined, imported: ApiHistoryItem): ApiHistoryItem {
  if (!existing) {
    return { ...imported };
  }
  const base = imported.lastRun.getTime() >= existing.lastRun.getTime() ? imported : existing;
  return {
    ...base,
    isFavorite: existing.isFavorite === 'true' || imported.isFavorite === 'true' ? 'true' : 'false',
    lastRun: maxDate([existing.lastRun, imported.lastRun]),
    createdAt: minDate([existing.createdAt, imported.createdAt]),
    updatedAt: new Date(),
  };
}

export function mergeLoadSavedMapping(existing: LoadSavedMappingItem | undefined, imported: LoadSavedMappingItem): LoadSavedMappingItem {
  if (!existing) {
    return { ...imported };
  }
  const base = imported.updatedAt.getTime() >= existing.updatedAt.getTime() ? imported : existing;
  return {
    ...base,
    createdAt: minDate([existing.createdAt, imported.createdAt]),
    updatedAt: maxDate([existing.updatedAt, imported.updatedAt]),
  };
}

export function mergeRecentHistoryItem(existing: RecentHistoryItem | undefined, imported: RecentHistoryItem): RecentHistoryItem {
  const combinedItems = [...(existing?.items ?? []), ...imported.items];
  // Sort newest-first so uniqBy keeps the most-recently-used entry for each name.
  const items = uniqBy(
    combinedItems.sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()),
    'name',
  ).slice(0, RECENT_HISTORY_MAX_ITEMS);
  return {
    ...(existing ?? imported),
    items,
    createdAt: existing ? minDate([existing.createdAt, imported.createdAt]) : imported.createdAt,
    updatedAt: new Date(),
  };
}

/**
 * Derives the (non-synced) `_query_history_object` lookup row for a query history record. Mirrors
 * `getQueryHistoryObject` in query-history-object.db.ts so the object filter list in the query history
 * modal stays populated after an import.
 */
export function toQueryHistoryObject(item: QueryHistoryItem): QueryHistoryObject {
  return {
    key: `qho_${item.org}:${item.sObject}:${item.isTooling}`.toLowerCase(),
    org: item.org,
    sObject: item.sObject,
    sObjectLabel: item.label,
    isTooling: item.isTooling ? 'true' : 'false',
  };
}
