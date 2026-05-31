import { INDEXED_DB } from '@jetstream/shared/constants';
import { ColorScheme, UserProfilePreferences } from '@jetstream/types';
import { useUserPreferenceState } from '@jetstream/ui/app-state';
import localforage from 'localforage';
import { useEffect } from 'react';

const SCHEME_CLASSES = ['slds-color-scheme--light', 'slds-color-scheme--dark', 'slds-color-scheme--system'];

/**
 * Synchronous fast-path cache for the resolved color scheme. The canonical
 * preference lives in IndexedDB (localforage, via `useUserPreferenceState`),
 * which can only be read asynchronously — too late to theme the first paint
 * without gating render on I/O. We mirror just the scheme string to
 * localStorage so `applyThemeBeforeMount` can stamp the body class
 * synchronously on a warm cache, falling back to the async IndexedDB read only
 * on a cache miss (first run after upgrade, or cleared storage).
 */
const COLOR_SCHEME_CACHE_KEY = 'JETSTREAM_COLOR_SCHEME';

function isColorScheme(value: unknown): value is ColorScheme {
  return value === 'light' || value === 'dark' || value === 'system';
}

function readCachedScheme(): ColorScheme | null {
  try {
    const value = localStorage.getItem(COLOR_SCHEME_CACHE_KEY);
    return isColorScheme(value) ? value : null;
  } catch {
    return null;
  }
}

function writeCachedScheme(scheme: ColorScheme) {
  try {
    localStorage.setItem(COLOR_SCHEME_CACHE_KEY, scheme);
  } catch {
    // best-effort cache; ThemeApplier reconciles from the canonical store on mount
  }
}

function setBodyScheme(scheme: ColorScheme) {
  const { body } = document;
  body.classList.remove(...SCHEME_CLASSES);
  body.classList.add(`slds-color-scheme--${scheme}`);
}

/**
 * Stamps the color-scheme body class before React mounts so dark-mode users do
 * not see a flash of the default light theme.
 *
 * Reads the synchronous localStorage cache first so first paint is not gated on
 * IndexedDB — the body class is set synchronously before this returns, and the
 * resolved promise just preserves the existing `.finally(...)` call sites. Only
 * a cache miss (first run after upgrade / cleared storage) actually awaits the
 * canonical IndexedDB preference. The HTML also ships with
 * `slds-color-scheme--light` applied, so any read failure just keeps the default.
 */
export async function applyThemeBeforeMount(forceScheme?: ColorScheme): Promise<void> {
  if (forceScheme) {
    setBodyScheme(forceScheme);
    return;
  }
  const cachedScheme = readCachedScheme();
  if (cachedScheme) {
    setBodyScheme(cachedScheme);
    return;
  }
  try {
    const prefs = await localforage.getItem<UserProfilePreferences>(INDEXED_DB.KEYS.userPreferences);
    const scheme = prefs?.colorScheme ?? 'light';
    setBodyScheme(scheme);
    writeCachedScheme(scheme);
  } catch {
    setBodyScheme('light');
  }
}

export interface ThemeApplierProps {
  forceScheme?: ColorScheme;
}

/**
 * Applies the user's color scheme preference to `document.body` as one of the
 * SLDS 2 scheme classes (`slds-color-scheme--{light,dark,system}`). SLDS 2's
 * `light-dark()` design tokens resolve based on the resulting `color-scheme`
 * CSS property, so this single class swap rethemes the entire app.
 *
 * Monaco editors are themed separately via `<MonacoEditor>` because the
 * `@monaco-editor/react` wrapper re-applies its `theme` prop on every editor
 * mount, which would clobber any global `monaco.editor.setTheme()` call.
 */
export const ThemeApplier = ({ forceScheme }: ThemeApplierProps) => {
  const [prefs] = useUserPreferenceState();
  const scheme: ColorScheme = forceScheme ?? prefs?.colorScheme ?? 'light';

  useEffect(() => {
    setBodyScheme(scheme);
    // Keep the synchronous fast-path cache aligned with the canonical preference
    // so the next cold start themes the first paint without an async read. Skip
    // when forced (e.g. canvas) so we never overwrite the real user preference.
    if (!forceScheme) {
      writeCachedScheme(scheme);
    }
  }, [scheme, forceScheme]);

  return null;
};

export default ThemeApplier;
