import { DesktopUserPreferences } from '@jetstream/desktop/types';
import { logger } from '@jetstream/shared/client-logger';
import { atom } from 'recoil';

async function fetchPreferences(): Promise<DesktopUserPreferences> {
  const preferences: DesktopUserPreferences = window.electronAPI
    ? await window.electronAPI.getPreferences()
    : {
        recordSyncEnabled: false,
        skipFrontdoorLogin: false,
        fileDownload: undefined,
      };
  logger.info('desktop preferences', preferences);
  return preferences;
}

export const desktopUserPreferences = atom<DesktopUserPreferences>({
  key: 'desktopUserPreferences',
  default: fetchPreferences(),
});
