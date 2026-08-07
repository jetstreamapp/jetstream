import { logger } from '@jetstream/shared/client-logger';
import {
  DataHistoryBackendConfig,
  DataHistoryFileRef,
  DataHistoryItem,
  dataHistoryItemSchema,
  DataHistoryStorageBackend,
} from '@jetstream/types';
import { dataHistoryDb } from '@jetstream/ui/db';
import { buildManifestJson } from './data-history-manifest';
import { isEntryLikelyInFlight } from './data-history-state';
import { DirectoryHandleFileStore } from './file-store/directory-handle-file-store';
import {
  getDirectoryPermissionNeeded,
  getFileStoreForBackend,
  getHistoryFileStore,
  invalidateHistoryBackends,
} from './file-store/file-store-factory';
import { HistoryFileStore } from './file-store/file-store.types';
import { FsaDirectoryHandle, isFileSystemAccessSupported, showHistoryDirectoryPicker } from './file-store/fsa-types';
import { DATA_HISTORY_FILE_NAMES, getParentDirPath } from './file-store/path-utils';
import { getUserScopeDir } from './file-store/user-scope';
import { isCanvasApp, isDesktopApp } from './platform';

/**
 * Backend management for Data History storage: connect/disconnect the Chromium user-chosen folder
 * (File System Access API), enable/disable Electron native filesystem storage, migrate entries
 * between backends, and re-index rows from a folder's `manifest.json` files.
 *
 * Migration is INCREMENTAL and interruption-safe: each entry is copied, re-stamped
 * (`storageBackend`), and only then optionally deleted from the source — a partially-migrated
 * history keeps working because every read routes through the entry's own stamp.
 */

const TEXT_ENCODER = new TextEncoder();

export interface DataHistoryBackendStatus {
  /** Configured backend (may differ from `effective` when unavailable, e.g. lost permission) */
  active: DataHistoryStorageBackend;
  /** Backend actually receiving new writes right now */
  effective: DataHistoryStorageBackend;
  /** Folder name of the connected FSA directory (directory backend only) */
  directoryName?: string;
  /** Absolute base path (native backend only) */
  nativePath?: string;
  /** The connected folder needs a user-gesture permission re-grant */
  permissionNeeded: boolean;
  /** Whether this environment can offer the user-chosen-folder backend */
  directorySupported: boolean;
  /** Whether this environment can offer the native-filesystem backend */
  nativeSupported: boolean;
}

export type DataHistoryMigrationProgress = (migrated: number, total: number) => void;

/**
 * Persist a backend-config change and invalidate cached stores here and in other tabs. The ONLY
 * way any code in this module switches backends — persisting the config without the invalidation
 * leaves long-lived tabs writing new history to the previous backend (rows stamped with a backend
 * the bytes do not live on), so the two steps must never be separable.
 */
async function activateBackend(config: DataHistoryBackendConfig): Promise<void> {
  await dataHistoryDb.saveBackendConfig(config);
  invalidateHistoryBackends();
}

export async function getHistoryBackendStatus(): Promise<DataHistoryBackendStatus> {
  const config = await dataHistoryDb.getBackendConfig();
  const effectiveStore = await getHistoryFileStore();
  const nativeSupported = isDesktopApp() && typeof window !== 'undefined' && !!window.electronAPI?.dataHistoryRequest;
  const status: DataHistoryBackendStatus = {
    active: config.active,
    effective: effectiveStore.type,
    permissionNeeded: getDirectoryPermissionNeeded(),
    // Canvas runs in a cross-origin iframe where the picker API exists but is blocked
    directorySupported: !isDesktopApp() && !isCanvasApp() && isFileSystemAccessSupported(),
    nativeSupported,
  };
  if (config.active === 'directory' && config.directoryHandle) {
    status.directoryName = (config.directoryHandle as FsaDirectoryHandle).name;
  }
  if (nativeSupported && window.electronAPI?.getDataHistoryFolder) {
    try {
      status.nativePath = await window.electronAPI.getDataHistoryFolder();
    } catch (ex) {
      logger.warn('[DATA_HISTORY] Unable to read native history folder', ex);
    }
  }
  return status;
}

/**
 * Show the directory picker and ensure a 'readwrite' grant on the chosen folder. Returns null when
 * the user cancels the picker; throws when they refuse the write permission.
 */
async function pickWritableHistoryDirectory(): Promise<FsaDirectoryHandle | null> {
  let handle: FsaDirectoryHandle;
  try {
    handle = await showHistoryDirectoryPicker();
  } catch (ex) {
    if (ex instanceof DOMException && ex.name === 'AbortError') {
      return null;
    }
    throw ex;
  }
  if (
    (await handle.queryPermission({ mode: 'readwrite' })) !== 'granted' &&
    (await handle.requestPermission({ mode: 'readwrite' })) !== 'granted'
  ) {
    throw new Error('Jetstream was not given permission to write to the selected folder');
  }
  return handle;
}

