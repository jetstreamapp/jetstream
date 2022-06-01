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
import * as appOauth from '../services/auth';
import logger from '../services/logger';
import { setOrgs } from '../services/salesforce';
import { readPreferences, writePreferences } from '../utils';
export default class ElectronEvents {
  static userDataPath: string;

  static bootstrapElectronEvents(): Electron.IpcMain {
    return ipcMain;
  }

  static initRequestWorkerChannelEvents(backgroundWindow: Electron.BrowserWindow) {
    // TODO: if background process is killed, need to re-establish everything
    ipcMain.on('request-worker-channel', (event) => {
      logger.log('[EVENT][request-worker-channel]');
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
      logger.log('[EVENT][init-orgs]');
      let hasFile = false;
      try {
        let orgs = [];
        const filePath = join(ElectronEvents.userDataPath, salesforceOrgsStorage);
        if (fs.existsSync(filePath)) {
          hasFile = true;
          if (safeStorage.isEncryptionAvailable()) {
            orgs = JSON.parse(safeStorage.decryptString(fs.readFileSync(filePath)));
          } else {
            orgs = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          }
        }
        setOrgs(orgs);
        return orgs;
      } catch (ex) {
        // TODO: rollbar
        logger.error('[ERROR] INIT ORGS', ex.message);
        return [];
      }
    });

    ipcMain.handle('set-orgs', async (event, orgs) => {
      logger.log('[EVENT][set-orgs]');
      try {
        const filePath = join(ElectronEvents.userDataPath, salesforceOrgsStorage);
        if (safeStorage.isEncryptionAvailable()) {
          fs.writeFileSync(filePath, safeStorage.encryptString(JSON.stringify(orgs)));
        } else {
          fs.writeFileSync(filePath, JSON.stringify(orgs), { encoding: 'utf-8' });
        }
        setOrgs(orgs);
      } catch (ex) {
        // TODO: rollbar
        logger.error('[ERROR] INIT ORGS', ex.message);
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
  logger.log(`Fetching application version... [v${environment.version}]`);

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

ipcMain.on('auth-login', (event) => {
  shell.openExternal(appOauth.generateAuthUrl());
});

ipcMain.on('auth-signup', () => {
  shell.openExternal(appOauth.generateAuthUrl(true));
});

ipcMain.on('auth-close', () => {
  app.quit();
});

ipcMain.on('logout', () => {
  App.logout();
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
    logger.warn('Preferences was not provided');
  }
  return null;
});

ipcMain.handle('get-app-info', () => {
  const [electron, chrome, node, v8] = ['electron', 'chrome', 'node', 'v8'].map((e) => process.versions[e]);
  return {
    name: app.name || app.getName(),
    copyright: `©Jetstream ${new Date().getFullYear()}`,
    version: app.getVersion(),
    versions: { electron, chrome, node, v8 },
  };
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
