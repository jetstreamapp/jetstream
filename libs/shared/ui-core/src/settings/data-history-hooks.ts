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
  disableNativeHistoryStorage,
  disconnectHistoryDirectory,
  enableNativeHistoryStorage,
  getHistoryBackendStatus,
  getStoragePersisted,
  isPersistentStoragePromptEligible,
  reconnectHistoryDirectory,
  requestPersistentStorage,
  setDataHistoryEnabled,
  subscribeToHistoryBackendChanges,
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

/** Loads the storage backend status on mount and exposes a stable refresher — internal to `useDataHistoryStorage`. */
function useDataHistoryBackendStatus() {
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
    // A storage change made in ANOTHER document (a second tab, the extension's settings page) must
    // show here too — otherwise this surface keeps offering "Store in a folder" / "Re-connect" and
    // the old "Files are saved to" line for a state that no longer exists until something remounts it
    return subscribeToHistoryBackendChanges(loadBackendStatus);
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

/** The `data_history_settings_changed` payload an action reports (minus `location`), or `false` when the user cancelled it */
export type DataHistoryStorageActionOutcome = Record<string, unknown> | false;

/**
 * Report the outcome of moving history between backends. Every migration can leave entries behind —
 * captures still being written, a previous folder that could not be read, a single entry whose files
 * are gone — and each of those entries stays readable where it was, so the user is told how many
 * rather than shown an unconditional "moved" toast. The ONE place that wording lives.
 */
function fireMigrationResultToast({ migrated, skipped }: DataHistoryMigrationResult, successMessage: string): void {
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
 * Data History storage for a surface that shows it — the backend status, and the ONE lifecycle around
 * every action that changes it: connect / change / re-connect a folder, switch back to the default
 * store, re-index. Shared by the Data History page and the Settings storage-location panel.
 *
 * Owning both halves is the point: every action re-reads the status when it completes AND when it
 * throws (a partial change may already have landed), so a surface cannot show a stale "Files are
 * saved to" line or keep offering "Store in a folder" for a state that no longer exists — no caller
 * wires that refresh, so no two callers can wire it differently. The hook also owns the `working`
 * flag and the "Moving history — N of N" counter: `runStorageAction` clears the counter before and
 * after every action and hands the action the `onProgress` callback that drives it, so a surface
 * cannot strand a stale counter or a stuck spinner. Toast copy, the analytics shape and the error
 * handling live here as well.
 *
 * An action resolves with its analytics payload (minus `location`, which each surface supplies), or
 * `false` when the user cancelled (a dismissed folder picker): nothing changed, so there is no
 * analytics event, no status re-read and no `onChanged`. `runStorageAction` resolves whether the
 * action completed; surfaces reach for it directly only for flows they alone offer (re-index).
 *
 * `storeInFolder` connects a folder when none is active; `changeFolder` moves the history to a
 * different one while a folder IS active — on the web that is the same `connectHistoryDirectory`
 * call (picking a folder while one is connected copies the history across), on desktop the main
 * process moves the directory; `switchBackToDefault` copies it back to the default store (OPFS).
 * All three pick the native backend when the environment supports it (desktop) and the user-chosen-
 * directory backend otherwise; each surface shows exactly one of the two.
 */
export function useDataHistoryStorage({
  analyticsLocation,
  onChanged,
}: {
  analyticsLocation: string;
  /** Runs after an action completed and the status was re-read — refresh usage numbers and the like here */
  onChanged?: () => void | Promise<void>;
}) {
  const { trackEvent } = useAmplitude();
  const { backendStatus, loadBackendStatus } = useDataHistoryBackendStatus();
  const [working, setWorking] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<Maybe<{ migrated: number; total: number }>>(null);

  async function runStorageAction(
    action: (onProgress: DataHistoryMigrationProgress) => Promise<DataHistoryStorageActionOutcome>,
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
    setMigrationProgress(null);
    try {
      const analytics = await action((migrated, total) => setMigrationProgress({ migrated, total }));
      if (analytics === false) {
        return false;
      }
      trackEvent(ANALYTICS_KEYS.data_history_settings_changed, { ...analytics, location: analyticsLocation });
      await loadBackendStatus();
      await onChanged?.();
      return true;
    } catch (ex) {
      logger.warn('[DATA_HISTORY] Storage action failed', ex);
      fireToast({ type: 'error', message: options?.errorMessage ?? (getErrorMessage(ex) || STORAGE_ACTION_ERROR_MESSAGE) });
      await loadBackendStatus();
      return false;
    } finally {
      setWorking(false);
      setMigrationProgress(null);
    }
  }

  const nativeSupported = !!backendStatus?.nativeSupported;
  // Whether to OFFER "Store History in a Folder" — keyed on the configured backend, not on where
  // writes currently land. "Change Folder…" is offered by the caller while a folder is configured.
  const available =
    !!backendStatus &&
    ((nativeSupported && backendStatus.active !== 'native') || (backendStatus.directorySupported && backendStatus.active !== 'directory'));

  function storeInFolder() {
    return runStorageAction(async (onProgress) => {
      if (nativeSupported) {
        fireMigrationResultToast(
          await enableNativeHistoryStorage(onProgress),
          'Your history is now stored on disk — manage the folder from Settings.',
        );
        return { backend: 'native' };
      }
      const result = await connectHistoryDirectory(onProgress);
      if (!result) {
        return false;
      }
      fireMigrationResultToast(result, 'Your history is now stored in the selected folder.');
      return { backend: 'directory' };
    });
  }

  function changeFolder() {
    return runStorageAction(async (onProgress) => {
      if (nativeSupported) {
        const newPath = await changeNativeHistoryFolder();
        if (!newPath) {
          return false;
        }
        fireToast({ type: 'success', message: `History moved to ${newPath}` });
        return { backend: 'native', action: 'relocate' };
      }
      const result = await connectHistoryDirectory(onProgress);
      if (!result) {
        return false;
      }
      fireMigrationResultToast(result, 'Your history was moved to the new folder.');
      return { backend: 'directory', action: 'change-folder' };
    });
  }

  /** Re-connect a previously chosen history folder after the browser revoked permission */
  function reconnectFolder() {
    return runStorageAction(
      async () => {
        const granted = await reconnectHistoryDirectory();
        fireToast(
          granted
            ? { type: 'success', message: 'Folder re-connected — new history will be saved there.' }
            : { type: 'warning', message: 'Permission was not granted.' },
        );
        return { backend: 'directory', action: 'reconnect', granted };
      },
      { errorMessage: 'There was a problem re-connecting the Data History folder.' },
    );
  }

  /** Copy history back to the default (app-managed / browser) store; the files already in the folder are left in place */
  function switchBackToDefault() {
    return runStorageAction(async (onProgress) => {
      if (nativeSupported) {
        fireMigrationResultToast(await disableNativeHistoryStorage(onProgress), 'Your history is now in app-managed storage.');
      } else {
        fireMigrationResultToast(await disconnectHistoryDirectory(onProgress), 'Your history is now in browser storage.');
      }
      return { backend: 'opfs' };
    });
  }

  return {
    backendStatus,
    storeInFolder,
    changeFolder,
    reconnectFolder,
    switchBackToDefault,
    runStorageAction,
    available,
    working,
    migrationProgress,
  };
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
