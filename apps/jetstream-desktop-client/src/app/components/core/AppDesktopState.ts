import { DesktopUserPreferences, DesktopUserPreferencesSchema } from '@jetstream/desktop/types';
import { logger } from '@jetstream/shared/client-logger';
import { atom } from 'jotai';

async function fetchPreferences(): Promise<DesktopUserPreferences> {
  // Outside the electron shell (browser dev) there is nothing to read - the schema owns the defaults.
  const preferences: DesktopUserPreferences = window.electronAPI
    ? await window.electronAPI.getPreferences()
    : DesktopUserPreferencesSchema.parse({});
  logger.info('desktop preferences', preferences);
  return preferences;
}

/**
 * Holds the initial `getPreferences()` Promise until the first write, so code that merges into it at call time
 * must `await get(desktopUserPreferences)` - an `unwrap` of it returns the schema defaults until something mounts
 * it, which wiped every other setting from the screen on the first change made in a new window.
 */
export const desktopUserPreferences = atom<Promise<DesktopUserPreferences> | DesktopUserPreferences>(fetchPreferences());
