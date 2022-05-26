/**
 * This module is responsible on handling all the inter process communications
 * between the frontend to the electron backend.
 */

import { app, BrowserWindow, dialog, ipcMain, MessageChannelMain, safeStorage, shell } from 'electron';
import * as fs from 'fs';
import { join } from 'path';
import { environment } from '../../environments/environment';
import App from '../app';
import { salesforceOrgsStorage } from '../constants';
import { readPreferences, writePreferences } from '../utils';

export default class ElectronEvents {
  static userDataPath: string;

  static bootstrapElectronEvents(): Electron.IpcMain {
    return ipcMain;
  }

  static initRequestWorkerChannelEvents(backgroundWindow: Electron.BrowserWindow) {
    // TODO: if background process is killed, need to re-establish everything
    ipcMain.on('request-worker-channel', (event) => {
      console.log('[EVENT][request-worker-channel]');
      // For security reasons, let's make sure only the frames we expect can
      // access the worker.
      if (
        event.senderFrame !== backgroundWindow.webContents.mainFrame &&
        !backgroundWindow.isDestroyed() &&
        !backgroundWindow.webContents.isDestroyed()
      ) {
        // Create a new channel ...
        const { port1, port2 } = new MessageChannelMain();
        const { port1: loadWorkerPort1, port2: loadWorkerPort2 } = new MessageChannelMain();
        const { port1: queryWorkerPort1, port2: queryWorkerPort2 } = new MessageChannelMain();
        const { port1: jobsWorkerPort1, port2: jobsWorkerPort2 } = new MessageChannelMain();
        // ... send one end to the worker ...
        backgroundWindow.webContents.postMessage('new-client', null, [port1, loadWorkerPort1, queryWorkerPort1, jobsWorkerPort1]);
        // ... and the other end to the main window.
        event.senderFrame.postMessage('provide-worker-channel', null, [port2, loadWorkerPort2, queryWorkerPort2, jobsWorkerPort2]);
      }
    });

    ipcMain.on('sfdc-frontdoor-login', (event, url) => shell.openExternal(url));
  }

  static initOrgEvents() {
    ElectronEvents.userDataPath = app.getPath('userData');

    ipcMain.handle('init-orgs', async (event) => {
      console.log('[EVENT][init-orgs]');
      try {
        let orgs = [];
        const filePath = join(ElectronEvents.userDataPath, salesforceOrgsStorage);
        if (fs.existsSync(filePath)) {
          if (safeStorage.isEncryptionAvailable()) {
            orgs = JSON.parse(safeStorage.decryptString(fs.readFileSync(filePath)));
          } else {
            orgs = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          }
        }
        return orgs;
      } catch (ex) {
        // TODO: rollbar
        console.error('[ERROR] INIT ORGS', ex.message);
      }
    });

    ipcMain.handle('set-orgs', async (event, orgs) => {
      console.log('[EVENT][set-orgs]');
      try {
        const filePath = join(ElectronEvents.userDataPath, salesforceOrgsStorage);
        if (safeStorage.isEncryptionAvailable()) {
          fs.writeFileSync(filePath, safeStorage.encryptString(JSON.stringify(orgs)));
        } else {
          fs.writeFileSync(filePath, JSON.stringify(orgs), { encoding: 'utf-8' });
        }
      } catch (ex) {
        // TODO: rollbar
        console.error('[ERROR] INIT ORGS', ex.message);
      }
    });
  }

  static initPreferencesEvents(window: Electron.BrowserWindow) {
    ipcMain.removeHandler('pick-directory');
    ipcMain.handle('pick-directory', async (event) => {
      const result = await dialog.showOpenDialog(window, {
        properties: ['openDirectory'],
      });
      return result.filePaths[0];
    });
  }
}

// Retrieve app version
ipcMain.handle('get-app-version', (event) => {
  console.log(`Fetching application version... [v${environment.version}]`);

  return environment.version;
});

ipcMain.handle('is-focused', (event) => {
  return BrowserWindow.getAllWindows()
    .find((win) => win.webContents.id === event.sender.id)
    .isFocused();
});

ipcMain.handle('is-dev', (event) => {
  return App.isDevelopmentMode();
});

// Handle App termination
ipcMain.on('quit', (event, code) => {
  app.exit(code);
});

ipcMain.handle('load-preferences', () => {
  return readPreferences(App.userDataPath);
});

ipcMain.handle('save-preferences', (event, preferences) => {
  if (preferences) {
    preferences = writePreferences(App.userDataPath, preferences);
    App.preferences = preferences;
    App.windows.forEach((window) => {
      window.webContents.send('preferences-updated', preferences);
    });
    return preferences;
  } else {
    console.warn('Preferences was not provided');
  }
  return null;
});

ipcMain.handle(
  'get-path',
  (
    event,
    path:
      | 'home'
      | 'appData'
      | 'userData'
      | 'cache'
      | 'temp'
      | 'exe'
      | 'module'
      | 'desktop'
      | 'documents'
      | 'downloads'
      | 'music'
      | 'pictures'
      | 'videos'
      | 'recent'
      | 'logs'
      | 'crashDumps'
  ) => {
    return app.getPath(path);
  }
);