/**
 * Prompt the user for a folder (MUST be called from a user gesture), make it the active backend,
 * and migrate existing entries into it. Returns null when the user cancels the picker.
 */
export async function connectHistoryDirectory(onProgress?: DataHistoryMigrationProgress): Promise<{ migrated: number } | null> {
  const handle = await pickWritableHistoryDirectory();
  if (!handle) {
    return null;
  }
  const store = new DirectoryHandleFileStore(handle, await getUserScopeDir());
  await store.init();
  await activateBackend({ active: 'directory', directoryHandle: handle });
  const migrated = await migrateHistoryEntries({ to: store, onProgress });
  return { migrated };
}

/**
 * Switch back to OPFS. Entries are copied back, but the files in the user's folder are LEFT IN
 * PLACE — they are user-visible files the user may consider theirs.
 */
export async function disconnectHistoryDirectory(onProgress?: DataHistoryMigrationProgress): Promise<{ migrated: number }> {
  const config = await dataHistoryDb.getBackendConfig();
  const opfsStore = await getFileStoreForBackend('opfs');
  const migrated = await migrateHistoryEntries({ to: opfsStore, onProgress });
  // KEEP the folder handle in the config: entries that could not migrate (in-flight captures,
  // per-entry copy failures) stay stamped 'directory' and remain readable ONLY through this
  // handle. The retention sweep migrates stragglers to OPFS later; an unreferenced handle is
  // harmless.
  await activateBackend({ active: 'opfs', directoryHandle: config.directoryHandle });
  return { migrated };
}

/** Re-grant folder permission (MUST be called from a user gesture). Returns true when granted. */
export async function reconnectHistoryDirectory(): Promise<boolean> {
  const config = await dataHistoryDb.getBackendConfig();
  const handle = config.directoryHandle as FsaDirectoryHandle | undefined;
  if (config.active !== 'directory' || !handle) {
    return false;
  }
  const granted = (await handle.requestPermission({ mode: 'readwrite' })) === 'granted';
  if (granted) {
    invalidateHistoryBackends();
  }
  return granted;
}

/**
 * Pick a DIFFERENT folder for an already-connected directory backend. Entries are copied from the
 * old folder (when still readable) into the new one; the old folder's files are left in place.
 * Falls back to a fresh connect when no folder is currently connected. Returns null on cancel.
 */
export async function changeHistoryDirectory(
  onProgress?: DataHistoryMigrationProgress,
): Promise<{ migrated: number; skipped: number } | null> {
  const config = await dataHistoryDb.getBackendConfig();
  const oldHandle = config.active === 'directory' ? (config.directoryHandle as FsaDirectoryHandle | undefined) : undefined;
  if (!oldHandle) {
    const result = await connectHistoryDirectory(onProgress);
    return result && { migrated: result.migrated, skipped: 0 };
  }
  const newHandle = await pickWritableHistoryDirectory();
  if (!newHandle) {
    return null;
  }
  // Both folders are scoped to the SAME user — this is one account moving its own history
  const scopeDir = await getUserScopeDir();
  const newStore = new DirectoryHandleFileStore(newHandle, scopeDir);
  await newStore.init();
  const oldStore = new DirectoryHandleFileStore(oldHandle, scopeDir);
  let oldStoreAvailable = true;
  try {
    await oldStore.init();
  } catch (ex) {
    oldStoreAvailable = false;
    logger.warn('[DATA_HISTORY] Previous history folder is not readable, moving what is possible', ex);
  }

  // PHASE 1: copy folder-resident entries old -> new BEFORE repointing the config. There is only
  // ONE 'directory' slot, so the moment the config repoints, any entry still stamped 'directory'
  // whose files were not copied resolves to the new folder — where they do not exist. Aborting in
  // this phase is always safe (rows, config, and the old folder are untouched), so an unexpected
  // copy failure throws and cancels the whole change instead of stranding entries. Two things
  // cannot be copied and ARE knowingly stranded once the config repoints, reported via `skipped`:
  // entries still being written (their handle keeps writing to the old folder) and entries in an
  // unreadable old folder (blocking the change would hold the user hostage to a folder that may
  // be gone for good).
  const copiedKeys = new Set<string>();
  const runFolderCopyPass = async (): Promise<void> => {
    const folderEntries = (await dataHistoryDb.getAllEntries()).filter((entry) => entry.storageBackend === 'directory');
    for (const entry of folderEntries) {
      if (copiedKeys.has(entry.key)) {
        continue;
      }
      if (isEntryLikelyInFlight(entry) || !oldStoreAvailable) {
        continue;
      }
      if (entry.files.length === 0) {
        // Inline-payload entries have no files to move. This must stay BELOW the in-flight check:
        // a capture's row exists with `files: []` before its first file lands, and marking it
        // "copied" here would let its handle finish writing into the old folder after the repoint —
        // stranding files on a folder the 'directory' stamp no longer resolves to.
        copiedKeys.add(entry.key);
        continue;
      }
      await copyEntryToStore(entry, oldStore, newStore);
      copiedKeys.add(entry.key);
      onProgress?.(copiedKeys.size, folderEntries.length);
    }
  };
  await runFolderCopyPass();
  // Second pass catches entries whose capture finished while the first pass was copying
  await runFolderCopyPass();
  // Anything still stamped 'directory' but not copied is knowingly stranded in the old folder
  // (in-flight captures, unreadable old folder). Counted BEFORE the repoint, while the stamp still
  // unambiguously means the old folder.
  const skipped = (await dataHistoryDb.getAllEntries()).filter(
    (entry) => entry.storageBackend === 'directory' && !copiedKeys.has(entry.key),
  ).length;

  await activateBackend({ active: 'directory', directoryHandle: newHandle });

  // PHASE 2: entries on other backends (OPFS) migrate into the new folder now that it is the
  // active 'directory' target; invisible OPFS sources are cleaned up after copying
  const migratedFromOtherBackends = await migrateHistoryEntries({ to: newStore, onProgress });
  return { migrated: copiedKeys.size + migratedFromOtherBackends, skipped };
}

