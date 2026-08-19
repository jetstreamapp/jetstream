import { fireToast, Spinner } from '@jetstream/ui';
import {
  disableNativeHistoryStorage,
  disconnectHistoryDirectory,
  getDataHistoryStorageLocation,
  reindexHistoryFromActiveBackend,
} from '@jetstream/ui/data-history';
import { FunctionComponent } from 'react';
import {
  fireMigrationResultToast,
  openHistoryFolder,
  useDataHistoryBackendStatus,
  useDataHistoryStorageActions,
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
  const { backendStatus: status, loadBackendStatus: loadStatus } = useDataHistoryBackendStatus();

  async function handleChanged() {
    await loadStatus();
    onChanged?.();
  }

  // Every storage button runs through the one `useDataHistoryStorageActions` lifecycle, which owns the
  // spinner and the "Moving history — N of N" counter. Connect-a-folder, change-folder and re-connect are
  // shared with the Data History page — same service call, same copy, same analytics but for `location`;
  // the flows this surface alone offers (switch back, re-index) use `runStorageAction` directly. This
  // panel SHOWS the backend status, so every flow re-reads it on failure too — a partial change may
  // already have landed.
  const {
    storeInFolder,
    changeFolder,
    reconnectFolder,
    runStorageAction,
    available: canStoreInFolder,
    working,
    migrationProgress,
  } = useDataHistoryStorageActions({
    analyticsLocation: ANALYTICS_LOCATION,
    backendStatus: status,
    onChanged: handleChanged,
    onFailed: loadStatus,
  });

  if (!status || (!status.directorySupported && !status.nativeSupported)) {
    return null;
  }

  // `isDirectoryActive`/`isNativeActive` gate WHICH BUTTONS to offer, so they key on the configured
  // backend. Where the files actually land is a different question with extra guards — derive it from
  // the shared helper so this panel and the Data History page always agree.
  const location = getDataHistoryStorageLocation(status);
  const isDirectoryActive = status.active === 'directory';
  const isNativeActive = status.active === 'native';
  const canReindexFolder = isDirectoryActive && !status.permissionNeeded && !status.folderUnavailable;

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
              <button className="slds-button slds-button_neutral" disabled={working} onClick={changeFolder}>
                Change Folder…
              </button>
              <button
                className="slds-button slds-button_neutral slds-m-left_x-small"
                disabled={working}
                onClick={() =>
                  runStorageAction(async (onProgress) => {
                    fireMigrationResultToast(await disableNativeHistoryStorage(onProgress), 'Your history is now in app-managed storage.');
                    return { backend: 'opfs' };
                  })
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
                onClick={changeFolder}
                title="Pick a different folder — your history is copied there; files in the old folder are left in place"
              >
                Change Folder…
              </button>
              {/* Re-indexing reads the folder, so it is only offered while the folder is actually usable: with
                  permission lost or the folder gone, writes fall back to browser storage and the re-index would
                  silently run against that instead — reporting "no new entries" for a folder it never opened */}
              {canReindexFolder && (
                <button
                  className="slds-button slds-button_neutral"
                  disabled={working}
                  onClick={() =>
                    runStorageAction(async () => {
                      const restored = await reindexHistoryFromActiveBackend();
                      fireToast({
                        type: 'success',
                        message:
                          restored > 0 ? `Restored ${restored} history entries from the folder.` : 'No new entries found in the folder.',
                      });
                      return { backend: 'directory', action: 'reindex' };
                    })
                  }
                  title="Rebuild the history list from the files in the connected folder (e.g. after restoring a backup)"
                >
                  Restore Entries From Folder
                </button>
              )}
              <button
                className="slds-button slds-button_neutral slds-m-left_x-small"
                disabled={working}
                onClick={() =>
                  runStorageAction(async (onProgress) => {
                    fireMigrationResultToast(await disconnectHistoryDirectory(onProgress), 'Your history is now in browser storage.');
                    return { backend: 'opfs' };
                  })
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
