import { Maybe } from '@jetstream/types';
import { BrowserWindow, dialog, Notification } from 'electron';
import logger from 'electron-log';
import { checkNotifications } from './api.service';
import * as dataService from './persistence.service';

export function registerNotificationPoller() {
  setInterval(async () => {
    const appData = dataService.getAppData();
    const { deviceId, accessToken } = appData;

    try {
      const response = await checkNotifications({ deviceId, accessToken });
      logger.debug('Notification received:', response);

      if (response.action === 'notification' && response.message) {
        showCriticalNotification(response.title || 'Important Jetstream Information', response.message, response.actionUrl);
      } else if (response.action === 'action-modal' && response.message) {
        showCriticalConfirmationDialog(response.title || 'Important Jetstream Action Required', response.message, response.actionUrl);
      } else if (!response.action && response.message) {
        // TODO: show in-app notification
      }
    } catch (error) {
      logger.error('Error checking notifications:', error);
    }
  }, 1000 * 60 * 60 * 24); // Check every 24 hours
}

export function showCriticalNotification(title: string, message: string, actionUrl?: Maybe<string>) {
  // Native OS notification - always visible
  const notification = new Notification({
    title,
    body: message,
    urgency: 'critical',
    timeoutType: 'never', // Keep visible until clicked
  });

  notification.on('click', () => {
    if (actionUrl) {
      require('electron').shell.openExternal(actionUrl);
    }
  });

  notification.show();
}

export function showCriticalConfirmationDialog(title: string, message: string, actionUrl?: Maybe<string>) {
  const mainWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];

  const response = dialog.showMessageBoxSync(mainWindow, {
    type: 'warning',
    title,
    message,
    detail: message,
    buttons: actionUrl ? ['Cancel', 'Continue'] : ['OK'],
    defaultId: 0,
    cancelId: 1,
  });

  if (response === 0 && actionUrl) {
    require('electron').shell.openExternal(actionUrl);
  }
}
