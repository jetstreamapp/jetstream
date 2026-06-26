import { ColorScheme } from '@jetstream/types';
import { useAtomValue } from 'jotai';
import { useCallback } from 'react';
import browser from 'webextension-polyfill';
import { chromeStorageOptions } from '../utils/extension.store';

/**
 * Reads/writes the extension color scheme from `browser.storage.local.options`,
 * the same store `ExtensionThemeApplier` reads. Lets the in-app HeaderNavbar theme
 * picker drive the extension theme without going through the main app's IndexedDB
 * preference (which the extension never reads). Intentionally lighter than
 * `useExtensionSettings`, which also re-verifies auth on mount.
 */
export function useExtensionColorScheme(): [ColorScheme, (colorScheme: ColorScheme) => void] {
  const options = useAtomValue(chromeStorageOptions);
  const colorScheme = options?.colorScheme ?? 'light';

  const setColorScheme = useCallback(
    (nextColorScheme: ColorScheme) => {
      // browser.storage replaces the whole `options` value, so preserve the siblings.
      browser.storage.local
        .set({ options: { enabled: options.enabled, recordSyncEnabled: options.recordSyncEnabled, colorScheme: nextColorScheme } })
        .catch(() => {
          // best-effort; the storage onChanged listener reconciles atom state
        });
    },
    [options.enabled, options.recordSyncEnabled],
  );

  return [colorScheme, setColorScheme];
}
