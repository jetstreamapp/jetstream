import { app, BrowserWindow } from 'electron';
import logger from 'electron-log';
import electronSquirrelProcess from 'electron-squirrel-startup';
import { updateElectronApp, UpdateSourceType } from 'update-electron-app';
import { Browser } from './browser/browser';
import { initDeepLink } from './services/deep-link.service';
import { registerIpc } from './services/ipc.service';
import { initAppMenu } from './services/menu.service';
import {
  registerDownloadHandler,
  registerFileOpenHandler,
  registerProtocols,
  registerWebRequestHandlers,
} from './services/protocol.service';
import { isMac } from './utils/utils';

if (electronSquirrelProcess) {
  app.quit();
}

app.setAppUserModelId('app.getjetstream');

initDeepLink();
initAppMenu();

app.on('window-all-closed', () => {
  if (!isMac()) {
    app.quit();
  }
});

app.whenReady().then(async () => {
  registerProtocols();

  const mainWindow = Browser.create(() => registerIpc());

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0 || !mainWindow || mainWindow.isDestroyed()) {
      Browser.create();
    }
  });

  registerWebRequestHandlers();
  registerDownloadHandler();
  registerFileOpenHandler();
});

updateElectronApp({
  logger,
  notifyUser: true,
  updateInterval: '1 hour',
  updateSource: {
    type: UpdateSourceType.StaticStorage,
    baseUrl: `https://desktop-updates.s3.us-east-005.backblazeb2.com/jetstream/${process.platform}/${process.arch}`,
  },
});