/** Desktop: store history on the real filesystem (moves existing entries out of OPFS) */
export async function enableNativeHistoryStorage(onProgress?: DataHistoryMigrationProgress): Promise<{ migrated: number }> {
  const store = await getFileStoreForBackend('native');
  await activateBackend({ active: 'native' });
  const migrated = await migrateHistoryEntries({ to: store, onProgress });
  return { migrated };
}

/**
 * Desktop: revert to app-managed (OPFS) storage. Entries are copied back, but the files on disk are
 * LEFT IN PLACE — same policy as `disconnectHistoryDirectory`: these are plain .csv/.json files in a
 * folder the user may have chosen (and may have backed up or referenced elsewhere), so they are
 * theirs to delete. Entries that could not be copied stay stamped 'native' and remain readable
 * through the native backend; the retention sweep migrates those stragglers later.
 */
export async function disableNativeHistoryStorage(onProgress?: DataHistoryMigrationProgress): Promise<{ migrated: number }> {
  const opfsStore = await getFileStoreForBackend('opfs');
  const migrated = await migrateHistoryEntries({ to: opfsStore, onProgress });
  await activateBackend({ active: 'opfs' });
  return { migrated };
}

/**
 * Desktop: move the on-disk history to a different folder. The MAIN process shows the folder
 * picker, moves the directory, and persists the preference — the chosen path never transits the
 * renderer. Entry paths are relative so rows are untouched.
 * Returns the new base path, or null when the user cancels.
 */
export async function changeNativeHistoryFolder(): Promise<string | null> {
  if (!window.electronAPI?.pickDataHistoryFolder) {
    return null;
  }
  return await window.electronAPI.pickDataHistoryFolder();
}

/**
 * Copy every entry not already on `to` into it and re-stamp. Failures skip the entry (it stays
 * fully usable on its previous backend) — never throws.
 *
 * SOURCE-CLEANUP POLICY, enforced here and nowhere else: a copied entry's source files are removed
 * only when they are NOT user-visible (OPFS, whose files the user cannot see and which counts
 * against the browser quota). A user-chosen folder or the native history folder holds plain
 * .csv/.json files the user may have backed up or referenced elsewhere, so a migration copies out of
 * them and leaves them in place — the same policy `disconnectHistoryDirectory` and
 * `disableNativeHistoryStorage` state explicitly.
 */
export async function migrateHistoryEntries({
  to,
  onProgress,
}: {
  to: HistoryFileStore;
  onProgress?: DataHistoryMigrationProgress;
}): Promise<number> {
  // Skip in-flight entries — their handle keeps writing to its original backend, so migrating
  // concurrently would split the entry's files across two backends. `isEntryLikelyInFlight` also
  // covers captures running in ANOTHER tab/document (recent `in-progress` rows), which the local
  // active-handle set cannot see.
  const entries = (await dataHistoryDb.getAllEntries()).filter(
    (entry) => entry.storageBackend !== to.type && !isEntryLikelyInFlight(entry),
  );
  let migrated = 0;
  for (const entry of entries) {
    try {
      if (entry.files.length > 0) {
        const from = await getFileStoreForBackend(entry.storageBackend);
        await copyEntryToStore(entry, from, to);
        if (!from.capabilities.userVisibleFiles) {
          await from.deleteEntryDir(getParentDirPath(entry.files[0].path));
        }
      } else {
        // Inline-only entries have no files — just re-stamp
        await dataHistoryDb.updateEntry(entry.key, { storageBackend: to.type });
      }
      migrated++;
      onProgress?.(migrated, entries.length);
    } catch (ex) {
      logger.warn('[DATA_HISTORY][MIGRATE] Unable to migrate entry, leaving on previous backend', entry.key, ex);
    }
  }
  return migrated;
}

