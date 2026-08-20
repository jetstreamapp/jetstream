import { logger } from '@jetstream/shared/client-logger';
import { DataHistoryStorageBackend } from '@jetstream/types';
import { dataHistoryDb } from '@jetstream/ui/db';
import { isDesktopApp } from '../platform';
import { DirectoryHandleFileStore } from './directory-handle-file-store';
import type { HistoryFileStore } from './file-store.types';
import { asDirectoryHandle, DataHistoryDirectoryPermissionError, isFileSystemAccessSupported } from './fsa-types';
import { NativeFsFileStore } from './native-fs-file-store';
import { OpfsFileStore } from './opfs-file-store';
import { getUserScopeDir } from './user-scope';

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

/**
 * Cross-document invalidation: without it, a tab open before a backend switch keeps its cached
 * store and silently writes ALL new history to the previous backend for its whole lifetime —
 * defeating "my history lives in my chosen folder". The sender does not receive its own messages,
 * so posting never resets the tab that performed the switch.
 */
const BACKEND_CHANGE_CHANNEL_NAME = 'jetstream-data-history-backend-change';

function createBackendChangeChannel(): BroadcastChannel | null {
  try {
    if (typeof BroadcastChannel === 'undefined') {
      return null;
    }
    return new BroadcastChannel(BACKEND_CHANGE_CHANNEL_NAME);
  } catch {
    return null;
  }
}

const backendChangeChannel = createBackendChangeChannel();
const backendChangeListeners = new Set<() => void>();
if (backendChangeChannel) {
  backendChangeChannel.onmessage = () => {
    resetHistoryFileStores();
    backendChangeListeners.forEach((listener) => listener());
  };
}

/**
 * Subscribe to backend changes made in ANOTHER document (a second tab, the extension's settings
 * page) so UI showing the storage location can re-read it instead of going stale until a remount.
 * Fires after the cached stores have been dropped, so a subscriber re-reading status sees the new
 * backend. The document that performed the change does not receive its own message — it refreshes
 * through its own action's `onChanged`. Returns the unsubscribe function.
 */
export function subscribeToHistoryBackendChanges(listener: () => void): () => void {
  backendChangeListeners.add(listener);
  return () => {
    backendChangeListeners.delete(listener);
  };
}

/** Notify other tabs/documents that the backend config changed so they drop cached stores. */
export function notifyHistoryBackendChanged(): void {
  try {
    backendChangeChannel?.postMessage({ type: 'backend-changed' });
  } catch {
    // best-effort
  }
}

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
  // Dispose discarded stores (e.g. terminate the OPFS worker) so backend switches don't leak workers.
  // Best-effort and idempotent — the store instance may be shared between the active/backend caches.
  const disposed = new Set<Promise<HistoryFileStore>>();
  const disposeStore = (storePromise: Promise<HistoryFileStore> | null) => {
    if (!storePromise || disposed.has(storePromise)) {
      return;
    }
    disposed.add(storePromise);
    void storePromise.then((store) => store.dispose?.()).catch(() => undefined);
  };
  disposeStore(activeStorePromise);
  backendStorePromises.forEach(disposeStore);

  activeStorePromise = null;
  backendStorePromises.clear();
  directoryPermissionNeeded = false;
}

/**
 * Apply a backend-config change everywhere: drop this document's cached stores AND tell other
 * tabs/documents to drop theirs. Every code path that persists a backend switch must call this —
 * forgetting either half leaves some tab silently writing history to the previous backend.
 */
export function invalidateHistoryBackends(): void {
  resetHistoryFileStores();
  notifyHistoryBackendChanged();
}

/** Test seam — pass null to restore the real factory. */
export function setHistoryFileStoreForTests(store: HistoryFileStore | null): void {
  testOverrideStore = store;
  resetHistoryFileStores();
}

async function createStoreForBackend(backend: DataHistoryStorageBackend): Promise<HistoryFileStore> {
  // Every backend roots its tree under this, so no store can be built before a user is bound —
  // see `user-scope.ts` for why an unscoped fallback would be worse than failing here.
  const scopeDir = await getUserScopeDir();
  switch (backend) {
    case 'opfs': {
      const store = new OpfsFileStore(scopeDir);
      await store.init();
      return store;
    }
    case 'directory': {
      const config = await dataHistoryDb.getBackendConfig();
      const handle = asDirectoryHandle(config.directoryHandle);
      if (!handle || !isFileSystemAccessSupported()) {
        throw new Error('No data history folder is connected in this browser');
      }
      const store = new DirectoryHandleFileStore(handle, scopeDir, {
        onPermissionError: () => {
          // Permission revoked mid-session: drop cached stores so new writes fall back to OPFS and
          // surface the settings "re-connect" affordance (reset clears the flag, so set it after)
          resetHistoryFileStores();
          directoryPermissionNeeded = true;
        },
      });
      await store.init();
      return store;
    }
    case 'native': {
      if (!isDesktopApp()) {
        throw new Error('Native data history storage is only available in the desktop app');
      }
      const store = new NativeFsFileStore(scopeDir);
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
