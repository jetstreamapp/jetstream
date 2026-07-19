import { logger } from '@jetstream/shared/client-logger';
import { dataHistoryDb } from '@jetstream/ui/db';
import { DATA_HISTORY_STALE_IN_PROGRESS_MS } from './data-history-limits';
import { deleteEntryFilesAndRow, getEffectiveSettings } from './data-history-state';
import { getHistoryFileStore } from './file-store/file-store-factory';
import { getEntryDirPath } from './file-store/path-utils';

const SWEEP_LOCK_NAME = 'jetstream-data-history-sweep';

/**
 * Retention + reconciliation sweep, run in the background after app init (and after retention
 * settings tighten). Steps:
 *  1) reclassify `in-progress` entries older than 24h as `incomplete` (crash/refresh mid-load)
 *  2) delete unpinned entries older than the retention window
 *  3) if total size exceeds the cap, delete unpinned entries oldest-first until under it
 *  4) delete orphaned entry directories that have no matching row (failed writes, crashes)
 *
 * Pinned entries are exempt from 2 and 3 (but still count toward usage). Errors are logged and
 * swallowed — a failed sweep never blocks anything. Guarded by a Web Lock so only one tab sweeps.
 */
export async function runDataHistoryRetentionSweep(): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && navigator.locks?.request) {
      await navigator.locks.request(SWEEP_LOCK_NAME, { ifAvailable: true }, async (lock) => {
        if (lock) {
          await sweep();
        }
      });
    } else {
      await sweep();
    }
  } catch (ex) {
    logger.warn('[DATA_HISTORY][SWEEP] Retention sweep failed', ex);
  }
}

async function sweep(): Promise<void> {
  const settings = await getEffectiveSettings();
  if (!settings) {
    return;
  }
  const now = Date.now();

  // 1) Stranded in-progress entries
  const inProgress = await dataHistoryDb.getEntries({ status: 'in-progress' });
  for (const entry of inProgress) {
    if (entry.startedAt.getTime() < now - DATA_HISTORY_STALE_IN_PROGRESS_MS) {
      await dataHistoryDb.updateEntry(entry.key, { status: 'incomplete' });
    }
  }

  // 2) Age-based pruning
  const cutoff = new Date(now - settings.retentionDays * 24 * 60 * 60 * 1000);
  const expired = await dataHistoryDb.getEntries({ createdBefore: cutoff });
  for (const entry of expired) {
    if (!entry.pinned) {
      await deleteEntryQuietly(entry.key);
    }
  }

  // 3) Size-based pruning, oldest first
  let totalBytes = await dataHistoryDb.getTotalSizeBytes();
  if (totalBytes > settings.maxTotalBytes) {
    const allEntriesNewestFirst = await dataHistoryDb.getEntries({});
    const deletable = allEntriesNewestFirst.filter((entry) => !entry.pinned).reverse();
    for (const entry of deletable) {
      if (totalBytes <= settings.maxTotalBytes) {
        break;
      }
      await deleteEntryQuietly(entry.key);
      totalBytes -= entry.sizeBytes;
    }
  }

  // 4) Orphaned entry directories (rows are written before files, so a dir without a row is
  //    always garbage from a failed/interrupted write — never an entry that is about to appear)
  const store = await getHistoryFileStore();
  const dirs = await store.listEntryDirs();
  if (dirs.length > 0) {
    const rowKeys = new Set((await dataHistoryDb.getAllEntries()).map(({ key }) => key));
    for (const dir of dirs) {
      if (!rowKeys.has(dir.entryKey)) {
        try {
          await store.deleteEntryDir(getEntryDirPath(dir.orgFolder, dir.entryKey));
        } catch (ex) {
          logger.warn('[DATA_HISTORY][SWEEP] Unable to delete orphan dir', dir, ex);
        }
      }
    }
  }
}

async function deleteEntryQuietly(key: string): Promise<void> {
  try {
    const entry = await dataHistoryDb.getEntry(key);
    if (!entry) {
      return;
    }
    await deleteEntryFilesAndRow(entry);
  } catch (ex) {
    logger.warn('[DATA_HISTORY][SWEEP] Unable to delete entry', key, ex);
  }
}
