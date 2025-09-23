import { BrowserWindow, dialog } from 'electron';
import logger from 'electron-log';
import { autoUpdater, UpdateInfo } from 'electron-updater';

// Configure logging
autoUpdater.logger = logger;

// Disable auto-download - we'll control when to download
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

let updateWindow: BrowserWindow | null = null;

export function initializeAutoUpdater(mainWindow: BrowserWindow) {
  updateWindow = mainWindow;

  // Check for updates on startup (after 30 seconds)
  setTimeout(() => {
    checkForUpdates(true);
  }, 30000);

  // Check for updates every 4 hours
  setInterval(
    () => {
      checkForUpdates(true);
    },
    4 * 60 * 60 * 1000,
  );

  setupAutoUpdaterListeners();
}

function setupAutoUpdaterListeners() {
  logger.info('Auto-updater starting...');

  autoUpdater.on('checking-for-update', () => {
    logger.info('Checking for update...');
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    logger.info('Update available:', info);

    dialog
      .showMessageBox(updateWindow!, {
        type: 'info',
        title: 'Update Available',
        message: `A new version ${info.version} is available. Would you like to download it now?`,
        detail: 'The update will be installed when you restart the application.',
        buttons: ['Download', 'Later'],
        defaultId: 0,
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.downloadUpdate();
        }
      });
  });

  autoUpdater.on('update-not-available', (info) => {
    logger.info('Update not available', info);
  });

  autoUpdater.on('error', (err) => {
    logger.error('Error in auto-updater:', err);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    let logMessage = 'Download speed: ' + progressObj.bytesPerSecond;
    logMessage = logMessage + ' - Downloaded ' + progressObj.percent + '%';
    logMessage = logMessage + ' (' + progressObj.transferred + '/' + progressObj.total + ')';
    logger.info(logMessage);

    // Send progress to renderer
    if (updateWindow) {
      updateWindow.webContents.send('update-download-progress', progressObj);
    }
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    logger.info('Update downloaded:', info);

    dialog
      .showMessageBox(updateWindow!, {
        type: 'info',
        title: 'Update Ready',
        message: 'Update downloaded',
        detail: `Version ${info.version} has been downloaded and will be automatically installed on restart.`,
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall(false, true);
        }
      });
  });
}

export function checkForUpdates(silent = false) {
  if (!silent) {
    autoUpdater.checkForUpdatesAndNotify();
  } else {
    autoUpdater
      .checkForUpdates()
      .then((result) => {
        if (result?.isUpdateAvailable) {
          logger.info('Update available', result?.isUpdateAvailable);
        }
      })
      .catch((error) => {
        logger.error('Update failure', error);
      });
  }
}

// Export for menu actions
export function checkForUpdatesMenuItem() {
  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    dialog.showMessageBox(updateWindow!, {
      type: 'error',
      title: 'Update Check Failed',
      message: 'Unable to check for updates',
      detail: err.message,
    });
  });
}
