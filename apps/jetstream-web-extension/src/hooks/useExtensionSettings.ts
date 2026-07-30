import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { ColorScheme } from '@jetstream/types';
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
  const colorScheme = options.colorScheme;
  const crashReportingEnabled = options.crashReportingEnabled;

  // Verify once on mount. Do NOT add authTokens to the dep array — re-running on
  // authTokens changes causes a verify→rotate→storage-write→re-run loop after the
  // rotated token is written to storage.
  useEffect(() => {
    sendMessage({ message: 'VERIFY_AUTH' }).catch(() => {
      setAuthError('There was a problem verifying your authentication. Please log in again.');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist a partial options change without dropping the other fields (storage.set replaces the
  // whole `options` object, so we must spread the current values).
  const updateOptions = async (partial: Partial<typeof options>) => {
    await browser.storage.local.set({ options: { ...options, colorScheme: options.colorScheme ?? 'light', ...partial } });
  };

  const setEnabled = (value: boolean) => updateOptions({ enabled: value });

  const setRecordSyncEnabled = (value: boolean) => updateOptions({ recordSyncEnabled: value });

  const setColorScheme = (value: ColorScheme) => updateOptions({ colorScheme: value });

  const setCrashReportingEnabled = (value: boolean) => updateOptions({ crashReportingEnabled: value });

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
    colorScheme,
    setColorScheme,
    crashReportingEnabled,
    setCrashReportingEnabled,
    soqlQueryFormatOptions,
    setSoqlQueryFormatOptions,
    authError,
    setAuthError,
    handleLogout,
  };
};
