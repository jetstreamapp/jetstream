import { app, BrowserWindow } from 'electron';
import { Browser } from './browser/browser';
import { initDeepLink } from './services/deep-link.service';
import { registerIpc } from './services/ipc.service';
import { registerProtocols, registerWebRequestHandlers } from './services/protocol.service';
// import contextMenu from 'electron-context-menu';

initDeepLink();

// FIXME: this was causing issues after packaging because it was attempting to load something with "electron:" protocol
// contextMenu({
//   showSaveImageAs: true,
//   showSearchWithGoogle: false,
//   showCopyImage: false,
// });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.whenReady().then(async () => {
  registerProtocols();

  // await setApplicationCookies();

  const mainWindow = Browser.create(() => registerIpc());

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0 || !mainWindow || mainWindow.isDestroyed()) {
      Browser.create();
    }
  });

  registerWebRequestHandlers();
});
