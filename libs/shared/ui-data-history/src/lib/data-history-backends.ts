import { logger } from '@jetstream/shared/client-logger';
import { getErrorMessage } from '@jetstream/shared/utils';
import {
  DataHistoryBackendConfig,
  DataHistoryFileRef,
  DataHistoryItem,
  dataHistoryItemSchema,
  DataHistoryStorageBackend,
  Maybe,
} from '@jetstream/types';
import { dataHistoryDb } from '@jetstream/ui/db';
import { buildManifestJson, DATA_HISTORY_MANIFEST_VERSION } from './data-history-manifest';
import { isEntryLikelyInFlight } from './data-history-state';
import { DirectoryHandleFileStore } from './file-store/directory-handle-file-store';
import {
  getDirectoryPermissionNeeded,
  getFileStoreForBackend,
  getHistoryFileStore,
  invalidateHistoryBackends,
} from './file-store/file-store-factory';
import { HistoryFileStore } from './file-store/file-store.types';
import {
  asDirectoryHandle,
  DataHistoryDirectoryPermissionError,
  FsaDirectoryHandle,
  isFileSystemAccessSupported,
  showHistoryDirectoryPicker,
} from './file-store/fsa-types';
import { DATA_HISTORY_FILE_NAMES, getEntryDirPath, getParentDirPath } from './file-store/path-utils';
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
  /**
   * The configured folder could not be opened for a reason a permission re-grant cannot fix — it was
   * deleted or renamed, or (desktop) sits on a drive that is not mounted. New writes have fallen back
   * to browser storage and only picking a folder again or switching back ends that, so the UI must
   * say so; nothing heals it in the background (the sweep only reconciles onto an available backend).
   */
  folderUnavailable: boolean;
  /** Whether this environment can offer the user-chosen-folder backend */
  directorySupported: boolean;
  /** Whether this environment can offer the native-filesystem backend */
  nativeSupported: boolean;
}

/**
 * The three-way "where do my history files live" answer, as rendered to the user.
 */
export type DataHistoryStorageLocationInfo = { kind: 'directory'; name: string } | { kind: 'native'; path?: string } | { kind: 'browser' };

/**
 * Where history files are ACTUALLY landing right now — `status.effective`, rendered. Every surface
 * that tells the user where their data goes must render from this, so two of them can never give
 * contradictory answers.
 *
 * `effective` is the resolved store's type, and the factory falls back to browser storage whenever
 * the configured folder cannot be opened — lost permission, a deleted folder, an unmounted drive —
 * so every one of those states reads as `browser` here without this function re-deriving any of it.
 *
 * Keying a "which button do I offer" decision on the CONFIGURED backend (`status.active`) is a
 * separate, legitimate question — do not fold that into this.
 */
export function getDataHistoryStorageLocation(status: Maybe<DataHistoryBackendStatus>): DataHistoryStorageLocationInfo {
  if (status?.effective === 'native') {
    return { kind: 'native', path: status.nativePath };
  }
  // `effective` can only be 'directory' when the persisted handle resolved, which is exactly when
  // `getHistoryBackendStatus` was able to set `directoryName`
  if (status?.effective === 'directory' && status.directoryName) {
    return { kind: 'directory', name: status.directoryName };
  }
  return { kind: 'browser' };
}

export type DataHistoryMigrationProgress = (migrated: number, total: number) => void;

/**
 * Outcome of moving entries onto a backend. `skipped` entries stay exactly where they were — fully
 * usable through their previous backend — and are reported so the UI can say "N could not be moved"
 * instead of claiming everything moved.
 */
