import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { chromeStorageOptions, chromeSyncStorage } from '../utils/extension.store';
import { sendMessage } from '../utils/web-extension.utils';

export const useExtensionSettings = () => {
  const { authTokens } = useRecoilValue(chromeSyncStorage);
  const options = useRecoilValue(chromeStorageOptions);
  const [enabled, setEnabled] = useState(options.enabled);
  const [recordSyncEnabled, setRecordSyncEnabled] = useState(options.recordSyncEnabled);
  const [authError, setAuthError] = useState<string | null>(null);

  const loggedIn = !!authTokens?.loggedIn;

  useEffect(() => {
    sendMessage({ message: 'VERIFY_AUTH' }).catch((err) => {
      setAuthError('There was a problem verifying your authentication. Please log in again.');
    });
  }, [authTokens]);

  useNonInitialEffect(() => {
    (async () => {
      try {
        const options = await chrome.storage.local.get('options');
        await chrome.storage.local.set({ options: { ...options, enabled, recordSyncEnabled } });
      } catch (ex) {
        console.warn('Error setting options', ex);
      }
    })();
  }, [enabled, recordSyncEnabled]);

  function handleLogout() {
    sendMessage({ message: 'LOGOUT' })
      .then(() => {
        setAuthError(null);
      })
      .catch((err) => {
        setAuthError('There was a problem verifying your authentication. Please log in again.');
      });
  }

  return {
    authTokens,
    loggedIn,
    enabled,
    setEnabled,
    recordSyncEnabled,
    setRecordSyncEnabled,
    authError,
    setAuthError,
    handleLogout,
  };
};
