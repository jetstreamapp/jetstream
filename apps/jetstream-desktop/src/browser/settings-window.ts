import { SETTINGS_WINDOW_PARAM } from '@jetstream/desktop/types';
import { Maybe } from '@jetstream/types';
import { BrowserWindow } from 'electron';
import { ENV } from '../config/environment';
import { Browser } from './browser';

let settingsWindow: BrowserWindow | null = null;

function getSettingsUrl(section?: Maybe<string>) {
  // The client uses a hash router, so the route (and the section anchor within it) lives in the hash
  return `${ENV.CLIENT_URL}?${SETTINGS_WINDOW_PARAM.name}=${SETTINGS_WINDOW_PARAM.value}#/settings${section ? `#${encodeURIComponent(section)}` : ''}`;
}

/**
 * Settings opens in a window of its own so the window the user was working in keeps its page.
 * There is only ever one Settings window - opening it again focuses the existing one.
 */
export function openSettingsWindow(section?: Maybe<string>): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    if (section) {
      // A hash-only change is a same-document navigation, so the page is not reloaded
      settingsWindow.loadURL(getSettingsUrl(section));
    }
    if (settingsWindow.isMinimized()) {
      settingsWindow.restore();
    }
    settingsWindow.focus();
    return settingsWindow;
  }

  settingsWindow = Browser.create(undefined, {
    url: getSettingsUrl(section),
    maximize: false,
    // It slows down opening the window, and DevTools can still be opened from the View menu
    openDevTools: false,
    windowConfig: {
      title: 'Settings',
      width: 1000,
      height: 760,
      minWidth: 720,
      minHeight: 480,
      // A native title bar, unlike the main window's hidden one, since this window has no app header to drag by
      titleBarStyle: 'default',
      trafficLightPosition: undefined,
      titleBarOverlay: false,
      fullscreenable: false,
    },
  });
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
  return settingsWindow;
}

/** Closes the Settings window when it is the only window left, since it has no way back into the rest of the app */
export function closeSettingsWindowIfAlone() {
  if (!settingsWindow || settingsWindow.isDestroyed()) {
    return;
  }
  const hasAppWindow = BrowserWindow.getAllWindows().some((window) => window !== settingsWindow && !window.isDestroyed());
  if (!hasAppWindow) {
    settingsWindow.close();
  }
}
