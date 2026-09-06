import { app, BrowserWindow } from 'electron';
import logger from 'electron-log';
import { Browser } from './browser/browser';
import { initializeAutoUpdater } from './config/auto-updater';
import { ENV } from './config/environment';
import { initializeSmokeTest } from './config/smoke-test';
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

// Increase memory limit for large file operations
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=6144');

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
  // re-initialize so that recent documents menu is up to date
  initAppMenu();
  registerProtocols();

  let mainWindow = Browser.create(() => registerIpc());

  // In smoke-test mode (packaged-build verification) the app exits as soon as the renderer
  // loads, so skip anything that talks to live services — most importantly the auto-updater,
  // which would otherwise hit the production update feed from CI.
  if (ENV.SMOKE_TEST) {
    initializeSmokeTest(mainWindow);
  } else {
    // Not awaited so window setup below is not delayed by the policy lookups. The menu is rebuilt
    // once they land, because the resolved policy decides whether "Check for Updates" is offered.
    initializeAutoUpdater()
      .then(() => initAppMenu())
      .catch((error) => logger.error('Failed to initialize auto-updater', error));
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0 || !mainWindow || mainWindow.isDestroyed()) {
      mainWindow = Browser.create();
    }
  });

  registerWebRequestHandlers();
  registerDownloadHandler();
  registerFileOpenHandler();

  if (!ENV.SMOKE_TEST) {
    registerNotificationPoller();
  }
});