export interface DataHistoryMigrationResult {
  migrated: number;
  skipped: number;
}

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
  const permissionNeeded = getDirectoryPermissionNeeded();
  const status: DataHistoryBackendStatus = {
    active: config.active,
    effective: effectiveStore.type,
    permissionNeeded,
    folderUnavailable: config.active !== 'opfs' && effectiveStore.type === 'opfs' && !permissionNeeded,
    // Canvas runs in a cross-origin iframe where the picker API exists but is blocked
    directorySupported: !isDesktopApp() && !isCanvasApp() && isFileSystemAccessSupported(),
    nativeSupported,
  };
  const configuredHandle = asDirectoryHandle(config.directoryHandle);
  if (config.active === 'directory' && configuredHandle) {
    status.directoryName = configuredHandle.name;
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
 * Ensure a 'readwrite' grant on a folder handle, prompting when it is not already granted. MUST be
 * called from a user gesture — the prompt is refused otherwise. Chromium resets a persisted handle's
 * permission to 'prompt' at the start of most sessions, so for a previously connected folder this is
 * the COMMON state, not an edge case: every flow that reads from or writes to a connected folder
 * inside a click goes through this first.
 */
async function ensureReadWritePermission(handle: FsaDirectoryHandle): Promise<boolean> {
  return (
    (await handle.queryPermission({ mode: 'readwrite' })) === 'granted' ||
    (await handle.requestPermission({ mode: 'readwrite' })) === 'granted'
  );
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
  if (!(await ensureReadWritePermission(handle))) {
    throw new Error('Jetstream was not given permission to write to the selected folder');
  }
  return handle;
}

/**
 * Prompt the user for a folder (MUST be called from a user gesture), make it the active backend, and
 * move every entry into it. Serves both "Store History in a Folder" and "Change Folder" — the two
 * differ only in whether a folder is currently active, and the work is the same either way. Returns
 * null when the user cancels the picker.
 *
 * Any PREVIOUSLY connected folder is handled first, whether it is still the active backend or was
 * disconnected earlier: there is only ONE 'directory' slot, so the moment the config repoints to the
 * new folder, every entry still stamped 'directory' resolves there — and an entry whose files were
 * not copied across is permanently unreadable (its stamp equals the active backend, so the sweep's
 * reconcile step cannot tell it is stranded). Copying old -> new BEFORE the repoint is what keeps
 * that from happening; see `copyEntriesFromPreviousFolder` for what it can and cannot rescue.
 */
export async function connectHistoryDirectory(onProgress?: DataHistoryMigrationProgress): Promise<DataHistoryMigrationResult | null> {
  const config = await dataHistoryDb.getBackendConfig();
  // Retained after a disconnect as well as while active — see `disconnectHistoryDirectory`
  const previousHandle = asDirectoryHandle(config.directoryHandle);
  const newHandle = await pickWritableHistoryDirectory();
  if (!newHandle) {
    return null;
  }
  // Both folders are scoped to the SAME user — this is one account moving its own history
  const scopeDir = await getUserScopeDir();
  const newStore = new DirectoryHandleFileStore(newHandle, scopeDir);
  await newStore.init();

  let copiedFromPreviousFolder = 0;
  let skippedInPreviousFolder = 0;
  if (previousHandle) {
    const previousStore = new DirectoryHandleFileStore(previousHandle, scopeDir);
    ({ copied: copiedFromPreviousFolder, skipped: skippedInPreviousFolder } = await copyEntriesFromPreviousFolder(
      previousHandle,
      previousStore,
      newStore,
      onProgress,
    ));
  }

  await activateBackend({ active: 'directory', directoryHandle: newHandle });

  // Entries on other backends (OPFS) migrate into the new folder now that it is the active
  // 'directory' target; invisible OPFS sources are cleaned up after copying
  const { migrated, skipped } = await migrateHistoryEntries({ to: newStore, onProgress });
  return { migrated: copiedFromPreviousFolder + migrated, skipped: skippedInPreviousFolder + skipped };
}

/**
 * Copy every folder-resident entry from a previously connected folder into the new one. Runs BEFORE
 * the config repoints (see `connectHistoryDirectory`), which is what makes skipping safe: rows, the
 * config, and the previous folder are untouched, so an entry that could not be copied is still fully
 * readable through the previous handle until the repoint — and is reported in `skipped` so the user
 * is told. Three things are knowingly left behind: entries still being written (their handle keeps
 * writing to the previous folder), a previous folder that cannot be opened (blocking the change
 * would hold the user hostage to a folder that may be gone for good), and an entry whose own files
 * cannot be read (the user deleting one entry's folder by hand is an allowed state in a user-visible
 * backend, and must not make every future folder change impossible).
 */
async function copyEntriesFromPreviousFolder(
  previousHandle: FsaDirectoryHandle,
  previousStore: DirectoryHandleFileStore,
  newStore: DirectoryHandleFileStore,
  onProgress?: DataHistoryMigrationProgress,
): Promise<{ copied: number; skipped: number }> {
  let previousStoreAvailable = true;
  try {
    if (!(await ensureReadWritePermission(previousHandle))) {
      throw new DataHistoryDirectoryPermissionError();
    }
    await previousStore.init();
  } catch (ex) {
    previousStoreAvailable = false;
    logger.warn('[DATA_HISTORY] Previous history folder is not readable, moving what is possible', ex);
  }

  const copiedKeys = new Set<string>();
  const failedKeys = new Set<string>();
  const runFolderCopyPass = async (): Promise<void> => {
    const folderEntries = (await dataHistoryDb.getAllEntries()).filter((entry) => entry.storageBackend === 'directory');
    for (const entry of folderEntries) {
      if (copiedKeys.has(entry.key) || failedKeys.has(entry.key) || isEntryLikelyInFlight(entry)) {
        continue;
      }
      if (entry.files.length === 0) {
        // Nothing on disk to move (so an unreadable previous folder is irrelevant to it). Reachable
        // only for a capture that crashed before its first file landed (the sweep later reclassifies
        // those as `incomplete`); live captures were already skipped by the in-flight check above,
        // which is why this must stay BELOW it.
        copiedKeys.add(entry.key);
        continue;
      }
      if (!previousStoreAvailable) {
        continue;
      }
      try {
        await copyEntryToStore(entry, previousStore, newStore);
        copiedKeys.add(entry.key);
      } catch (ex) {
        failedKeys.add(entry.key);
        logger.warn('[DATA_HISTORY] Unable to copy entry to the new folder, leaving it in the previous folder', entry.key, ex);
        // The row still points at the previous folder, so a half-written copy in the new one is
        // garbage — and once the config repoints it would be what the row resolves to
        await newStore.deleteEntryDir(getParentDirPath(entry.files[0].path)).catch(() => undefined);
      }
      onProgress?.(copiedKeys.size, folderEntries.length);
    }
  };
  await runFolderCopyPass();
  // Second pass catches entries whose capture finished while the first pass was copying
  await runFolderCopyPass();
  // Anything still stamped 'directory' but not copied is knowingly left in the previous folder.
  // Counted BEFORE the repoint, while the stamp still unambiguously means that folder.
  const skipped = (await dataHistoryDb.getAllEntries()).filter(
    (entry) => entry.storageBackend === 'directory' && !copiedKeys.has(entry.key),
  ).length;
  return { copied: copiedKeys.size, skipped };
}

/**
 * Switch back to OPFS. Entries are copied back, but the files in the user's folder are LEFT IN
 * PLACE — they are user-visible files the user may consider theirs. MUST be called from a user
 * gesture: copying OUT of the folder needs access to it, and after a browser restart that access
 * routinely has to be re-granted (see `ensureReadWritePermission`). Without the re-grant every entry
 * would fail to copy, be skipped, and end up stranded on a backend that is no longer active — with
 * nothing telling the user why their history stopped opening.
 */
export async function disconnectHistoryDirectory(onProgress?: DataHistoryMigrationProgress): Promise<DataHistoryMigrationResult> {
  const config = await dataHistoryDb.getBackendConfig();
  const handle = asDirectoryHandle(config.directoryHandle);
  if (handle && !(await ensureReadWritePermission(handle))) {
    throw new Error('Jetstream needs access to your history folder to copy your history back. Allow access and try again.');
  }
  const opfsStore = await getFileStoreForBackend('opfs');
  const result = await migrateHistoryEntries({ to: opfsStore, onProgress });
  // KEEP the folder handle in the config: entries that could not migrate (in-flight captures,
  // per-entry copy failures) stay stamped 'directory' and remain readable ONLY through this
  // handle. The retention sweep migrates stragglers to OPFS later, and a later "Store History in a
  // Folder" copies them across (see `connectHistoryDirectory`); an unreferenced handle is harmless.
  await activateBackend({ active: 'opfs', directoryHandle: config.directoryHandle });
  return result;
}

/**
 * Re-grant folder permission (MUST be called from a user gesture). Returns true when granted. Works
 * for a folder that is still the active backend AND for one retained after a disconnect — entries
 * that could not be copied back then are still stamped 'directory' and only readable through it.
 */
export async function reconnectHistoryDirectory(): Promise<boolean> {
  const config = await dataHistoryDb.getBackendConfig();
  const handle = asDirectoryHandle(config.directoryHandle);
  if (!handle) {
    return false;
  }
  const granted = await ensureReadWritePermission(handle);
  if (granted) {
    invalidateHistoryBackends();
  }
  return granted;
}

/** Desktop: store history on the real filesystem (moves existing entries out of OPFS) */
export async function enableNativeHistoryStorage(onProgress?: DataHistoryMigrationProgress): Promise<DataHistoryMigrationResult> {
  const store = await getFileStoreForBackend('native');
  await activateBackend({ active: 'native' });
  return await migrateHistoryEntries({ to: store, onProgress });
}

/**
 * Desktop: revert to app-managed (OPFS) storage. Entries are copied back, but the files on disk are
 * LEFT IN PLACE — same policy as `disconnectHistoryDirectory`: these are plain .csv/.json files in a
 * folder the user may have chosen (and may have backed up or referenced elsewhere), so they are
 * theirs to delete. Entries that could not be copied stay stamped 'native' and remain readable
 * through the native backend; the retention sweep migrates those stragglers later.
 */
export async function disableNativeHistoryStorage(onProgress?: DataHistoryMigrationProgress): Promise<DataHistoryMigrationResult> {
  const opfsStore = await getFileStoreForBackend('opfs');
  const result = await migrateHistoryEntries({ to: opfsStore, onProgress });
  await activateBackend({ active: 'opfs' });
  return result;
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
  try {
    return await window.electronAPI.pickDataHistoryFolder();
  } catch (ex) {
    // ipcRenderer.invoke wraps main-process rejections ("Error invoking remote method '…': Error: …").
    // Unwrap so the actionable message written in the main process (e.g. "try again when the current
    // data load finishes") reaches the settings toast intact.
    const message = getErrorMessage(ex).replace(/^Error invoking remote method '[^']*':\s*(?:Error:\s*)?/, '');
    throw new Error(message || 'Unable to change the data history folder');
  }
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
}): Promise<DataHistoryMigrationResult> {
  const candidates = (await dataHistoryDb.getAllEntries()).filter((entry) => entry.storageBackend !== to.type);
  // Skip in-flight entries — their handle keeps writing to its original backend, so migrating
  // concurrently would split the entry's files across two backends. `isEntryLikelyInFlight` also
  // covers captures running in ANOTHER tab/document (recent `in-progress` rows), which the local
  // active-handle set cannot see.
  const entries = candidates.filter((entry) => !isEntryLikelyInFlight(entry));
  let migrated = 0;
  for (const entry of entries) {
    try {
      if (entry.files.length === 0) {
        // A capture that crashed before its first file landed has no bytes on any backend, so
        // re-stamping is the whole migration
        await dataHistoryDb.updateEntry(entry.key, { storageBackend: to.type });
      } else {
        const from = await getFileStoreForBackend(entry.storageBackend);
        await copyEntryToStore(entry, from, to);
        if (!from.capabilities.userVisibleFiles) {
          // The entry IS migrated at this point (copied and re-stamped) — a failed source cleanup
          // must not report it as left behind. The leftover bytes are invisible to the user and
          // count only against the browser quota.
          await from.deleteEntryDir(getParentDirPath(entry.files[0].path)).catch((ex) => {
            logger.warn('[DATA_HISTORY][MIGRATE] Entry migrated but its previous files could not be removed', entry.key, ex);
          });
        }
      }
      migrated++;
      onProgress?.(migrated, entries.length);
    } catch (ex) {
      logger.warn('[DATA_HISTORY][MIGRATE] Unable to migrate entry, leaving on previous backend', entry.key, ex);
    }
  }
  return { migrated, skipped: candidates.length - migrated };
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
      // Encoding already matches — copy the stored bytes through untouched
      const bytes = await streamFileToStore(from, to, fileRef.path, fileRef.path, { gunzip: false, gzip: false });
      updatedFileRefs.push({ ...fileRef, bytes });
    } else {
      const fileName = targetCompressed ? `${fileRef.fileName}.gz` : fileRef.fileName.replace(/\.gz$/, '');
      const path = `${entryDir}/${fileName}`;
      const bytes = await streamFileToStore(from, to, fileRef.path, path, { gunzip: fileRef.compressed, gzip: targetCompressed });
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
 * Copy one file between stores CHUNK BY CHUNK, returning the bytes written to the target.
 *
 * A results file from a large bulk load runs to hundreds of MB, and `writeFile` takes the whole
 * payload as one buffer — which for the native backend also means one IPC message carrying the whole
 * file. Streaming keeps peak memory at one chunk regardless of entry size, which matters because
 * migration runs over the user's ENTIRE history in one go.
 */
async function streamFileToStore(
  from: HistoryFileStore,
  to: HistoryFileStore,
  sourcePath: string,
  targetPath: string,
  options: { gunzip: boolean; gzip: boolean },
): Promise<number> {
  const sourceBlob = await from.readFile(sourcePath, { gunzip: options.gunzip });
  const stream = await to.createWriteStream(targetPath, { gzip: options.gzip });
  const reader = sourceBlob.stream().getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      await stream.write(value);
    }
    const { bytes } = await stream.close();
    return bytes;
  } catch (ex) {
    await stream.abort().catch(() => undefined);
    throw ex;
  }
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
      const entryDir = getEntryDirPath(dir.orgFolder, dir.entryKey);
      const manifestBlob = await store.readFile(`${entryDir}/${DATA_HISTORY_FILE_NAMES.manifest}`, { gunzip: false });
      const item = parseManifestToItem(JSON.parse(await manifestBlob.text()), store.type, entryDir);
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

