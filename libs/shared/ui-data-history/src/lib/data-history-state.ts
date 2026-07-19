import { DataHistoryCounts, DataHistoryItem, DataHistorySettings, DataHistoryStatus } from '@jetstream/types';
import { dataHistoryDb } from '@jetstream/ui/db';
import { clampSettingsToTier, DataHistoryTierLimits, getDefaultDataHistorySettings } from './data-history-limits';
import { getFileStoreForBackend } from './file-store/file-store-factory';
import { getParentDirPath } from './file-store/path-utils';

/**
 * Internal module state shared by the capture service and the retention sweep. Kept separate from
 * the service to avoid an import cycle (service -> retention -> state).
 */

let tierLimits: DataHistoryTierLimits | null = null;
let persistRequested = false;

export function setTierLimits(limits: DataHistoryTierLimits): void {
  tierLimits = limits;
}

/** Null until `initDataHistory` has run — all capture is disabled before initialization */
export function getTierLimits(): DataHistoryTierLimits | null {
  return tierLimits;
}

export async function getEffectiveSettings(): Promise<DataHistorySettings | null> {
  if (!tierLimits) {
    return null;
  }
  const settings = await dataHistoryDb.getSettings(getDefaultDataHistorySettings(tierLimits));
  return clampSettingsToTier(settings, tierLimits);
}

/**
 * Ask the browser to protect this origin's storage from automatic eviction. Requested once per
 * session, on first history write (per plan decision — not at app boot).
 */
export async function requestPersistOnce(): Promise<void> {
  if (persistRequested) {
    return;
  }
  persistRequested = true;
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      await navigator.storage.persist();
    }
  } catch {
    // unsupported or denied — history still works, just evictable
  }
}

export function deriveStatusFromCounts(counts: DataHistoryCounts): DataHistoryStatus {
  if (counts.failure === 0) {
    return 'success';
  }
  return counts.success > 0 ? 'partial' : 'failed';
}

/**
 * Delete an entry's files (routed to the backend stamped on the entry) and then its row. File
 * deletion happens first so a failure leaves a visible row rather than silent orphan files.
 */
export async function deleteEntryFilesAndRow(item: DataHistoryItem): Promise<void> {
  if (item.files.length > 0) {
    const store = await getFileStoreForBackend(item.storageBackend);
    await store.deleteEntryDir(getParentDirPath(item.files[0].path));
  }
  await dataHistoryDb.deleteEntries([item.key]);
}
