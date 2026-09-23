import { fireToast, Spinner } from '@jetstream/ui';
import { getDataHistoryStorageLocation, reindexHistoryFromActiveBackend } from '@jetstream/ui/data-history';
import { FunctionComponent, ReactNode } from 'react';
import { openHistoryFolder, useDataHistoryStorage } from './data-history-hooks';
import { SettingsRow } from './layout/SettingsSection';

export interface DataHistoryStorageLocationProps {
  /** Called after any storage-location change so the parent can refresh usage numbers */
  onChanged?: () => void;
}

const ANALYTICS_LOCATION = 'settings-storage-location';

/**
 * "Storage location" row for Data History: the Chromium user-chosen-folder backend (File
 * System Access API) on the web, or the native filesystem backend on desktop. Renders nothing in
 * environments that support neither (Firefox/Safari web, canvas).
 */
export const DataHistoryStorageLocation: FunctionComponent<DataHistoryStorageLocationProps> = ({ onChanged }) => {
  // Every storage button runs through the one `useDataHistoryStorage` lifecycle, which owns the status
  // this panel shows (re-read after every action, completed or failed), the spinner and the "Moving
  // history — N of N" counter. Re-index is the only flow this surface alone offers, so it is the only
  // one built on `runStorageAction` directly.
  const {
    backendStatus: status,
    storeInFolder,
    changeFolder,
    reconnectFolder,
    switchBackToDefault,
    runStorageAction,
    available: canStoreInFolder,
    working,
    migrationProgress,
  } = useDataHistoryStorage({ analyticsLocation: ANALYTICS_LOCATION, onChanged });

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

  let description: ReactNode;
  if (location.kind === 'native') {
    description = (
      <>
        Saved to{' '}
        <button className="slds-button" title="Open this folder in your file manager" onClick={() => openHistoryFolder(location.path)}>
          {location.path}
        </button>
      </>
    );
  } else if (location.kind === 'directory') {
    description = `Saved to the folder "${location.name}" on your computer.`;
  } else if (status.nativeSupported) {
    description = 'Saved in app-managed storage (default).';
  } else {
    description = 'Saved in browser storage (default).';
  }

  return (
    <SettingsRow
      id="setting-data-history-storage"
      title="Storage location"
      description={description}
      // With a folder in use there are several actions, which fit better under the text than beside it
      stacked={isDirectoryActive || isNativeActive}
      details={
        (status.folderUnavailable || status.permissionNeeded || migrationProgress) && (
          <>
            {status.nativeSupported && status.folderUnavailable && (
              <p className="slds-text-color_error">
                Your history folder{status.nativePath ? ` (${status.nativePath})` : ''} can’t be opened — it may have been moved, deleted,
                or be on a drive that isn’t connected. New history is temporarily saved to app-managed storage. Choose a different folder or
                switch back to app-managed storage.
              </p>
            )}
            {!status.nativeSupported && status.permissionNeeded && (
              <p className="slds-text-color_error">
                Jetstream no longer has permission to your history folder — new history is temporarily saved to browser storage.
              </p>
            )}
            {!status.nativeSupported && status.folderUnavailable && (
              <p className="slds-text-color_error">
                Your history folder{status.directoryName ? ` ("${status.directoryName}")` : ''} can’t be opened — it may have been moved or
                deleted. New history is temporarily saved to browser storage. Choose a different folder or switch back to browser storage.
              </p>
            )}
            {migrationProgress && (
              <p className="slds-text-color_weak">
                {`Moving history — ${migrationProgress.migrated.toLocaleString()} of ${migrationProgress.total.toLocaleString()} entries…`}
              </p>
            )}
          </>
        )
      }
    >
      {working && <Spinner size="small" />}
      {status.nativeSupported ? (
        <>
          {canStoreInFolder && (
            <button className="slds-button slds-button_neutral" disabled={working} onClick={storeInFolder}>
              Store History in a Folder on Disk
            </button>
          )}
          {isNativeActive && (
            <>
              <button className="slds-button slds-button_neutral" disabled={working} onClick={changeFolder}>
                Change Folder…
              </button>
              <button
                className="slds-button slds-button_neutral"
                disabled={working}
                onClick={switchBackToDefault}
                title="Copy history back to app-managed storage. The files already on disk are left in place."
              >
                Switch Back to App-Managed Storage
              </button>
            </>
          )}
        </>
      ) : (
        <>
          {status.permissionNeeded && (
            <button className="slds-button slds-button_brand" disabled={working} onClick={reconnectFolder}>
              Re-connect Folder
            </button>
          )}
          {canStoreInFolder && (
            <button
              className="slds-button slds-button_neutral"
              disabled={working}
              onClick={storeInFolder}
              title="Store history as regular files in a folder you choose — visible, backed up with your other files, and kept when browser data is cleared"
            >
              Store History in a Folder on Your Computer…
            </button>
          )}
          {isDirectoryActive && (
            <>
              <button
                className="slds-button slds-button_neutral"
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
                className="slds-button slds-button_neutral"
                disabled={working}
                onClick={switchBackToDefault}
                title="Copy history back to browser storage. The files already in your folder are left in place."
              >
                Switch Back to Browser Storage
              </button>
            </>
          )}
        </>
      )}
    </SettingsRow>
  );
};
