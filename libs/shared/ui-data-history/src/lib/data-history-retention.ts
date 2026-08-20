import { logger } from '@jetstream/shared/client-logger';
import { DataHistoryItem } from '@jetstream/types';
import { dataHistoryDb } from '@jetstream/ui/db';
import { migrateHistoryEntries } from './data-history-backends';
import { DATA_HISTORY_STALE_IN_PROGRESS_MS } from './data-history-limits';
import { deleteEntryFilesAndRow, getEffectiveSettings, getTierLimits, isEntryLikelyInFlight } from './data-history-state';
import { getHistoryFileStore } from './file-store/file-store-factory';
import { getEntryDirPath } from './file-store/path-utils';

const SWEEP_LOCK_NAME = 'jetstream-data-history-sweep';

/**
 * Retention + reconciliation sweep, run in the background after app init (and after retention
 * settings tighten). Steps:
 *  1) reclassify `in-progress` entries older than 24h as `incomplete` (crash/refresh mid-load)
 *  2) delete unpinned entries older than the retention window
 *  3) enforce the tier's entry-count cap (free plans: 15 most recent), oldest-unpinned-first
 *  4) if total size exceeds the tier's internal backstop, delete unpinned entries oldest-first
 *  5) delete orphaned entry directories that have no matching row (failed writes, crashes)
 *  6) migrate entries stranded on a non-active backend (a tab that missed a backend switch)
 *
 * Pinned entries are exempt from 2-4 (but still count toward usage), and entries that are likely
 * still being written are exempt from 2-4 and 6. Errors are logged and swallowed — a failed sweep
 * never blocks anything. Guarded by a Web Lock so only one tab sweeps.
 *
 * Steps 1-4 and 6 all read the SAME snapshot taken once at the top — see the comment there. Step 5
 * is the exception and must stay on fresh data.
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

  // ONE full read for steps 1-4 and 6 — re-reading the whole table per step is wasted work for a
  // user with a year of history. Steps below track their own deletions against this snapshot
  // instead. Newest-first, to match the ordering the count/size caps expect.
  const snapshot = (await dataHistoryDb.getAllEntries()).sort((entryA, entryB) => entryB.createdAt.getTime() - entryA.createdAt.getTime());
  const deletedKeys = new Set<string>();
  const getLiveEntries = () => snapshot.filter(({ key }) => !deletedKeys.has(key));
  // Only entries that ACTUALLY went away are dropped from the live set — a failed delete (e.g. an
  // entry stamped `directory` whose folder permission lapsed) leaves a row that later steps must
  // still see, or the size backstop under-counts real usage
  const deleteEntry = async (entry: DataHistoryItem) => {
    if (await deleteEntryQuietly(entry)) {
      deletedKeys.add(entry.key);
    }
  };

  // 1) Stranded in-progress entries
  for (const entry of snapshot) {
    if (entry.status === 'in-progress' && entry.startedAt.getTime() < now - DATA_HISTORY_STALE_IN_PROGRESS_MS) {
      await dataHistoryDb.updateEntry(entry.key, { status: 'incomplete' });
    }
  }

  // 2) Age-based pruning
  const cutoff = now - settings.retentionDays * 24 * 60 * 60 * 1000;
  for (const entry of snapshot) {
    if (entry.createdAt.getTime() < cutoff && !entry.pinned && !isEntryLikelyInFlight(entry)) {
      await deleteEntry(entry);
    }
  }

  // 3) Entry-count cap (free tier), oldest-unpinned-first
  (await pruneEntryCountOverage(getLiveEntries())).forEach((key) => deletedKeys.add(key));

  // 4) Size backstop, oldest-unpinned-first
  const tier = getTierLimits();
  const liveEntries = getLiveEntries();
  // Every read of sizeBytes is coerced: this loop's exit condition is a running byte total, so a
  // single non-numeric sizeBytes would make it NaN, make `totalBytes <= maxTotalBytes` permanently
  // false, and delete EVERY unpinned entry — a whole year of history — instead of the oldest few.
  let totalBytes = liveEntries.reduce((total, entry) => total + toByteCount(entry.sizeBytes), 0);
  if (tier && totalBytes > tier.maxTotalBytes) {
    const deletable = liveEntries.filter((entry) => !entry.pinned && !isEntryLikelyInFlight(entry)).reverse();
    for (const entry of deletable) {
      if (totalBytes <= tier.maxTotalBytes) {
        break;
      }
      if (await deleteEntryQuietly(entry)) {
        deletedKeys.add(entry.key);
        totalBytes -= toByteCount(entry.sizeBytes);
      }
    }
  }

  // 5) Orphaned entry directories (rows are written before files, so a dir without a row is
  //    always garbage from a failed/interrupted write — never an entry that is about to appear).
  //    ONLY for browser-managed storage: in user-visible backends (folder/native) a dir without a
  //    row is a legitimate state — e.g. a reconnected folder whose Dexie rows were lost with the
  //    site data, or a folder shared by two devices — and deleting those dirs would permanently
  //    destroy recoverable history ("Restore Entries From Folder" exists for exactly that state).
  const store = await getHistoryFileStore();
  if (!store.capabilities.userVisibleFiles) {
    const dirs = await store.listEntryDirs();
    if (dirs.length > 0) {
      // Deliberately NOT the snapshot: a capture that started while this sweep was running has a row
      // but is absent from the snapshot, and deleting its directory as an "orphan" would destroy it.
      // Keys-only so freshness costs nothing.
      const rowKeys = new Set(await dataHistoryDb.getAllEntryKeys());
      for (const dir of dirs) {
        if (dir.entryKey.startsWith('dh_') && !rowKeys.has(dir.entryKey)) {
          try {
            await store.deleteEntryDir(getEntryDirPath(dir.orgFolder, dir.entryKey));
          } catch (ex) {
            logger.warn('[DATA_HISTORY][SWEEP] Unable to delete orphan dir', dir, ex);
          }
        }
      }
    }
  }

  // 6) Heal entries stranded on a non-active backend — e.g. captured in a long-lived tab that
  //    missed a backend switch, or left behind by an interrupted migration. Skipped while the
  //    configured backend is unavailable (permission-loss OPFS fallback) — migrating entries OUT
  //    of the user's chosen folder because permission lapsed would be wrong.
  try {
    const config = await dataHistoryDb.getBackendConfig();
    // A file-less entry (a capture that crashed before its first write) has no bytes on ANY backend,
    // so its stamp cannot strand it — only entries with files need re-homing. `migrateHistoryEntries`
    // re-reads the table itself, which it must: the steps above deleted rows the snapshot still lists.
    const hasStrandedEntries = getLiveEntries().some((entry) => entry.files.length > 0 && entry.storageBackend !== store.type);
    if (store.type === config.active && hasStrandedEntries) {
      await migrateHistoryEntries({ to: store });
    }
  } catch (ex) {
    logger.warn('[DATA_HISTORY][SWEEP] Unable to reconcile entries onto the active backend', ex);
  }
}

/**
 * Enforce the tier's entry-count cap, oldest-unpinned-first. Also called eagerly after each capture
 * (not just from the init sweep) so free-tier storage never runs far past the cap within a session.
 * Pass `entriesNewestFirst` to reuse a caller's snapshot instead of re-reading the table. Returns
 * the keys it deleted. Never throws.
 */
