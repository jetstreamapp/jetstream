import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { Maybe } from '@jetstream/types';
import { fireToast, Spinner } from '@jetstream/ui';
import {
  changeNativeHistoryFolder,
  connectHistoryDirectory,
  DataHistoryBackendStatus,
  disableNativeHistoryStorage,
  disconnectHistoryDirectory,
  enableNativeHistoryStorage,
  getHistoryBackendStatus,
  reconnectHistoryDirectory,
  reindexHistoryFromActiveBackend,
} from '@jetstream/ui/data-history';
import { FunctionComponent, useCallback, useEffect, useState } from 'react';
import { useAmplitude } from '../analytics';

export interface DataHistoryStorageLocationProps {
  /** Called after any storage-location change so the parent can refresh usage numbers */
  onChanged?: () => void;
}

/**
 * "Storage location" controls for Data History: the Chromium user-chosen-folder backend (File
 * System Access API) on the web, or the native filesystem backend on desktop. Renders nothing in
 * environments that support neither (Firefox/Safari web, canvas).
 */
export const DataHistoryStorageLocation: FunctionComponent<DataHistoryStorageLocationProps> = ({ onChanged }) => {
  const { trackEvent } = useAmplitude();
  const [status, setStatus] = useState<Maybe<DataHistoryBackendStatus>>(null);
  const [working, setWorking] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<Maybe<{ migrated: number; total: number }>>(null);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await getHistoryBackendStatus());
    } catch (ex) {
      logger.warn('[DATA_HISTORY] Unable to load storage backend status', ex);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  function handleMigrationProgress(migrated: number, total: number) {
    setMigrationProgress({ migrated, total });
  }

  async function runAction(action: () => Promise<unknown>, analytics: Record<string, unknown>) {
    setWorking(true);
    setMigrationProgress(null);
    try {
      await action();
      trackEvent(ANALYTICS_KEYS.data_history_settings_changed, { ...analytics, location: 'settings-storage-location' });
      await loadStatus();
      onChanged?.();
    } catch (ex) {
      logger.warn('[DATA_HISTORY] Storage location change failed', ex);
      fireToast({ type: 'error', message: 'There was a problem changing the Data History storage location.' });
      await loadStatus();
    } finally {
      setWorking(false);
      setMigrationProgress(null);
    }
  }

  if (!status || (!status.directorySupported && !status.nativeSupported)) {
    return null;
  }

  const isDirectoryActive = status.active === 'directory';
  const isNativeActive = status.active === 'native';

  return (
    <div className="slds-m-top_small slds-is-relative">
      {working && <Spinner size="small" />}
      <h3 className="slds-text-title_caps slds-m-bottom_xx-small">Storage Location</h3>

      {status.nativeSupported ? (
        <div>
          <p>{isNativeActive ? `Folder on disk: ${status.nativePath}` : 'App-managed storage (default)'}</p>
          {!isNativeActive && (
            <button
              className="slds-button slds-button_neutral slds-m-top_x-small"
              disabled={working}
              onClick={() => runAction(() => enableNativeHistoryStorage(handleMigrationProgress), { backend: 'native' })}
            >
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
                onClick={() => runAction(() => disableNativeHistoryStorage(handleMigrationProgress), { backend: 'opfs' })}
              >
                Switch Back to App-Managed Storage
              </button>
            </div>
          )}
        </div>
      ) : (
        <div>
          <p>{isDirectoryActive ? `Folder: ${status.directoryName}` : 'Browser storage (default)'}</p>
          {status.permissionNeeded && (
            <p className="slds-text-color_error slds-m-top_xx-small">
              Jetstream no longer has permission to your history folder — new history is temporarily saved to browser storage.
              <button
                className="slds-button slds-m-left_x-small"
                disabled={working}
                onClick={() =>
                  runAction(
                    async () => {
                      if (!(await reconnectHistoryDirectory())) {
                        throw new Error('Permission was not granted');
                      }
                    },
                    { backend: 'directory', action: 'reconnect' },
                  )
                }
              >
                Re-connect Folder
              </button>
            </p>
          )}
          {!isDirectoryActive && (
            <button
              className="slds-button slds-button_neutral slds-m-top_x-small"
              disabled={working}
              onClick={() =>
                runAction(
                  async () => {
                    const result = await connectHistoryDirectory(handleMigrationProgress);
                    if (result) {
                      fireToast({ type: 'success', message: 'Your history is now stored in the selected folder.' });
                    }
                  },
                  { backend: 'directory' },
                )
              }
              title="Store history as regular files in a folder you choose — visible, backed up with your other files, and kept when browser data is cleared"
            >
              Store History in a Folder on Your Computer…
            </button>
          )}
          {isDirectoryActive && (
            <div className="slds-m-top_x-small">
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
                onClick={() => runAction(() => disconnectHistoryDirectory(handleMigrationProgress), { backend: 'opfs' })}
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
