import { DesktopUserPreferences } from '@jetstream/desktop/types';
import { logger } from '@jetstream/shared/client-logger';

export const isDesktop = () => {
  try {
    return !!globalThis.__IS_DESKTOP__;
  } catch {
    return false;
  }
};

/** The desktop preferences, or null when not running on desktop */
export async function getDesktopPreferences(): Promise<DesktopUserPreferences | null> {
  if (!isDesktop() || !window.electronAPI) {
    return null;
  }
  return window.electronAPI.getPreferences();
}

/** Called with the saved preferences whenever another window changes them; returns an unsubscribe function */
export function onDesktopPreferencesChanged(callback: (preferences: DesktopUserPreferences) => void): () => void {
  if (!isDesktop() || !window.electronAPI) {
    return () => undefined;
  }
  return window.electronAPI.onPreferencesChanged(callback);
}

/**
 * The folder downloads are saved to without prompting (Settings → Download location),
 * or null when the user is asked where to save each download.
 */
export function getAutoSaveDownloadFolder({ fileDownload }: DesktopUserPreferences): string | null {
  return fileDownload?.omitPrompt && fileDownload.downloadPath ? fileDownload.downloadPath : null;
}

/** Opens the desktop Settings window (or focuses it when already open), scrolled to `section` when given */
export function openDesktopSettings(section?: string) {
  window.electronAPI?.openSettings({ section }).catch((ex) => logger.warn('Unable to open the Settings window', ex));
}