/**
 * Revive a manifest into a row, or null when it is not one this build wrote or it does not describe
 * the directory it was read from. A manifest is a plain file in a user-visible folder — copied,
 * edited, or restored from anywhere — so its `key` and file paths are TIED to `entryDir` rather than
 * trusted: a manifest duplicated into another entry's folder would otherwise overwrite that entry's
 * row, and a row whose file paths point outside its own directory would make a later delete of this
 * entry remove another entry's files.
 */
function parseManifestToItem(
  manifest: Record<string, unknown>,
  backend: DataHistoryStorageBackend,
  entryDir: string,
): DataHistoryItem | null {
  if (manifest.manifestVersion !== DATA_HISTORY_MANIFEST_VERSION) {
    return null;
  }
  const revived = {
    ...manifest,
    manifestVersion: undefined,
    storageBackend: backend,
    startedAt: reviveDate(manifest.startedAt),
    finishedAt: manifest.finishedAt ? reviveDate(manifest.finishedAt) : null,
    createdAt: reviveDate(manifest.createdAt),
    updatedAt: reviveDate(manifest.updatedAt),
  };
  const parsed = dataHistoryItemSchema.safeParse(revived);
  if (!parsed.success) {
    return null;
  }
  const item = parsed.data;
  const belongsToDir = entryDir.endsWith(`/${item.key}`) && item.files.every(({ path }) => getParentDirPath(path) === entryDir);
  return belongsToDir ? item : null;
}

function reviveDate(value: unknown): Date {
  return typeof value === 'string' || typeof value === 'number' ? new Date(value) : (value as Date);
}
