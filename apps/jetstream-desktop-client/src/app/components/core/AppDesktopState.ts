import { DesktopUserPreferences, DesktopUserPreferencesSchema } from '@jetstream/desktop/types';
import { logger } from '@jetstream/shared/client-logger';
import { atom } from 'jotai';
import { unwrap } from 'jotai/utils';

async function fetchPreferences(): Promise<DesktopUserPreferences> {
  // Outside the electron shell (browser dev) there is nothing to read - the schema owns the defaults.
  const preferences: DesktopUserPreferences = window.electronAPI
    ? await window.electronAPI.getPreferences()
    : DesktopUserPreferencesSchema.parse({});
  logger.info('desktop preferences', preferences);
  return preferences;
}

export const desktopUserPreferences = atom<Promise<DesktopUserPreferences> | DesktopUserPreferences>(fetchPreferences());

/**
 * The resolved preferences, for reading and then writing at call time - `desktopUserPreferences` keeps its
 * initial Promise as its value, so a functional update on it would receive the Promise instead.
 */
export const desktopUserPreferencesSyncState = unwrap(desktopUserPreferences, (prev) => prev ?? DesktopUserPreferencesSchema.parse({}));
