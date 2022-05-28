import { app, autoUpdater, dialog } from 'electron';
import { arch, platform } from 'os';
import App from '../app';
import { updateServerUrl } from '../constants';
import logger from '../services/logger';

export default class UpdateEvents {
  // initialize auto update service - most be invoked only in production
  static initAutoUpdateService() {
    const platform_arch = platform() === 'win32' ? platform() : platform() + '_' + arch();
    const version = app.getVersion();
    const feed: Electron.FeedURLOptions = { url: `${updateServerUrl}/update/${platform_arch}/${version}` };

    if (!App.isDevelopmentMode()) {
      logger.log('Initializing auto update service...\n');

      autoUpdater.setFeedURL(feed);
      UpdateEvents.checkForUpdates();
    }
  }

  // check for updates - most be invoked after initAutoUpdateService() and only in production
  static checkForUpdates() {
    if (!App.isDevelopmentMode() && autoUpdater.getFeedURL() !== '') {
      autoUpdater.checkForUpdates();
    }
  }
}

autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName, releaseDate) => {
  const dialogOpts = {
    type: 'info',
    buttons: ['Restart', 'Later'],
    title: 'Application Update',
    message: process.platform === 'win32' ? releaseNotes : releaseName,
    detail: 'A new version has been downloaded. Restart the application to apply the updates.',
  };

  dialog.showMessageBox(dialogOpts).then((returnValue) => {
    if (returnValue.response === 0) autoUpdater.quitAndInstall();
  });
});

autoUpdater.on('checking-for-update', () => {
  logger.log('Checking for updates...\n');
});

autoUpdater.on('update-available', () => {
  logger.log('New update available!\n');
});

autoUpdater.on('update-not-available', () => {
  logger.log('Up to date!\n');
});

autoUpdater.on('before-quit-for-update', () => {
  logger.log('Application update is about to begin...\n');
});

autoUpdater.on('error', (message) => {
  logger.error('There was a problem updating the application');
  logger.error(message, '\n');
});