/**
 * Copy one entry's files into `to`, RE-ENCODING to match the target's compression policy —
 * user-visible folders get plain .csv/.json files the user can open directly, while OPFS keeps
 * gzip. Updates the entry row (backend stamp, file refs, size) and writes the manifest.
 */
async function copyEntryToStore(entry: DataHistoryItem, from: HistoryFileStore, to: HistoryFileStore): Promise<void> {
  const targetCompressed = to.capabilities.compressFiles;
  const entryDir = getParentDirPath(entry.files[0].path);
  const updatedFileRefs: DataHistoryFileRef[] = [];
  for (const fileRef of entry.files) {
    if (fileRef.compressed === targetCompressed) {
      // Raw byte-for-byte copy — encoding already matches
      const blob = await from.readFile(fileRef.path, { gunzip: false });
      await to.writeFile(fileRef.path, blob, { gzip: false });
      updatedFileRefs.push(fileRef);
    } else {
      const blob = await from.readFile(fileRef.path, { gunzip: fileRef.compressed });
      const fileName = targetCompressed ? `${fileRef.fileName}.gz` : fileRef.fileName.replace(/\.gz$/, '');
      const path = `${entryDir}/${fileName}`;
      const { bytes } = await to.writeFile(path, blob, { gzip: targetCompressed });
      updatedFileRefs.push({ ...fileRef, fileName, path, compressed: targetCompressed, bytes });
    }
  }
  const sizeBytes = updatedFileRefs.reduce((total, fileRef) => total + fileRef.bytes, 0);
  const updatedEntry: DataHistoryItem = { ...entry, storageBackend: to.type, files: updatedFileRefs, sizeBytes };
  await to.writeFile(`${entryDir}/${DATA_HISTORY_FILE_NAMES.manifest}`, TEXT_ENCODER.encode(buildManifestJson(updatedEntry)), {
    gzip: false,
  });
  await dataHistoryDb.updateEntry(entry.key, { storageBackend: to.type, files: updatedFileRefs, sizeBytes });
}

/**
 * Rebuild missing Dexie rows from the active backend's on-disk `manifest.json` files — recovers
 * history after the user restores/moves a folder or reinstalls. Returns the number of restored rows.
 */
export async function reindexHistoryFromActiveBackend(): Promise<number> {
  const store = await getHistoryFileStore();
  if (!store.capabilities.supportsReindex) {
    return 0;
  }
  const knownKeys = new Set((await dataHistoryDb.getAllEntries()).map(({ key }) => key));
  // Entries the user deleted while their files were unreachable (lost folder permission) must not
  // come back when the folder is re-indexed
  const tombstonedKeys = new Set(await dataHistoryDb.getDeletedEntryTombstones());
  const dirs = await store.listEntryDirs();
  let restored = 0;
  for (const dir of dirs) {
    if (knownKeys.has(dir.entryKey) || tombstonedKeys.has(dir.entryKey) || !dir.entryKey.startsWith('dh_')) {
      continue;
    }
    try {
      const manifestBlob = await store.readFile(`${dir.orgFolder}/${dir.entryKey}/${DATA_HISTORY_FILE_NAMES.manifest}`, { gunzip: false });
      const item = parseManifestToItem(JSON.parse(await manifestBlob.text()), store.type);
      if (item) {
        await dataHistoryDb.saveEntry(item);
        restored++;
      }
    } catch (ex) {
      logger.warn('[DATA_HISTORY][REINDEX] Unable to restore entry from manifest', dir, ex);
    }
  }
  return restored;
}

function parseManifestToItem(manifest: Record<string, unknown>, backend: DataHistoryStorageBackend): DataHistoryItem | null {
  const revived = {
    ...manifest,
    manifestVersion: undefined,
    inlinePayload: null,
    storageBackend: backend,
    startedAt: reviveDate(manifest.startedAt),
    finishedAt: manifest.finishedAt ? reviveDate(manifest.finishedAt) : null,
    createdAt: reviveDate(manifest.createdAt),
    updatedAt: reviveDate(manifest.updatedAt),
  };
  const parsed = dataHistoryItemSchema.safeParse(revived);
  return parsed.success ? parsed.data : null;
}

function reviveDate(value: unknown): Date {
  return typeof value === 'string' || typeof value === 'number' ? new Date(value) : (value as Date);
}
