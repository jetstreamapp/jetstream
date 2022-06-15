import { dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import logger from '../services/logger';

export default class AppUpdater {
  constructor() {
    autoUpdater.logger = logger;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

autoUpdater.on('checking-for-update', () => {
  logger.log('Checking for updates...');
});

autoUpdater.on('update-available', (info) => {
  logger.log('New update available!');
});

autoUpdater.on('update-not-available', (info) => {
  logger.log('No update available.');
});

autoUpdater.on('error', (message) => {
  logger.error('There was a problem updating the application');
  logger.error(message);
});

autoUpdater.on('download-progress', (progressObj) => {
  let message = 'Download speed: ' + progressObj.bytesPerSecond;
  message = message + ' - Downloaded ' + progressObj.percent + '%';
  message = message + ' (' + progressObj.transferred + '/' + progressObj.total + ')';
  logger.error(message);
});

autoUpdater.on('update-downloaded', (info) => {
  const dialogOpts = {
    type: 'info',
    buttons: ['Restart', 'Later'],
    title: 'Application Update',
    message: info.version,
    detail: 'A new version has been downloaded. Restart the application to apply the updates.',
  };

  dialog.showMessageBox(dialogOpts).then((returnValue) => {
    if (returnValue.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});
