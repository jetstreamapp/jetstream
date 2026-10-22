import { DesktopUserPreferences, IpcEventChannel } from '@jetstream/desktop/types';
import { BrowserWindow, WebContents } from 'electron';

/**
 * Every window keeps its own copy of the preferences, so after a save the others are sent the stored result.
 * The window that made the change is skipped when known - it already has the result, and an echo could
 * overwrite a newer change it has queued but not saved yet.
 */
export function broadcastPreferencesChanged(preferences: DesktopUserPreferences, { exclude }: { exclude?: WebContents } = {}) {
  BrowserWindow.getAllWindows().forEach(({ webContents }) => {
    if (webContents !== exclude && !webContents.isDestroyed()) {
      webContents.send(IpcEventChannel.preferencesChanged, preferences);
    }
  });
}
