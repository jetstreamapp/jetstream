import { INDEXED_DB } from '@jetstream/shared/constants';
import { ColorScheme, UserProfilePreferences } from '@jetstream/types';
import { useUserPreferenceState } from '@jetstream/ui/app-state';
import localforage from 'localforage';
import { useEffect } from 'react';

const SCHEME_CLASSES = ['slds-color-scheme--light', 'slds-color-scheme--dark', 'slds-color-scheme--system'];

function setBodyScheme(scheme: ColorScheme) {
  const { body } = document;
  body.classList.remove(...SCHEME_CLASSES);
  body.classList.add(`slds-color-scheme--${scheme}`);
}

/**
 * Reads the stored color scheme preference and stamps the matching body class
 * before React mounts so dark-mode users do not see a flash of the default
 * light theme. Resolves silently on any read failure — the HTML ships with
 * `slds-color-scheme--light` already applied, so a missed read just keeps the
 * default.
 */
export async function applyThemeBeforeMount(forceScheme?: ColorScheme): Promise<void> {
  if (forceScheme) {
    setBodyScheme(forceScheme);
    return;
  }
  try {
    const prefs = await localforage.getItem<UserProfilePreferences>(INDEXED_DB.KEYS.userPreferences);
    setBodyScheme(prefs?.colorScheme ?? 'light');
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
  }, [scheme]);

  return null;
};

export default ThemeApplier;
