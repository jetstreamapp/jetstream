import type { ApiHistoryItem, QueryHistoryItem, RecentHistoryItem } from '@jetstream/types';
import { max } from 'date-fns/max';
import { min } from 'date-fns/min';
import { SyncableEntity } from '../ui-db';

/** Matches the cap applied when recent items are saved (recent-history-items.db.ts) */
const MAX_RECENT_ITEMS = 75;

function mergeQueryHistory(local: QueryHistoryItem, remote: QueryHistoryItem): QueryHistoryItem {
  const [newest, oldest] = local.lastRun >= remote.lastRun ? [local, remote] : [remote, local];
  return {
    ...newest,
    isFavorite: local.isFavorite || remote.isFavorite,
    customLabel: newest.customLabel ?? oldest.customLabel,
    runCount: Math.max(local.runCount || 0, remote.runCount || 0),
    lastRun: max([local.lastRun, remote.lastRun]),
    createdAt: min([local.createdAt, remote.createdAt]),
  };
}

function mergeApiRequestHistory(local: ApiHistoryItem, remote: ApiHistoryItem): ApiHistoryItem {
  const newest = local.lastRun >= remote.lastRun ? local : remote;
  return {
    ...newest,
    isFavorite: local.isFavorite === 'true' || remote.isFavorite === 'true' ? 'true' : 'false',
    lastRun: max([local.lastRun, remote.lastRun]),
    createdAt: min([local.createdAt, remote.createdAt]),
  };
}

function mergeRecentHistoryItem(local: RecentHistoryItem, remote: RecentHistoryItem): RecentHistoryItem {
  const lastUsedByName = new Map<string, Date>();
  for (const item of [...(local.items || []), ...(remote.items || [])]) {
    // Items written by older builds can be missing a usable date - treat those as least recent
    const name = item?.name;
    const lastUsed = item?.lastUsed instanceof Date ? item.lastUsed : new Date(0);
    if (typeof name !== 'string') {
      continue;
    }
    const existing = lastUsedByName.get(name);
    if (!existing || lastUsed > existing) {
      lastUsedByName.set(name, lastUsed);
    }
  }
  const items = Array.from(lastUsedByName, ([name, lastUsed]) => ({ name, lastUsed }))
    .sort((left, right) => right.lastUsed.getTime() - left.lastUsed.getTime())
    .slice(0, MAX_RECENT_ITEMS);
  return { ...local, items, createdAt: min([local.createdAt, remote.createdAt]) };
}

/**
 * Combine two copies of a record that claim the same edit time but differ in content, so neither
 * device's changes are thrown away.
 *
 * This only happens for history that drifted apart before sync compared records properly - e.g. a
 * query favorited on one device that never reached the others. Both inputs must be normalized
 * (dates as `Date`s). The caller stamps the result with a new edit time.
 */
export function mergeDivergedRecords(
  entity: SyncableEntity,
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
): Record<string, unknown> {
  switch (entity) {
    case 'query_history':
      return mergeQueryHistory(local as unknown as QueryHistoryItem, remote as unknown as QueryHistoryItem) as unknown as Record<
        string,
        unknown
      >;
    case 'api_request_history':
      return mergeApiRequestHistory(local as unknown as ApiHistoryItem, remote as unknown as ApiHistoryItem) as unknown as Record<
        string,
        unknown
      >;
    case 'recent_history_item':
      return mergeRecentHistoryItem(local as unknown as RecentHistoryItem, remote as unknown as RecentHistoryItem) as unknown as Record<
        string,
        unknown
      >;
    case 'load_saved_mapping':
    default:
      // A mapping has no fields that combine meaningfully - keep this device's copy
      return { ...local };
  }
}