export async function pruneEntryCountOverage(entriesNewestFirst?: DataHistoryItem[]): Promise<string[]> {
  const deletedKeys: string[] = [];
  try {
    const tier = getTierLimits();
    if (!tier || tier.maxEntries === null) {
      return deletedKeys;
    }
    const entries = entriesNewestFirst ?? (await dataHistoryDb.getEntries({}));
    if (entries.length <= tier.maxEntries) {
      return deletedKeys;
    }
    const deletableOldestFirst = entries.filter((entry) => !entry.pinned && !isEntryLikelyInFlight(entry)).reverse();
    let remaining = entries.length;
    for (const entry of deletableOldestFirst) {
      if (remaining <= tier.maxEntries) {
        break;
      }
      // Count down only on a real deletion — otherwise a backend that cannot delete (lost folder
      // permission) makes this report a cap it did not actually enforce, and the caller's snapshot
      // loses rows that still exist
      if (await deleteEntryQuietly(entry)) {
        deletedKeys.push(entry.key);
        remaining--;
      }
    }
  } catch (ex) {
    logger.warn('[DATA_HISTORY][SWEEP] Unable to enforce entry-count cap', ex);
  }
  return deletedKeys;
}

/** A row's `sizeBytes` as a number that is always safe to accumulate (0 for missing/corrupt values) */
function toByteCount(sizeBytes: number | undefined): number {
  return Number.isFinite(sizeBytes) ? (sizeBytes as number) : 0;
}

/** Delete an entry, reporting whether it actually went away. Never throws. */
async function deleteEntryQuietly(entry: DataHistoryItem): Promise<boolean> {
  try {
    await deleteEntryFilesAndRow(entry);
    return true;
  } catch (ex) {
    logger.warn('[DATA_HISTORY][SWEEP] Unable to delete entry', entry.key, ex);
    return false;
  }
}
