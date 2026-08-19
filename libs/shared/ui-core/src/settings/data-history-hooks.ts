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

const STORAGE_ACTION_ERROR_MESSAGE = 'There was a problem changing the Data History storage location.';

/**
 * The ONE lifecycle around a Data History storage action — the working flag, the analytics event and
 * `onChanged` refresh after it, the warn + error toast when it throws. Every storage button on the
 * Data History page and in Settings (connect / change / re-connect / switch back / re-index) runs
 * through this, so toast copy, the analytics shape and the spinner contract live in one place.
 *
 * An action resolves `false` when the user cancelled (a dismissed folder picker): nothing changed, so
 * there is no analytics event and no `onChanged`. Resolves whether the action completed.
 */
export function useRunStorageAction({
  analyticsLocation,
  onChanged,
  onFailed,
}: {
  analyticsLocation: string;
  /** Runs after the action completed — surfaces refresh their backend status / usage numbers here */
  onChanged?: () => void | Promise<void>;
  /** Runs after the action threw — a surface showing backend status re-reads it, since a partial change may already have landed */
  onFailed?: () => void | Promise<void>;
}) {
  const { trackEvent } = useAmplitude();
  const [working, setWorking] = useState(false);

  async function runStorageAction(
    action: () => Promise<boolean | void>,
    /** The `data_history_settings_changed` payload (minus `location`); a thunk when it depends on the action's outcome */
    analytics: Record<string, unknown> | (() => Record<string, unknown>),
    options?: {
      /**
       * Shown verbatim instead of the thrown error's message. By default the error's own message is
       * shown when it has one — some failures carry an actionable message (the previous folder needs
       * access re-granted, desktop refuses to move the folder mid-load) — rather than a generic error
       * the user can only retry.
       */
      errorMessage?: string;
    },
  ): Promise<boolean> {
    setWorking(true);
    try {
      if ((await action()) === false) {
        return false;
      }
      const analyticsPayload = typeof analytics === 'function' ? analytics() : analytics;
      trackEvent(ANALYTICS_KEYS.data_history_settings_changed, { ...analyticsPayload, location: analyticsLocation });
      await onChanged?.();
      return true;
    } catch (ex) {
      logger.warn('[DATA_HISTORY] Storage action failed', ex);
      fireToast({ type: 'error', message: options?.errorMessage ?? (getErrorMessage(ex) || STORAGE_ACTION_ERROR_MESSAGE) });
      await onFailed?.();
      return false;
    } finally {
      setWorking(false);
    }
  }

  return { runStorageAction, working };
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
 * was actually connected, so the two surfaces differ only by `location`. The four flows resolve
 * `false` when the user dismissed the picker — see `useRunStorageAction`.
 */
export function useStoreHistoryInFolder({
  analyticsLocation,
  backendStatus,
  onProgress,
  onChanged,
  onFailed,
}: {
  analyticsLocation: string;
  backendStatus: DataHistoryBackendStatus | null;
  onProgress?: DataHistoryMigrationProgress;
  onChanged?: () => void | Promise<void>;
  onFailed?: () => void | Promise<void>;
}) {
  const { runStorageAction, working } = useRunStorageAction({ analyticsLocation, onChanged, onFailed });
  const nativeSupported = !!backendStatus?.nativeSupported;
  // Whether to OFFER "Store History in a Folder" — keyed on the configured backend, not on where
  // writes currently land. "Change Folder…" is offered by the caller while a folder is configured.
  const available =
    !!backendStatus &&
    ((nativeSupported && backendStatus.active !== 'native') || (backendStatus.directorySupported && backendStatus.active !== 'directory'));

  function storeInFolder() {
    return runStorageAction(
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
    return runStorageAction(
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
  onFailed,
}: {
  analyticsLocation: string;
  onChanged?: () => void | Promise<void>;
  onFailed?: () => void | Promise<void>;
}) {
  const { runStorageAction, working } = useRunStorageAction({ analyticsLocation, onChanged, onFailed });

  function reconnectFolder() {
    let granted = false;
    return runStorageAction(
      async () => {
        granted = await reconnectHistoryDirectory();
        fireToast(
          granted
            ? { type: 'success', message: 'Folder re-connected — new history will be saved there.' }
            : { type: 'warning', message: 'Permission was not granted.' },
        );
      },
      () => ({ backend: 'directory', action: 'reconnect', granted }),
      { errorMessage: 'There was a problem re-connecting the Data History folder.' },
    );
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
