import { logger } from '@jetstream/shared/client-logger';
import { DataHistoryStorageBackend } from '@jetstream/types';
import { dataHistoryDb } from '@jetstream/ui/db';
import type { HistoryFileStore } from './file-store.types';
import { OpfsFileStore } from './opfs-file-store';

/**
 * Resolves the ACTIVE file store from `data_history_config`. v1 ships OPFS only; the
 * DirectoryHandle (File System Access) and Electron-native backends slot in here without touching
 * any capture/read code — they only add cases to `createStore`/`getFileStoreForBackend`.
 */

let activeStorePromise: Promise<HistoryFileStore> | null = null;
let testOverrideStore: HistoryFileStore | null = null;

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

/**
 * Resolve the store holding an EXISTING entry's files. Entries are stamped with their backend so
 * mixed state is supported during future backend migrations; v1 only ever stamps `opfs`.
 */
export async function getFileStoreForBackend(backend: DataHistoryStorageBackend): Promise<HistoryFileStore> {
  if (testOverrideStore) {
    return testOverrideStore;
  }
  if (backend !== 'opfs') {
    throw new Error(`Data history storage backend '${backend}' is not available in this version`);
  }
  return await getHistoryFileStore();
}

/** Test seam — pass null to restore the real factory. */
export function setHistoryFileStoreForTests(store: HistoryFileStore | null): void {
  testOverrideStore = store;
  activeStorePromise = null;
}

async function resolveActiveStore(): Promise<HistoryFileStore> {
  const config = await dataHistoryDb.getBackendConfig();
  if (config.active !== 'opfs') {
    logger.warn(`[DATA_HISTORY] Backend '${config.active}' not available in this version, falling back to OPFS`);
  }
  const store = new OpfsFileStore();
  await store.init();
  return store;
}
