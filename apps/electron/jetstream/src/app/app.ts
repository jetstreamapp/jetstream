import { AuthenticationToken, ElectronPreferences, UserProfileAuth0Ui } from '@jetstream/types';
import { BrowserWindow, BrowserWindowConstructorOptions, dialog, Event, HandlerDetails, screen, session, shell } from 'electron';
import { join, resolve } from 'path';
import * as querystring from 'querystring';
import { URL } from 'url';
import { environment } from '../environments/environment';
import { electronAppName, preferencesAppName, rendererAppName, rendererAppPort, workerAppName } from './constants';
import ElectronEvents from './events/electron.events';
import * as appOauth from './services/auth';
import logger, { initLogger } from './services/logger';
import * as sfdcOauth from './services/sfdc-oauth';
import { readPreferences } from './utils';

// TODO: move to constants
const isMac = process.platform === 'darwin';

// TODO: move magic strings etc.. to constants

// TODO: some of this stuff should be moved out of this file into other files (e.x. events)

export default class App {
  // Keep a global reference of the window object, if you don't, the window will
  // be closed automatically when the JavaScript object is garbage collected.
  // static mainWindow: Electron.BrowserWindow;
  static windows: Set<Electron.BrowserWindow> = new Set();
  static backgroundWindow: Electron.BrowserWindow;
  static splashWindow: Electron.BrowserWindow;
  static preferencesWindow: Electron.BrowserWindow;
  static authWindow: Electron.BrowserWindow;
  static aboutWindow: Electron.BrowserWindow;
  static application: Electron.App;
  static userDataPath: string;
  static preferences: ElectronPreferences;
  static tray: Electron.Tray;
  static authToken: AuthenticationToken;
  static authenticated: boolean;
  static userInfo: UserProfileAuth0Ui;

  public static isDevelopmentMode() {
    const isEnvironmentSet: boolean = 'ELECTRON_IS_DEV' in process.env;
    const getFromEnvironment: boolean = parseInt(process.env.ELECTRON_IS_DEV, 10) === 1;

    return isEnvironmentSet ? getFromEnvironment : !environment.production;
  }

  public static isDevelopmentOrDebug() {
    return this.isDevelopmentMode() || !!process.env.ELECTRON_ENABLE_LOGGING;
  }

  private static onWindowAllClosed() {
    if (isMac || App.isDevelopmentMode()) {
      App.application.quit();
    }
  }

  static logout() {
    appOauth.clearAuthToken(App.userDataPath);
    App.application.relaunch();
    App.application.quit();
  }

  // TODO: might need to adjust to support windows
  private static async handleProtocolLinks() {
    App.application.on('open-url', async (event, url) => {
      logger.log('PROTOCOL LINK', url);
      const _url = new URL(url);
      // finish oauth flow
      if (_url.pathname.includes('oauth/sfdc/callback')) {
        try {
          event.preventDefault();
          const windowId = Number(querystring.parse(_url.searchParams.get('state')).windowId);
          const org = await sfdcOauth.exchangeCodeForToken('jetstream', _url.searchParams);

          BrowserWindow.getAllWindows().forEach((window) => {
            const switchActiveOrg = window.id === windowId;
            window.webContents.send('org-added', org, switchActiveOrg);
          });
        } catch (ex) {
          logger.warn(ex.message);
          dialog.showErrorBox('Salesforce Authorization', `There was a problem authorizing with Salesforce`);
        }
      } else if (_url.pathname.includes('oauth/callback')) {
        // TODO:
        try {
          // TODO: where should I store these and how should I use them?
          const { token, codeVerifier, userInfo } = await appOauth.exchangeCodeForToken(_url);
          App.authenticated = await appOauth.verifyToken(App.userDataPath, { token, codeVerifier, userInfo });
          appOauth.writeAuthToken(App.userDataPath, { token, codeVerifier, userInfo });
          App.authToken = token;
          App.userInfo = userInfo;
          App.backgroundWindow.webContents.send('auth-user', {
            userInfo,
          });
          setTimeout(() => {
            App.authWindow?.destroy();
          });
        } catch (ex) {
          logger.warn('[AUTH][FAILED]', ex.message, ex.response?.data);
        }
      }
    });
  }

