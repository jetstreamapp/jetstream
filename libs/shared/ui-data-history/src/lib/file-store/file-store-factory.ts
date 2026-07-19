import { logger } from '@jetstream/shared/client-logger';
import { DataHistoryStorageBackend } from '@jetstream/types';
import { dataHistoryDb } from '@jetstream/ui/db';
import { isDesktopApp } from '../platform';
import { DirectoryHandleFileStore } from './directory-handle-file-store';
import type { HistoryFileStore } from './file-store.types';
import { DataHistoryDirectoryPermissionError, FsaDirectoryHandle, isFileSystemAccessSupported } from './fsa-types';
import { NativeFsFileStore } from './native-fs-file-store';
import { OpfsFileStore } from './opfs-file-store';

/**
 * Resolves file stores from `data_history_config`. Three backends exist: OPFS (default),
 * DirectoryHandle (Chromium File System Access — user-chosen folder), and Native (Electron IPC).
 *
 * The ACTIVE store receives new writes; reads route per-entry via `getFileStoreForBackend` using
 * each entry's `storageBackend` stamp, so mixed state during/after a migration always works.
 * When the configured backend cannot initialize (lost folder permission, missing electron API),
 * writes fall back to OPFS WITHOUT overwriting the config — the condition is surfaced through
 * `getDirectoryPermissionNeeded` so settings can offer a re-connect.
 */

const backendStorePromises = new Map<DataHistoryStorageBackend, Promise<HistoryFileStore>>();
let activeStorePromise: Promise<HistoryFileStore> | null = null;
let testOverrideStore: HistoryFileStore | null = null;
let directoryPermissionNeeded = false;

export async function getHistoryFileStore(): Promise<HistoryFileStore> {
  if (testOverrideStore) {
    return testOverrideStore;
  }
  if (!activeStorePromise) {
    activeStorePromise = resolveActiveStore();
    activeStorePromise.catch(() => {
      activeStorePromise = null;
    });
  }
  return activeStorePromise;
}

/** Resolve the store holding an EXISTING entry's files (routed by the entry's backend stamp). */
export async function getFileStoreForBackend(backend: DataHistoryStorageBackend): Promise<HistoryFileStore> {
  if (testOverrideStore) {
    return testOverrideStore;
  }
  let storePromise = backendStorePromises.get(backend);
  if (!storePromise) {
    storePromise = createStoreForBackend(backend);
    backendStorePromises.set(backend, storePromise);
    storePromise.catch(() => {
      backendStorePromises.delete(backend);
    });
  }
  return storePromise;
}

/** True when a persisted history folder exists but read-write permission needs a user gesture */
export function getDirectoryPermissionNeeded(): boolean {
  return directoryPermissionNeeded;
}

/** Drop all resolved stores so the next call re-reads `data_history_config` (after backend changes) */
export function resetHistoryFileStores(): void {
  activeStorePromise = null;
  backendStorePromises.clear();
  directoryPermissionNeeded = false;
}

/** Test seam — pass null to restore the real factory. */
export function setHistoryFileStoreForTests(store: HistoryFileStore | null): void {
  testOverrideStore = store;
  resetHistoryFileStores();
}

async function createStoreForBackend(backend: DataHistoryStorageBackend): Promise<HistoryFileStore> {
  switch (backend) {
    case 'opfs': {
      const store = new OpfsFileStore();
      await store.init();
      return store;
    }
    case 'directory': {
      const config = await dataHistoryDb.getBackendConfig();
      const handle = config.directoryHandle as FsaDirectoryHandle | undefined;
      if (!handle || !isFileSystemAccessSupported()) {
        throw new Error('No data history folder is connected in this browser');
      }
      const store = new DirectoryHandleFileStore(handle);
      await store.init();
      return store;
    }
    case 'native': {
      if (!isDesktopApp()) {
        throw new Error('Native data history storage is only available in the desktop app');
      }
      const store = new NativeFsFileStore();
      await store.init();
      return store;
    }
  }
}

async function resolveActiveStore(): Promise<HistoryFileStore> {
  const config = await dataHistoryDb.getBackendConfig();
  if (config.active !== 'opfs') {
    try {
      const store = await getFileStoreForBackend(config.active);
      directoryPermissionNeeded = false;
      return store;
    } catch (ex) {
      directoryPermissionNeeded = config.active === 'directory' && ex instanceof DataHistoryDirectoryPermissionError;
      logger.warn(`[DATA_HISTORY] Backend '${config.active}' unavailable, falling back to OPFS`, ex);
    }
  }
  return await getFileStoreForBackend('opfs');
}
