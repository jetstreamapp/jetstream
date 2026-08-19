import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { getErrorMessage } from '@jetstream/shared/utils';
import { Maybe } from '@jetstream/types';
import { fireToast } from '@jetstream/ui';
import { dataHistoryCaptureEnabledState } from '@jetstream/ui/app-state';
import {
  changeNativeHistoryFolder,
  connectHistoryDirectory,
  DataHistoryBackendStatus,
  DataHistoryMigrationProgress,
  DataHistoryMigrationResult,
  enableNativeHistoryStorage,
  getHistoryBackendStatus,
  getStoragePersisted,
  isPersistentStoragePromptEligible,
  reconnectHistoryDirectory,
  requestPersistentStorage,
  setDataHistoryEnabled,
  whenDataHistoryUserScopeReady,
} from '@jetstream/ui/data-history';
import { useSetAtom } from 'jotai';
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
  // is asynchronous — the await form false-positives inside custom hooks.
  // Waits for history storage to be bound to the signed-in user first: on a hard refresh straight
  // onto this page, the mount effect runs before `initDataHistory()` has done that, and querying
  // early would fail once and leave the status (and the storage controls it gates) empty.
  const loadBackendStatus = useCallback(
    () =>
      whenDataHistoryUserScopeReady()
        .then(getHistoryBackendStatus)
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
 * Turn Data History capture on or off — the ONE implementation, shared by the Settings toggle and
 * the "Enable Data History" banner on the history page.
 *
 * Capture state lives in two places that must never disagree: the persisted Dexie setting (which
 * `startDataHistoryEntry` re-reads on every capture) and `dataHistoryCaptureEnabledState`, the atom
 * that gates the per-run opt-out checkbox on all four capture surfaces. A call site that updated
 * only the setting would leave every opt-out checkbox hidden while capture was actually running,
 * with nothing logged. Writing both here is what makes that unstateable.
 *
 * Returns `false` when the change could not be persisted, so callers can surface it. Never throws.
 */
export function useSetDataHistoryCaptureEnabled({ analyticsLocation }: { analyticsLocation: string }) {
  const { trackEvent } = useAmplitude();
  const setCaptureEnabledAtom = useSetAtom(dataHistoryCaptureEnabledState);

  return useCallback(
    async (enabled: boolean): Promise<boolean> => {
      try {
        await setDataHistoryEnabled(enabled);
        setCaptureEnabledAtom(enabled);
        trackEvent(ANALYTICS_KEYS.data_history_settings_changed, { enabled, location: analyticsLocation });
        return true;
      } catch (ex) {
        logger.warn('[DATA_HISTORY] Error updating enabled setting', ex);
        fireToast({ type: 'error', message: 'There was a problem updating your Data History settings.' });
        return false;
      }
    },
    [analyticsLocation, setCaptureEnabledAtom, trackEvent],
  );
}

/**
 * "Keep history on this device" flow — asks the browser for persistent storage and reports the
 * outcome. Owns `persisted` (the browser's current answer) for whichever surface renders it, so no
 * surface keeps a second copy to refresh.
 */
export function useRequestPersistentStorage({ analyticsLocation }: { analyticsLocation: string }) {
  const { trackEvent } = useAmplitude();
  const [requestingPersist, setRequestingPersist] = useState(false);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const persistPromptEligible = isPersistentStoragePromptEligible();

  useEffect(() => {
    if (persistPromptEligible) {
      getStoragePersisted().then(setPersisted);
    }
  }, [persistPromptEligible]);

  async function requestPersist(): Promise<boolean> {
    let granted = false;
    try {
      setRequestingPersist(true);
      granted = await requestPersistentStorage();
      setPersisted(granted);
      trackEvent(ANALYTICS_KEYS.data_history_settings_changed, { action: 'request-persist', granted, location: analyticsLocation });
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
    return granted;
  }

  return { persistPromptEligible, persisted, requestingPersist, requestPersist };
}

/**
 * Report the outcome of moving history between backends. Every migration can leave entries behind —
 * captures still being written, a previous folder that could not be read, a single entry whose files
 * are gone — and each of those entries stays readable where it was, so the user is told how many
 * rather than shown an unconditional "moved" toast. The ONE place that wording lives.
 */
export function fireMigrationResultToast({ migrated, skipped }: DataHistoryMigrationResult, successMessage: string): void {
  if (skipped > 0) {
    fireToast({
      type: 'warning',
      message: `${successMessage} ${skipped.toLocaleString()} ${
        skipped === 1 ? 'entry' : 'entries'
      } could not be moved (still being written, or no longer readable from the previous location) and ${
        skipped === 1 ? 'stays' : 'stay'
      } where ${skipped === 1 ? 'it was' : 'they were'}.`,
    });
    return;
  }
  fireToast({
    type: 'success',
    message:
      migrated > 0
        ? `${successMessage} ${migrated.toLocaleString()} ${migrated === 1 ? 'entry was' : 'entries were'} moved.`
        : successMessage,
  });
}

/**
 * "Store History in a Folder" and "Change Folder…" — the ONE implementation of each, used by both
 * the Data History page and the Settings storage-location controls. Picks the native filesystem
 * backend when the environment supports it (desktop) and the user-chosen-directory backend
 * otherwise, which is the same choice both surfaces make: each shows exactly one of the two.
 *
 * `storeInFolder` connects a folder when none is active; `changeFolder` moves the history to a
 * different one while a folder IS active — on the web that is the same `connectHistoryDirectory`
 * call (picking a folder while one is connected copies the history across), on desktop the main
 * process moves the directory. They differ only in toast copy and the analytics `action`, so they
 * share one try/toast/track/working lifecycle here instead of each surface rebuilding it.
 *
 * `onProgress` drives the caller's migration counter; the analytics event reports the backend that
 * was actually connected, so the two surfaces differ only by `location`.
 */
export function useStoreHistoryInFolder({
  analyticsLocation,
  backendStatus,
  onProgress,
  onChanged,
}: {
  analyticsLocation: string;
  backendStatus: DataHistoryBackendStatus | null;
  onProgress?: DataHistoryMigrationProgress;
  onChanged?: () => void | Promise<void>;
}) {
  const { trackEvent } = useAmplitude();
  const [working, setWorking] = useState(false);
  const nativeSupported = !!backendStatus?.nativeSupported;
  // Whether to OFFER "Store History in a Folder" — keyed on the configured backend, not on where
  // writes currently land. "Change Folder…" is offered by the caller while a folder is configured.
  const available =
    !!backendStatus &&
    ((nativeSupported && backendStatus.active !== 'native') || (backendStatus.directorySupported && backendStatus.active !== 'directory'));

  /**
   * Runs one of the four folder flows. `action` resolves false when the user cancelled a picker —
   * nothing changed, so there is no toast, no analytics event, and no `onChanged`.
   */
  async function runFolderAction(action: () => Promise<boolean>, analytics: Record<string, unknown>) {
    setWorking(true);
    try {
      if (!(await action())) {
        return;
      }
      trackEvent(ANALYTICS_KEYS.data_history_settings_changed, { ...analytics, location: analyticsLocation });
      await onChanged?.();
    } catch (ex) {
      logger.warn('[DATA_HISTORY] Error switching history storage', ex);
      // Some failures carry an actionable message (the previous folder needs access re-granted, desktop
      // refuses to move the folder mid-load) — show it rather than a generic error the user can only retry
      fireToast({ type: 'error', message: getErrorMessage(ex) || 'There was a problem changing the Data History storage location.' });
    } finally {
      setWorking(false);
    }
  }

  function storeInFolder() {
    return runFolderAction(
      async () => {
        if (nativeSupported) {
          fireMigrationResultToast(
            await enableNativeHistoryStorage(onProgress),
            'Your history is now stored on disk — manage the folder from Settings.',
          );
          return true;
        }
        const result = await connectHistoryDirectory(onProgress);
        if (!result) {
          return false;
        }
        fireMigrationResultToast(result, 'Your history is now stored in the selected folder.');
        return true;
      },
      { backend: nativeSupported ? 'native' : 'directory' },
    );
  }

  function changeFolder() {
    return runFolderAction(
      async () => {
        if (nativeSupported) {
          const newPath = await changeNativeHistoryFolder();
          if (!newPath) {
            return false;
          }
          fireToast({ type: 'success', message: `History moved to ${newPath}` });
          return true;
        }
        const result = await connectHistoryDirectory(onProgress);
        if (!result) {
          return false;
        }
        fireMigrationResultToast(result, 'Your history was moved to the new folder.');
        return true;
      },
      { backend: nativeSupported ? 'native' : 'directory', action: nativeSupported ? 'relocate' : 'change-folder' },
    );
  }

  return { storeInFolder, changeFolder, available, working };
}

/**
 * Re-connect a previously chosen history folder after the browser revoked permission — the ONE
 * implementation, shared by the Data History page banner and the Settings storage-location warning.
 */
export function useReconnectHistoryFolder({
  analyticsLocation,
  onChanged,
}: {
  analyticsLocation: string;
  onChanged?: () => void | Promise<void>;
}) {
  const { trackEvent } = useAmplitude();
  const [working, setWorking] = useState(false);

  async function reconnectFolder() {
    setWorking(true);
    try {
      const granted = await reconnectHistoryDirectory();
      fireToast(
        granted
          ? { type: 'success', message: 'Folder re-connected — new history will be saved there.' }
          : { type: 'warning', message: 'Permission was not granted.' },
      );
      trackEvent(ANALYTICS_KEYS.data_history_settings_changed, {
        backend: 'directory',
        action: 'reconnect',
        granted,
        location: analyticsLocation,
      });
      await onChanged?.();
    } catch (ex) {
      logger.warn('[DATA_HISTORY] Error re-connecting folder', ex);
      fireToast({ type: 'error', message: 'There was a problem re-connecting the Data History folder.' });
    } finally {
      setWorking(false);
    }
  }

  return { reconnectFolder, working };
}

/**
 * Reveal the desktop history folder in the OS file manager. Desktop-only and best-effort — both the
 * history page and the settings section offer it on the path they display.
 */
export function openHistoryFolder(path: Maybe<string>): void {
  if (!path) {
    return;
  }
  window.electronAPI?.openFile?.(path)?.catch((ex) => logger.warn('[DATA_HISTORY] Unable to open history folder', ex));
}
