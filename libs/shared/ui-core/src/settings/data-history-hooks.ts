import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { fireToast } from '@jetstream/ui';
import {
  connectHistoryDirectory,
  DataHistoryBackendStatus,
  enableNativeHistoryStorage,
  getHistoryBackendStatus,
  getStoragePersisted,
  isPersistentStoragePromptEligible,
  reconnectHistoryDirectory,
  requestPersistentStorage,
} from '@jetstream/ui/data-history';
import { useCallback, useEffect, useState } from 'react';
import { useAmplitude } from '../analytics';

/**
 * Shared Data History storage flows (service call + toasts + analytics), used by both the Data
 * History page and the Settings components. Each hook takes the analytics `location` it should
 * report so every surface keeps its own payload.
 */

/** Loads the storage backend status on mount and exposes a stable refresher. */
export function useDataHistoryBackendStatus() {
  const [backendStatus, setBackendStatus] = useState<DataHistoryBackendStatus | null>(null);

  // Promise-chain form (not async/await) so react-hooks/set-state-in-effect can see the setState
  // is asynchronous — the await form false-positives inside custom hooks
  const loadBackendStatus = useCallback(
    () =>
      getHistoryBackendStatus()
        .then(setBackendStatus)
        .catch((ex) => {
          logger.warn('[DATA_HISTORY] Unable to load storage backend status', ex);
        }),
    [],
  );

  useEffect(() => {
    loadBackendStatus();
  }, [loadBackendStatus]);

  return { backendStatus, loadBackendStatus };
}

/**
 * "Keep history on this device" flow — asks the browser for persistent storage and reports the
 * outcome. `onRequested` runs after the analytics event but before the outcome toast (the Settings
 * section refreshes its usage numbers there).
 */
export function useRequestPersistentStorage({
  analyticsLocation,
  onRequested,
}: {
  analyticsLocation: string;
  onRequested?: (granted: boolean) => void | Promise<void>;
}) {
  const { trackEvent } = useAmplitude();
  const [requestingPersist, setRequestingPersist] = useState(false);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const persistPromptEligible = isPersistentStoragePromptEligible();

  useEffect(() => {
    if (persistPromptEligible) {
      getStoragePersisted().then(setPersisted);
    }
  }, [persistPromptEligible]);

  async function requestPersist() {
    try {
      setRequestingPersist(true);
      const granted = await requestPersistentStorage();
      setPersisted(granted);
      trackEvent(ANALYTICS_KEYS.data_history_settings_changed, { action: 'request-persist', granted, location: analyticsLocation });
      await onRequested?.(granted);
      fireToast(
        granted
          ? { type: 'success', message: 'Your browser will keep this history and not remove it automatically.' }
          : {
              type: 'warning',
              message: 'Your browser did not grant persistent storage. History is still saved, but may be removed if storage runs low.',
            },
      );
    } catch (ex) {
      logger.warn('[DATA_HISTORY] Error requesting persistent storage', ex);
    } finally {
      setRequestingPersist(false);
    }
  }

  return { persistPromptEligible, persisted, requestingPersist, requestPersist };
}

/**
 * The Data History page's combined "Store History in a Folder" flow: the native filesystem backend
 * when the environment supports it (desktop), otherwise the user-chosen-directory backend. The
 * Settings storage-location component intentionally does NOT use this — it exposes the two backends
 * as separate controls with migration progress and different analytics payloads.
 */
export function useStoreHistoryInFolder({
  analyticsLocation,
  nativeSupported,
  onChanged,
}: {
  analyticsLocation: string;
  nativeSupported: boolean;
  onChanged?: () => void | Promise<void>;
}) {
  const { trackEvent } = useAmplitude();
  const [working, setWorking] = useState(false);

  async function storeInFolder() {
    setWorking(true);
    try {
      if (nativeSupported) {
        await enableNativeHistoryStorage();
        fireToast({ type: 'success', message: 'Your history is now stored on disk — manage the folder from Settings.' });
      } else {
        const result = await connectHistoryDirectory();
        if (result) {
          fireToast({ type: 'success', message: 'Your history is now stored in the selected folder.' });
        }
      }
      trackEvent(ANALYTICS_KEYS.data_history_settings_changed, { backend: 'folder', location: analyticsLocation });
      await onChanged?.();
    } catch (ex) {
      logger.warn('[DATA_HISTORY] Error switching history storage', ex);
      fireToast({ type: 'error', message: 'There was a problem changing the Data History storage location.' });
    } finally {
      setWorking(false);
    }
  }

  return { storeInFolder, working };
}

/**
 * Re-connect a previously chosen history folder after the browser revoked permission. Fires no
 * analytics — the flow never has. The Settings storage-location component keeps its own reconnect
 * (different toasts + analytics via its `runAction` wrapper).
 */
export function useReconnectHistoryFolder({ onChanged }: { onChanged?: () => void | Promise<void> } = {}) {
  async function reconnectFolder() {
    try {
      if (await reconnectHistoryDirectory()) {
        fireToast({ type: 'success', message: 'Folder re-connected — new history will be saved there.' });
      } else {
        fireToast({ type: 'warning', message: 'Permission was not granted.' });
      }
      await onChanged?.();
    } catch (ex) {
      logger.warn('[DATA_HISTORY] Error re-connecting folder', ex);
    }
  }

  return { reconnectFolder };
}
