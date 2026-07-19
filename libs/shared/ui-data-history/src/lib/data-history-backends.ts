import { logger } from '@jetstream/shared/client-logger';
import { DataHistoryItem, dataHistoryItemSchema, DataHistoryStorageBackend } from '@jetstream/types';
import { dataHistoryDb } from '@jetstream/ui/db';
import { buildManifestJson } from './data-history-manifest';
import { DirectoryHandleFileStore } from './file-store/directory-handle-file-store';
import {
  getDirectoryPermissionNeeded,
  getFileStoreForBackend,
  getHistoryFileStore,
  resetHistoryFileStores,
} from './file-store/file-store-factory';
import { HistoryFileStore } from './file-store/file-store.types';
import { FsaDirectoryHandle, isFileSystemAccessSupported, showHistoryDirectoryPicker } from './file-store/fsa-types';
import { DATA_HISTORY_FILE_NAMES, getParentDirPath } from './file-store/path-utils';
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
 * Prompt the user for a folder (MUST be called from a user gesture), make it the active backend,
 * and migrate existing entries into it. Returns null when the user cancels the picker.
 */
export async function connectHistoryDirectory(onProgress?: DataHistoryMigrationProgress): Promise<{ migrated: number } | null> {
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
  const store = new DirectoryHandleFileStore(handle);
  await store.init();
  await dataHistoryDb.saveBackendConfig({ active: 'directory', directoryHandle: handle });
  resetHistoryFileStores();
  // OPFS source files are invisible to the user — delete them once copied
  const migrated = await migrateHistoryEntries({ to: store, deleteSource: true, onProgress });
  return { migrated };
}

/**
 * Switch back to OPFS. Entries are copied back, but the files in the user's folder are LEFT IN
 * PLACE — they are user-visible files the user may consider theirs.
 */
export async function disconnectHistoryDirectory(onProgress?: DataHistoryMigrationProgress): Promise<{ migrated: number }> {
  const opfsStore = await getFileStoreForBackend('opfs');
  const migrated = await migrateHistoryEntries({ to: opfsStore, deleteSource: false, onProgress });
  await dataHistoryDb.saveBackendConfig({ active: 'opfs' });
  resetHistoryFileStores();
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
    resetHistoryFileStores();
  }
  return granted;
}

/** Desktop: store history on the real filesystem (moves existing entries out of OPFS) */
export async function enableNativeHistoryStorage(onProgress?: DataHistoryMigrationProgress): Promise<{ migrated: number }> {
  const store = await getFileStoreForBackend('native');
  await dataHistoryDb.saveBackendConfig({ active: 'native' });
  resetHistoryFileStores();
  const migrated = await migrateHistoryEntries({ to: store, deleteSource: true, onProgress });
  return { migrated };
}

/** Desktop: revert to OPFS storage (moves entries back and removes them from disk) */
export async function disableNativeHistoryStorage(onProgress?: DataHistoryMigrationProgress): Promise<{ migrated: number }> {
  const opfsStore = await getFileStoreForBackend('opfs');
  const migrated = await migrateHistoryEntries({ to: opfsStore, deleteSource: true, onProgress });
  await dataHistoryDb.saveBackendConfig({ active: 'opfs' });
  resetHistoryFileStores();
  return { migrated };
}

/**
 * Desktop: move the on-disk history to a different folder. The main process moves the directory
 * and persists the preference; entry paths are relative so rows are untouched.
 * Returns the new base path, or null when the user cancels.
 */
export async function changeNativeHistoryFolder(): Promise<string | null> {
  if (!window.electronAPI?.selectFolder || !window.electronAPI.setDataHistoryFolder) {
    return null;
  }
  const folderPath = await window.electronAPI.selectFolder();
  if (!folderPath) {
    return null;
  }
  return await window.electronAPI.setDataHistoryFolder({ folderPath });
}

/**
 * Copy every entry not already on `to` into it and re-stamp. Failures skip the entry (it stays
 * fully usable on its previous backend) — never throws.
 */
export async function migrateHistoryEntries({
  to,
  deleteSource,
  onProgress,
}: {
  to: HistoryFileStore;
  deleteSource: boolean;
  onProgress?: DataHistoryMigrationProgress;
}): Promise<number> {
  const entries = (await dataHistoryDb.getAllEntries()).filter((entry) => entry.storageBackend !== to.type);
  let migrated = 0;
  for (const entry of entries) {
    try {
      if (entry.files.length > 0) {
        const from = await getFileStoreForBackend(entry.storageBackend);
        const entryDir = getParentDirPath(entry.files[0].path);
        for (const fileRef of entry.files) {
          // Copy raw bytes — already-compressed files stay compressed; the fileRef metadata is unchanged
          const blob = await from.readFile(fileRef.path, { gunzip: false });
          await to.writeFile(fileRef.path, blob, { gzip: false });
        }
        await to.writeFile(
          `${entryDir}/${DATA_HISTORY_FILE_NAMES.manifest}`,
          TEXT_ENCODER.encode(buildManifestJson({ ...entry, storageBackend: to.type })),
          { gzip: false },
        );
        await dataHistoryDb.updateEntry(entry.key, { storageBackend: to.type });
        if (deleteSource) {
          await from.deleteEntryDir(entryDir);
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
 * Rebuild missing Dexie rows from the active backend's on-disk `manifest.json` files — recovers
 * history after the user restores/moves a folder or reinstalls. Returns the number of restored rows.
 */
export async function reindexHistoryFromActiveBackend(): Promise<number> {
  const store = await getHistoryFileStore();
  if (!store.capabilities.supportsReindex) {
    return 0;
  }
  const knownKeys = new Set((await dataHistoryDb.getAllEntries()).map(({ key }) => key));
  const dirs = await store.listEntryDirs();
  let restored = 0;
  for (const dir of dirs) {
    if (knownKeys.has(dir.entryKey) || !dir.entryKey.startsWith('dh_')) {
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
