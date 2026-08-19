import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { getErrorMessage } from '@jetstream/shared/utils';
import { Maybe } from '@jetstream/types';
import { fireToast, Spinner } from '@jetstream/ui';
import {
  changeNativeHistoryFolder,
  connectHistoryDirectory,
  disableNativeHistoryStorage,
  disconnectHistoryDirectory,
  getDataHistoryStorageLocation,
  reindexHistoryFromActiveBackend,
} from '@jetstream/ui/data-history';
import { FunctionComponent, useState } from 'react';
import { useAmplitude } from '../analytics';
import {
  fireMigrationResultToast,
  openHistoryFolder,
  useDataHistoryBackendStatus,
  useReconnectHistoryFolder,
  useStoreHistoryInFolder,
} from './data-history-hooks';

export interface DataHistoryStorageLocationProps {
  /** Called after any storage-location change so the parent can refresh usage numbers */
  onChanged?: () => void;
}

const ANALYTICS_LOCATION = 'settings-storage-location';

/**
 * "Storage location" controls for Data History: the Chromium user-chosen-folder backend (File
 * System Access API) on the web, or the native filesystem backend on desktop. Renders nothing in
 * environments that support neither (Firefox/Safari web, canvas).
 */
export const DataHistoryStorageLocation: FunctionComponent<DataHistoryStorageLocationProps> = ({ onChanged }) => {
  const { trackEvent } = useAmplitude();
  const { backendStatus: status, loadBackendStatus: loadStatus } = useDataHistoryBackendStatus();
  const [actionWorking, setActionWorking] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<Maybe<{ migrated: number; total: number }>>(null);

  function handleMigrationProgress(migrated: number, total: number) {
    setMigrationProgress({ migrated, total });
  }

  async function handleChanged() {
    await loadStatus();
    onChanged?.();
  }

  // Connect-a-folder and re-connect are shared with the Data History page — same service call, same
  // copy, same analytics but for `location`. Only the flows this surface alone offers use `runAction`.
  const {
    storeInFolder,
    available: canStoreInFolder,
    working: storeWorking,
  } = useStoreHistoryInFolder({
    analyticsLocation: ANALYTICS_LOCATION,
    backendStatus: status,
    onProgress: handleMigrationProgress,
    onChanged: handleChanged,
  });
  const { reconnectFolder, working: reconnectWorking } = useReconnectHistoryFolder({
    analyticsLocation: ANALYTICS_LOCATION,
    onChanged: handleChanged,
  });
  const working = actionWorking || storeWorking || reconnectWorking;

  async function runAction(action: () => Promise<unknown>, analytics: Record<string, unknown>) {
    setActionWorking(true);
    setMigrationProgress(null);
    try {
      await action();
      trackEvent(ANALYTICS_KEYS.data_history_settings_changed, { ...analytics, location: ANALYTICS_LOCATION });
      await handleChanged();
    } catch (ex) {
      logger.warn('[DATA_HISTORY] Storage location change failed', ex);
      // Some failures carry an actionable message (e.g. desktop refuses to move the folder while a
      // load is writing to it) — show it rather than a generic error the user can only retry against
      fireToast({ type: 'error', message: getErrorMessage(ex) || 'There was a problem changing the Data History storage location.' });
      await loadStatus();
    } finally {
      setActionWorking(false);
      setMigrationProgress(null);
    }
  }

  if (!status || (!status.directorySupported && !status.nativeSupported)) {
    return null;
  }

  // `isDirectoryActive`/`isNativeActive` gate WHICH BUTTONS to offer, so they key on the configured
  // backend. Where the files actually land is a different question with extra guards — derive it from
  // the shared helper so this panel and the Data History page always agree.
  const location = getDataHistoryStorageLocation(status);
  const isDirectoryActive = status.active === 'directory';
  const isNativeActive = status.active === 'native';

  return (
    <div className="slds-m-top_small slds-is-relative">
      {working && <Spinner size="small" />}
      <h3 className="slds-text-title_caps slds-m-bottom_xx-small">Storage Location</h3>

      {status.nativeSupported ? (
        <div>
          {location.kind === 'native' ? (
            <p>
              Files are saved to:{' '}
              <button
                className="slds-button"
                title="Open this folder in your file manager"
                onClick={() => openHistoryFolder(location.path)}
              >
                {location.path}
              </button>
            </p>
          ) : (
            <p>App-managed storage (default)</p>
          )}
          {status.folderUnavailable && (
            <p className="slds-text-color_error slds-m-top_xx-small">
              Your history folder{status.nativePath ? ` (${status.nativePath})` : ''} can’t be opened — it may have been moved, deleted, or
              be on a drive that isn’t connected. New history is temporarily saved to app-managed storage. Choose a different folder or
              switch back to app-managed storage.
            </p>
          )}
          {canStoreInFolder && (
            <button className="slds-button slds-button_neutral slds-m-top_x-small" disabled={working} onClick={storeInFolder}>
              Store History in a Folder on Disk
            </button>
          )}
          {isNativeActive && (
            <div className="slds-m-top_x-small">
              <button
                className="slds-button slds-button_neutral"
                disabled={working}
                onClick={() =>
                  runAction(
                    async () => {
                      const newPath = await changeNativeHistoryFolder();
                      if (newPath) {
                        fireToast({ type: 'success', message: `History moved to ${newPath}` });
                      }
                    },
                    { backend: 'native', action: 'relocate' },
                  )
                }
              >
                Change Folder…
              </button>
              <button
                className="slds-button slds-button_neutral slds-m-left_x-small"
                disabled={working}
                onClick={() =>
                  runAction(
                    async () =>
                      fireMigrationResultToast(
                        await disableNativeHistoryStorage(handleMigrationProgress),
                        'Your history is now in app-managed storage.',
                      ),
                    { backend: 'opfs' },
                  )
                }
                title="Copy history back to app-managed storage. The files already on disk are left in place."
              >
                Switch Back to App-Managed Storage
              </button>
            </div>
          )}
        </div>
      ) : (
        <div>
          <p>{location.kind === 'directory' ? `Files are saved to: ${location.name}` : 'Browser storage (default)'}</p>
          {status.permissionNeeded && (
            <p className="slds-text-color_error slds-m-top_xx-small">
              Jetstream no longer has permission to your history folder — new history is temporarily saved to browser storage.
              <button className="slds-button slds-m-left_x-small" disabled={working} onClick={reconnectFolder}>
                Re-connect Folder
              </button>
            </p>
          )}
          {status.folderUnavailable && (
            <p className="slds-text-color_error slds-m-top_xx-small">
              Your history folder{status.directoryName ? ` ("${status.directoryName}")` : ''} can’t be opened — it may have been moved or
              deleted. New history is temporarily saved to browser storage. Choose a different folder or switch back to browser storage.
            </p>
          )}
          {canStoreInFolder && (
            <button
              className="slds-button slds-button_neutral slds-m-top_x-small"
              disabled={working}
              onClick={storeInFolder}
              title="Store history as regular files in a folder you choose — visible, backed up with your other files, and kept when browser data is cleared"
            >
              Store History in a Folder on Your Computer…
            </button>
          )}
          {isDirectoryActive && (
            <div className="slds-m-top_x-small">
              <button
                className="slds-button slds-button_neutral slds-m-right_x-small"
                disabled={working}
                onClick={() =>
                  runAction(
                    async () => {
                      // Picking a folder while one is connected moves the history across — see `connectHistoryDirectory`
                      const result = await connectHistoryDirectory(handleMigrationProgress);
                      if (result) {
                        fireMigrationResultToast(result, 'Your history was moved to the new folder.');
                      }
                    },
                    { backend: 'directory', action: 'change-folder' },
                  )
                }
                title="Pick a different folder — your history is copied there; files in the old folder are left in place"
              >
                Change Folder…
              </button>
              <button
                className="slds-button slds-button_neutral"
                disabled={working}
                onClick={() =>
                  runAction(
                    async () => {
                      const restored = await reindexHistoryFromActiveBackend();
                      fireToast({
                        type: 'success',
                        message:
                          restored > 0 ? `Restored ${restored} history entries from the folder.` : 'No new entries found in the folder.',
                      });
                    },
                    { backend: 'directory', action: 'reindex' },
                  )
                }
                title="Rebuild the history list from the files in the connected folder (e.g. after restoring a backup)"
              >
                Restore Entries From Folder
              </button>
              <button
                className="slds-button slds-button_neutral slds-m-left_x-small"
                disabled={working}
                onClick={() =>
                  runAction(
                    async () =>
                      fireMigrationResultToast(
                        await disconnectHistoryDirectory(handleMigrationProgress),
                        'Your history is now in browser storage.',
                      ),
                    { backend: 'opfs' },
                  )
                }
                title="Copy history back to browser storage. The files already in your folder are left in place."
              >
                Switch Back to Browser Storage
              </button>
            </div>
          )}
        </div>
      )}

      {migrationProgress && (
        <p className="slds-text-color_weak slds-m-top_xx-small">
          {`Moving history — ${migrationProgress.migrated.toLocaleString()} of ${migrationProgress.total.toLocaleString()} entries…`}
        </p>
      )}
    </div>
  );
};
