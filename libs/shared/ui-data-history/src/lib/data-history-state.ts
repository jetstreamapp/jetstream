import { DataHistoryCounts, DataHistoryItem, DataHistorySettings, DataHistoryStatus } from '@jetstream/types';
import { dataHistoryDb } from '@jetstream/ui/db';
import { clampSettingsToTier, DataHistoryTierLimits, getDefaultDataHistorySettings } from './data-history-limits';
import { getFileStoreForBackend } from './file-store/file-store-factory';
import { getParentDirPath } from './file-store/path-utils';
import { isBrowserExtensionApp, isCanvasApp, isDesktopApp } from './platform';

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
 * Firefox shows an intrusive permission doorhanger the moment `persist()` is called, so we never
 * auto-request there — persistence is offered through the explicit "keep my history" button (a user
 * gesture) instead. Chromium grants/denies silently and Safari returns false without prompting, so
 * the silent auto-request below is safe on those.
 */
function browserPromptsForPersist(): boolean {
  return typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent);
}

/**
 * Silently ask the browser to protect this origin's storage from automatic eviction — best-effort,
 * requested once per session. Skipped on browsers that would prompt (see `browserPromptsForPersist`);
 * those users opt in via `requestPersistentStorage` from a button.
 */
export async function requestPersistOnce(): Promise<void> {
  if (persistRequested || browserPromptsForPersist()) {
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

/** Current persisted-storage state, or null when the browser does not expose the Storage API. */
export async function getStoragePersisted(): Promise<boolean | null> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persisted) {
      return await navigator.storage.persisted();
    }
  } catch {
    // unsupported
  }
  return null;
}

/**
 * Explicitly ask the browser to protect this origin's storage from eviction, returning the resulting
 * persisted state. MUST be called from a user gesture — Safari and Firefox only grant (or prompt
 * for) persistence in response to one. Safe to call when already granted.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  persistRequested = true;
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      return await navigator.storage.persist();
    }
  } catch {
    // unsupported or denied
  }
  return false;
}

/**
 * Whether to offer the user a "keep my history" persistence prompt. Only the web app benefits:
 * desktop uses the durable native filesystem, the browser extension's origin storage is already
 * persistent, and the canvas iframe cannot persist. Also requires Storage API support.
 */
export function isPersistentStoragePromptEligible(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.storage?.persist && !isDesktopApp() && !isBrowserExtensionApp() && !isCanvasApp();
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
