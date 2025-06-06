import { app, BrowserWindow } from 'electron';
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
