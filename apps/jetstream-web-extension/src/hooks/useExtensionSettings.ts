import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { useAtomValue } from 'jotai';
import { useEffect, useState } from 'react';
import browser from 'webextension-polyfill';
import { chromeStorageOptions, chromeSyncStorage } from '../utils/extension.store';
import { sendMessage } from '../utils/web-extension.utils';

export const useExtensionSettings = () => {
  const { authTokens, soqlQueryFormatOptions: _soqlQueryFormatOptions } = useAtomValue(chromeSyncStorage);
  const options = useAtomValue(chromeStorageOptions);
  const [soqlQueryFormatOptions, setSoqlQueryFormatOptions] = useState(_soqlQueryFormatOptions);
  const [authError, setAuthError] = useState<string | null>(null);

  const loggedIn = !!authTokens?.loggedIn;

  // Use atom values directly instead of copying to local state
  const enabled = options.enabled;
  const recordSyncEnabled = options.recordSyncEnabled;

  // Verify once on mount. Do NOT add authTokens to the dep array — re-running on
  // authTokens changes causes a verify→rotate→storage-write→re-run loop after the
  // rotated token is written to storage.
  useEffect(() => {
    sendMessage({ message: 'VERIFY_AUTH' }).catch(() => {
      setAuthError('There was a problem verifying your authentication. Please log in again.');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setEnabled = async (value: boolean) => {
    await browser.storage.local.set({ options: { enabled: value, recordSyncEnabled } });
  };

  const setRecordSyncEnabled = async (value: boolean) => {
    await browser.storage.local.set({ options: { enabled, recordSyncEnabled: value } });
  };

  useNonInitialEffect(() => {
    (async () => {
      try {
        await browser.storage.sync.set({ soqlQueryFormatOptions });
      } catch (ex) {
        console.warn('Error setting options', ex);
      }
    })();
  }, [soqlQueryFormatOptions]);

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
    soqlQueryFormatOptions,
    setSoqlQueryFormatOptions,
    authError,
    setAuthError,
    handleLogout,
  };
};
