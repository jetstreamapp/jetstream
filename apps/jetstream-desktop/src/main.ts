import { app, BrowserWindow } from 'electron';
import logger from 'electron-log';
import { Browser } from './browser/browser';
import { initializeAutoUpdater } from './config/auto-updater';
import { initDeepLink } from './services/deep-link.service';
import { registerIpc } from './services/ipc.service';
import { initAppMenu } from './services/menu.service';
import { registerNotificationPoller } from './services/notification.service';
import {
  registerDownloadHandler,
  registerFileOpenHandler,
  registerProtocols,
  registerWebRequestHandlers,
} from './services/protocol.service';
import { isMac } from './utils/utils';

logger.transports.file.level = 'info';
logger.transports.console.level = 'debug';
logger.transports.file.maxSize = 10 * 1024 * 1024; // 10 MB

logger.info('App starting...');

initDeepLink();
initAppMenu();

app.on('window-all-closed', () => {
  if (!isMac()) {
    app.quit();
  }
});

logger.info({
  name: app.getName(),
  version: app.getVersion(),
  electron: process.versions.electron,
  chrome: process.versions.chrome,
  node: process.versions.node,
  v8: process.versions.v8,
  appLocation: app.getAppPath(),
  userData: app.getPath('userData'),
});

app.whenReady().then(async () => {
  registerProtocols();

  let mainWindow = Browser.create(() => registerIpc());

  initializeAutoUpdater();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0 || !mainWindow || mainWindow.isDestroyed()) {
      mainWindow = Browser.create();
    }
  });

  registerWebRequestHandlers();
  registerDownloadHandler();
  registerFileOpenHandler();

  registerNotificationPoller();
});
