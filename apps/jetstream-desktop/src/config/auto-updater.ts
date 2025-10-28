import { UpdateStatus } from '@jetstream/desktop/types';
import { BrowserWindow } from 'electron';
import logger from 'electron-log';
import { autoUpdater, UpdateInfo } from 'electron-updater';

// Configure logging
autoUpdater.logger = logger;

// Enable auto-download - non-blocking background download
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// State management
let currentUpdateStatus: UpdateStatus = { status: 'idle' };
let lastCheckTime = 0;
const MIN_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes between checks to prevent spam

function sendUpdateStatus(status: UpdateStatus) {
  currentUpdateStatus = status;
  const windows = BrowserWindow.getAllWindows();
  windows.forEach((window) => {
    window.webContents.send('update-status', status);
  });
  logger.info('Update status:', status);
}

export function initializeAutoUpdater() {
  // Check for updates on startup (after 30 seconds)
  setTimeout(() => {
    checkForUpdates(true);
  }, 30000);

  // Check for updates every 4 hours
  setInterval(
    () => checkForUpdates(true),
    4 * 60 * 60 * 1000, // 4 hours
  );

  setupAutoUpdaterListeners();
}

function setupAutoUpdaterListeners() {
  logger.info('Auto-updater starting...');

  autoUpdater.on('checking-for-update', () => {
    logger.info('Checking for update...');
    sendUpdateStatus({ status: 'checking' });
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    logger.info('Update available:', info);
    sendUpdateStatus({
      status: 'available',
      version: info.version,
    });
    // Auto-download will start automatically since autoDownload is true
  });

  autoUpdater.on('update-not-available', (info) => {
    logger.info('Update not available', info);
    sendUpdateStatus({ status: 'up-to-date' });
  });

  autoUpdater.on('error', (err) => {
    logger.error('Error in auto-updater:', err);
    sendUpdateStatus({
      status: 'error',
      error: err.message || 'Unknown error occurred',
    });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const logMessage =
      `Download speed: ${progressObj.bytesPerSecond} - ` +
      `Downloaded ${progressObj.percent}% ` +
      `(${progressObj.transferred}/${progressObj.total})`;
    logger.info(logMessage);

    sendUpdateStatus({
      status: 'downloading',
      downloadProgress: {
        percent: progressObj.percent,
        transferred: progressObj.transferred,
        total: progressObj.total,
      },
    });
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    logger.info('Update downloaded:', info);
    sendUpdateStatus({
      status: 'ready',
      version: info.version,
    });
  });
}

export function checkForUpdates(silent = false, userInitiated = false) {
  // Debounce automatic checks to prevent spam
  if (!userInitiated && Date.now() - lastCheckTime < MIN_CHECK_INTERVAL) {
    logger.info('Skipping update check - too soon since last check');
    return;
  }

  lastCheckTime = Date.now();

  if (silent) {
    autoUpdater
      .checkForUpdates()
      .then((result) => {
        if (result?.updateInfo) {
          logger.info('Update check result:', result.updateInfo.version);
        }
      })
      .catch((error) => {
        logger.error('Update check failed:', error);
        sendUpdateStatus({
          status: 'error',
          error: error.message || 'Failed to check for updates',
        });
      });
  } else {
    // User-initiated check - always show feedback
    autoUpdater
      .checkForUpdates()
      .then((result) => {
        if (result?.updateInfo) {
          logger.info('Update check result:', result.updateInfo.version);
        }
      })
      .catch((err) => {
        logger.error('Update check failed:', err);
        sendUpdateStatus({
          status: 'error',
          error: err.message || 'Failed to check for updates',
        });
      });
  }
}

export function installUpdate() {
  // Use default behavior for NSIS installers on Windows
  // This ensures proper quit sequence and allows installer to complete
  autoUpdater.quitAndInstall();
}

export function getCurrentUpdateStatus(): UpdateStatus {
  return currentUpdateStatus;
}