  private static async onReady() {
    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.

    App.splashWindow = new BrowserWindow({
      width: 400,
      height: 150,
      center: true,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      backgroundColor: 'rgb(17, 24, 39)',
      webPreferences: { devTools: false, contextIsolation: true, sandbox: true },
    });
    App.splashWindow.loadURL(new URL(join(__dirname, '..', electronAppName, 'assets/splash.html'), 'file:').toString());
    App.splashWindow.on('closed', () => {
      logger.log('[SPLASH] closed');
      App.splashWindow = null;
    });

    ElectronEvents.initOrgEvents();

    App.initBackgroundWindow();

    ElectronEvents.initRequestWorkerChannelEvents(App.backgroundWindow);

    const { token, codeVerifier, userInfo } = appOauth.readAuthToken(App.userDataPath);
    App.authToken = token;
    App.userInfo = userInfo;
    App.authenticated = await appOauth.verifyToken(App.userDataPath, { token, codeVerifier, userInfo });

    if (!App.authenticated) {
      // OR expired token and refresh failed
      App.openAuthWindow();
    } else {
      if (!App.preferences.isInitialized) {
        App.openPreferencesWindow(true);
      } else {
        App.createWindow();
      }
    }

    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ['http://localhost/*', 'https://localhost/*'] },
      async (details, callback) => {
        // http://localhost/oauth/sfdc/auth?loginUrl=https%3A%2F%2Flogin.salesforce.com&clientUrl=http%3A%2F%2Flocalhost%3A4200
        if (details.url.startsWith('http://localhost/')) {
          logger.log('REQUEST INTERCEPTED', details.method, details.url);
          const url = new URL(details.url);

          if (url.pathname === '/static/sfdc/login') {
            App.backgroundWindow.webContents.send('sfdc-frontdoor-login', {
              orgId: url.searchParams.get('X-SFDC-ID'),
              returnUrl: url.searchParams.get('returnUrl'),
            });
            callback({ cancel: true });
            return;
          }
        }
        callback({ cancel: false });
      }
    );

    // http://localhost:4200/electron-assets/download-zip-sw/download-zip.sw.js
    session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ['*://*/electron-assets/download-zip-sw'] }, (details, callback) => {
      details.requestHeaders['Service-Worker-Allowed'] = '/electron-assets/download-zip-sw';
      callback({ requestHeaders: details.requestHeaders });
    });

    session.defaultSession.on('will-download', (event, item, webContents) => {
      logger.log('DOWNLOADING', item.getURL());
      if (App.preferences?.downloadFolder && !App.preferences.downloadFolder.prompt && App.preferences.downloadFolder.location) {
        item.setSavePath(join(App.preferences.downloadFolder.location, item.getFilename()));
      }
      item.once('done', (e, state) => {
        if (state === 'completed') {
          logger.log('DOWNLOAD COMPLETE');
        } else {
          logger.log('DOWNLOAD FAILED');
        }
      });
    });
  }

  static openAuthWindow() {
    if (App.authWindow) {
      return;
    }
    App.authWindow = new BrowserWindow({
      width: 800,
      height: 600,
      minHeight: 600,
      minWidth: 800,
      title: 'Jetstream Login',
      center: true,
      show: false,
      titleBarStyle: 'hidden',
      titleBarOverlay: true,
      backgroundColor: 'rgb(17, 24, 39)',
      webPreferences: {
        contextIsolation: true,
        backgroundThrottling: false,
        // sandbox: true,
        preload: join(__dirname, 'auth.preload.js'),
      },
    });
    App.authWindow.loadURL(new URL(join(__dirname, '..', electronAppName, 'assets/login.html'), 'file:').toString());

    App.authWindow.on('closed', () => {
      logger.log('[AUTH] closed');
      App.authWindow = null;
      if (App.authenticated) {
        if (!App.preferences.isInitialized) {
          App.openPreferencesWindow(true);
        } else {
          App.createWindow();
        }
      } else {
        logger.log('Auth closed, not authenticated, quitting');
        App.application.quit();
      }
    });
    App.authWindow.once('ready-to-show', () => {
      // shell.openExternal(appOauth.generateAuthUrl());
      App.authWindow.show();
      if (!App.splashWindow?.isDestroyed()) {
        App.splashWindow?.destroy();
      }
    });
  }

  private static onActivate() {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (!App.windows.size) {
      App.createWindow();
    }
  }

  public static createWindow(showImmediately = false, urlHash?: string) {
    if (!App.authenticated) {
      return;
    }
    const workAreaSize = screen.getPrimaryDisplay().workAreaSize;
    let width = Math.max(1200, workAreaSize.width || 1200);
    let height = Math.max(720, workAreaSize.height || 720);

    // const currentWindow = BrowserWindow.getFocusedWindow();
    // if (currentWindow && !currentWindow.isFullScreen()) {
    //   const bounds = currentWindow.getBounds();
    //   width = bounds.width + 24;
    //   height = bounds.height + 24;
    // }

    const windowConfig: Electron.BrowserWindowConstructorOptions = {
      width,
      height,
      minWidth: 1100,
      show: showImmediately,
      titleBarStyle: 'hidden',
      titleBarOverlay: true,
      fullscreenable: false,
      fullscreen: true,
      webPreferences: {
        contextIsolation: true,
        backgroundThrottling: false,
        enableBlinkFeatures: '',
        // sandbox: true, // TODO:
        preload: join(__dirname, 'main.preload.js'),
      },
    };

    const window = new BrowserWindow(windowConfig);

    window.once('ready-to-show', () => {
      if (!App.splashWindow?.isDestroyed()) {
        App.splashWindow?.destroy();
      }
      window.show();
    });

    if (!App.application.isPackaged) {
      window.loadURL(`http://localhost:${rendererAppPort}/app${urlHash ? urlHash : ''}`);
    } else {
      const url = new URL(join(__dirname, '..', rendererAppName, `index.html${urlHash ? urlHash : ''}`), 'file:');
      window.loadURL(url.toString());
    }

    return window;
  }

  /**
   * Create background window for the server in dev mode
   * allows refreshing to get new version of server code without full re-start
   * @param socketName
   */
  private static initBackgroundWindow() {
    // Create window for server in development mode
    App.backgroundWindow = new BrowserWindow({
      x: 500,
      y: 500,
      width: 700,
      height: 400,
      show: App.isDevelopmentOrDebug(),
      backgroundColor: 'rgb(17, 24, 39)',
      webPreferences: {
        nodeIntegration: true,
        devTools: true,
        backgroundThrottling: false,
        contextIsolation: false,
      },
    });

    const url = new URL(join(__dirname, '..', workerAppName, 'assets', 'index.html'), 'file:');
    App.backgroundWindow.loadURL(url.toString());

    App.backgroundWindow.on('ready-to-show', () => {
      App.backgroundWindow.webContents.send('auth-user', {
        userInfo: App.userInfo,
      });
    });

    App.backgroundWindow.on('closed', () => {
      logger.log('[RENDER][WORKER] closed');
      App.backgroundWindow = null;
    });
  }

  public static openPreferencesWindow(createMainWindowOnClose = false) {
    if (!App.authenticated) {
      return;
    }
    App.preferencesWindow = new BrowserWindow({
      width: 800,
      height: 500,
      minHeight: 500,
      minWidth: 500,
      center: true,
      show: false,
      webPreferences: {
        contextIsolation: true,
        backgroundThrottling: true,
        // sandbox: true,
        preload: join(__dirname, 'preferences.preload.js'),
      },
    });
    App.preferencesWindow.loadURL(new URL(join(__dirname, '..', preferencesAppName, 'index.html'), 'file:').toString());
    ElectronEvents.initPreferencesEvents(App.preferencesWindow);
    App.preferencesWindow.on('closed', () => {
      logger.log('[PREFERENCES] closed');
      App.preferencesWindow = null;
      if (createMainWindowOnClose) {
        App.createWindow();
      }
    });
    App.preferencesWindow.once('ready-to-show', () => {
      App.preferencesWindow.show();
      if (!App.splashWindow?.isDestroyed()) {
        App.splashWindow?.destroy();
      }
    });
  }

  public static openAboutWindow() {
    logger.log('[ABOUT] opening');
    App.aboutWindow = new BrowserWindow({
      width: 600,
      height: 600,
      resizable: false,
      center: true,
      show: true,
      titleBarStyle: 'hidden',
      titleBarOverlay: true,
      backgroundColor: 'rgb(17, 24, 39)',
      webPreferences: {
        contextIsolation: true,
        backgroundThrottling: true,
        preload: join(__dirname, 'about.preload.js'),
      },
    });
    App.aboutWindow.loadURL(new URL(join(__dirname, '..', electronAppName, 'assets/about.html'), 'file:').toString());
    App.aboutWindow.on('closed', () => {
      logger.log('[ABOUT] closed');
      App.aboutWindow = null;
    });

    App.aboutWindow.webContents.once('did-finish-load', () => {
      if (!App.aboutWindow?.isDestroyed() && !App.aboutWindow.webContents?.isDestroyed()) {
        App.aboutWindow.show();
        App.aboutWindow.focus();
      }
    });
  }

  private static handleNewWindow(event: Event, window: BrowserWindow) {
    setTimeout(() => {
      // Splash window is handled individually
      if (window === App.splashWindow || window === App.preferencesWindow || window === App.authWindow || window === App.aboutWindow) {
        return;
      }

      if (App.isDevelopmentOrDebug()) {
        window.webContents.openDevTools();
      }

      // BG window is handled individually
      if (window === App.backgroundWindow) {
        return;
      }

      App.windows.add(window);

      window.webContents.setWindowOpenHandler(App.handleWindowOpen(window.id));

      window.webContents.once('did-finish-load', () => {
        if (!window?.isDestroyed() && !window.webContents?.isDestroyed()) {
          window.show();
          window.focus();
        }
      });

      window.on('focus', () => {
        if (!window?.isDestroyed() && !window.webContents?.isDestroyed()) {
          window.webContents.send('focused', true);
        }
      });

      window.on('blur', () => {
        if (!window?.isDestroyed() && !window.webContents?.isDestroyed()) {
          window.webContents.send('focused', false);
        }
      });

      window.on('closed', () => {
        logger.log('[RENDER][MAIN] closed');
        App.windows.delete(window);
      });
    });
  }

  /**
   * Makes sure that new windows have the correct style
   * Also intercepts certain requests and takes alternative action
   * * oauth with salesforce - open browser
   * * External link - open in browser
   * * Salesforce login - open in browser via background window
   */
  private static handleWindowOpen(windowId: number) {
    return ({
      url,
      frameName,
    }: HandlerDetails): { action: 'deny' } | { action: 'allow'; overrideBrowserWindowOptions?: BrowserWindowConstructorOptions } => {
      logger.log('window open url', url);

      const _url = new URL(url);

      if (url.startsWith('https://docs.getjetstream.app')) {
        shell.openExternal(url);
        return { action: 'deny' };
      }

      if (url.startsWith('https://docs.getjetstream.app')) {
        shell.openExternal(url);
        return { action: 'deny' };
      }

      if (url.startsWith('http://localhost/static')) {
        const _url = new URL(url);
        App.backgroundWindow.webContents.send('sfdc-frontdoor-login', {
          orgId: _url.searchParams.get('X-SFDC-ID'),
          returnUrl: _url.searchParams.get('returnUrl'),
        });

        return { action: 'deny' };
      }

      if (_url.pathname === '/oauth/sfdc/auth') {
        const redirectURL = sfdcOauth.getRedirectUrl(
          windowId,
          'jetstream',
          _url.searchParams.get('loginUrl'),
          _url.searchParams.get('replaceOrgUniqueId')
        );
        logger.log('[REDIRECT][SHELL]', redirectURL);
        shell.openExternal(redirectURL);
        return { action: 'deny' };
      }

      // For some reason, allowing a normal url to open caused the new window app to crash
      if ((url.startsWith('file://') || url.startsWith('http://localhost')) && _url.pathname === '/app') {
        logger.log('New app window', _url.hash);
        App.createWindow(true, _url.hash);
        return { action: 'deny' };
      }

      return { action: 'allow' };
    };
  }

  static async main(app: Electron.App) {
    App.application = app;
    App.userDataPath = app.getPath('userData');
    initLogger();
    logger.log('[APP PATH]', App.userDataPath);
    App.preferences = readPreferences(App.userDataPath);
    // App.application = app.getPath('downloads')
    // Register "jetstream://" protocol for opening links
    if (process.defaultApp) {
      if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('jetstream', process.execPath, [resolve(process.argv[1])]);
      }
    } else {
      app.setAsDefaultProtocolClient('jetstream');
    }

    App.handleProtocolLinks();

    App.application.on('window-all-closed', App.onWindowAllClosed); // Quit when all windows are closed.
    App.application.on('ready', App.onReady); // App is ready to load data
    App.application.on('activate', App.onActivate); // App is activated
    App.application.on('browser-window-created', App.handleNewWindow); // App is activated
    // App.application.on('render-process-gone', (event, webContents, { exitCode, reason }) => {
    //   logger.log('render-process-gone', exitCode, reason);
    // });
    // App.application.on('child-process-gone', (event, { exitCode, reason, type, name, serviceName }) => {
    //   logger.log('child-process-gone', exitCode, reason, type, name, serviceName);
    // });
  }
}
