import { ColorScheme } from '@jetstream/types';
import { useAtomValue } from 'jotai';
import { useEffect } from 'react';
import browser from 'webextension-polyfill';
import { chromeStorageOptions } from '../utils/extension.store';

const SCHEME_CLASSES = ['slds-color-scheme--light', 'slds-color-scheme--dark', 'slds-color-scheme--system'];

function setSchemeOn(target: HTMLElement, scheme: ColorScheme) {
  target.classList.remove(...SCHEME_CLASSES);
  target.classList.add(`slds-color-scheme--${scheme}`);
}

/**
 * Reads the stored color scheme preference from `browser.storage.local` and
 * stamps the matching class on `document.body` (or `targetId`) before React
 * mounts so dark-mode users do not see a flash of the default light theme.
 * Resolves silently on any read failure — the HTML ships with
 * `slds-color-scheme--light` already applied, so a missed read just keeps the
 * default.
 */
export async function applyExtensionThemeBeforeMount({
  forceScheme,
  targetId,
}: { forceScheme?: ColorScheme; targetId?: string } = {}): Promise<void> {
  const target = targetId ? document.getElementById(targetId) : document.body;
  if (!target) {
    return;
  }
  if (forceScheme) {
    setSchemeOn(target, forceScheme);
    return;
  }
  try {
    const storage = (await browser.storage.local.get('options')) as { options?: { colorScheme?: ColorScheme } };
    setSchemeOn(target, storage.options?.colorScheme ?? 'light');
  } catch {
    setSchemeOn(target, 'light');
  }
}

export interface ExtensionThemeApplierProps {
  forceScheme?: ColorScheme;
  /**
   * Element to apply the slds-color-scheme--* class to. Defaults to
   * `document.body`. Pass a scoped element (e.g. the content-script's
   * #jetstream-app-container) to theme Jetstream-owned UI without affecting
   * the host page.
   */
  targetId?: string;
}

/**
 * Applies the user's color scheme preference (stored in
 * `chrome.storage.local.options.colorScheme`) to a target element. Used in every
 * extension React entry point — popup, standalone app, additional settings, and
 * the Salesforce content-script — so changes in any context propagate to the
 * others via the storage onChanged listener in extension.store.ts.
 */
export const ExtensionThemeApplier = ({ forceScheme, targetId }: ExtensionThemeApplierProps) => {
  const options = useAtomValue(chromeStorageOptions);
  const scheme: ColorScheme = forceScheme ?? options?.colorScheme ?? 'light';

  useEffect(() => {
    const target = targetId ? document.getElementById(targetId) : document.body;
    if (!target) {
      return;
    }
    setSchemeOn(target, scheme);
  }, [scheme, targetId]);

  return null;
};

export default ExtensionThemeApplier;
