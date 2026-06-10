import { ColorScheme } from '@jetstream/types';
import { useAtomValue } from 'jotai';
import { useEffect, useState } from 'react';
import { chromeStorageOptions } from '../utils/extension.store';

/**
 * Resolves the user's color scheme preference (Light / Dark / Match Device)
 * down to a concrete 'light' or 'dark' for things that need to pick a specific
 * asset (e.g. inverse logo) at render time. Tracks `prefers-color-scheme` when
 * the pref is `system` so the resolved value follows the OS.
 */
function getSystemScheme(): 'light' | 'dark' {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useResolvedColorScheme(): 'light' | 'dark' {
  const options = useAtomValue(chromeStorageOptions);
  const scheme: ColorScheme = options?.colorScheme ?? 'light';
  const [systemScheme, setSystemScheme] = useState<'light' | 'dark'>(getSystemScheme);

  useEffect(() => {
    if (scheme !== 'system') {
      return;
    }
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemScheme(mediaQuery.matches ? 'dark' : 'light');
    // Sync to the current OS value when entering system mode — it may have
    // changed while the pref was light/dark and we were not tracking it.
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, [scheme]);

  return scheme === 'system' ? systemScheme : scheme;
}
