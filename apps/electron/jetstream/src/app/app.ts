import { HTTP } from '@jetstream/shared/constants';
import { AuthenticationToken, ElectronPreferences, UserProfileAuth0Ui } from '@jetstream/types';
import {
  app,
  BrowserWindow,
  BrowserWindowConstructorOptions,
  dialog,
  Event,
  HandlerDetails,
  protocol,
  screen,
  session,
  shell,
} from 'electron';
import { isString } from 'lodash';
import { join, resolve } from 'path';
import { URL } from 'url';
import { environment } from '../environments/environment';
import { appProtocol, isMac, preferencesAppName, rendererAppName, rendererAppPort, workerAppName } from './constants';
import ElectronEvents from './events/electron.events';
import * as appOauth from './services/auth';
import logger from './services/logger';
import { streamFileDownload } from './services/salesforce';
import * as sfdcOauth from './services/sfdc-oauth';
import { readPreferences, writePreferences } from './utils';

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
  static authenticated = false;
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
    if (!isMac || App.isDevelopmentMode()) {
      App.application.quit();
    }
  }

  static logout() {
    appOauth.clearAuthToken(App.userDataPath);
    App.application.relaunch();
    App.application.quit();
  }

  // TODO: might need to adjust to support windows
  private static async handleProtocolLinks(url: string, event?: Electron.Event) {
    logger.log('[PROTOCOL LINK]', url);
    const _url = new URL(url);
    // finish oauth flow
    if (_url.pathname.includes('oauth/sfdc/callback')) {
      App.application.releaseSingleInstanceLock();
      event?.preventDefault();
      try {
        const windowId = Number(new URLSearchParams(_url.searchParams.get('state')).get('windowId'));
        const org = await sfdcOauth.exchangeCodeForToken('jetstream', _url.searchParams);

        BrowserWindow.getAllWindows().forEach((window) => {
          const switchActiveOrg = window.id === windowId;
          window.webContents.send('org-added', org, switchActiveOrg);
        });
      } catch (ex) {
        logger.warn(ex.message);
        dialog.showErrorBox('Salesforce Authorization', `There was a problem authorizing with Salesforce`);
      }
      // AUTH OAUTH
      // e.x. jetstream://localhost/oauth/callback&code_challenge=jtgGS1DjPRK0iHcGC9vwy3cMtU9aMJ5aRJuvzUgIk4s
    } else if (_url.pathname.includes('oauth/callback')) {
      event?.preventDefault();
      try {
        const { token, codeVerifier, userInfo } = await appOauth.exchangeCodeForToken(_url);
        App.authenticated = await appOauth.verifyToken(App.userDataPath, { token, codeVerifier, userInfo });
        appOauth.writeAuthToken(App.userDataPath, { token, codeVerifier, userInfo });
        App.authToken = token;
        App.userInfo = userInfo;
        App.backgroundWindow.webContents.send('auth-user', {
          userInfo,
        });
        if (!App.authenticated) {
          dialog.showErrorBox(
            'Authentication Error',
            'Your login attempt was unsuccessful. Please try again. If you continue to have issues, email support@getjetstream.app.'
          );
        } else {
          setTimeout(() => {
            App.authWindow?.destroy();
          });
        }
      } catch (ex) {
        logger.warn('[AUTH][FAILED]', ex.message, ex.response?.data);
      }
    }
  }

  private static registerFileDownloadProtocol() {
    protocol.registerStreamProtocol('jetstream-download', async (request, callback) => {
      try {
        logger.warn('[jetstream-download]', request.url);
        ///api/file/stream-download?
        // url=%2Fservices%2Fdata%2Fv54.0%2Fsobjects%2FAttachment%2F00P6g00000BG1KMEA1%2FBody&X-SFDC-ID=00D6g000008KX1jEAG-0056g000004tCpaAAE
        const searchParams = new URL(request.url).searchParams;
        const url = searchParams.get('url');
        const uniqueId = searchParams.get(HTTP.HEADERS.X_SFDC_ID);
        callback({
          statusCode: 200,
          headers: {
            'Content-Type': 'application/octet-stream; charset=utf-8',
          },
          data: await streamFileDownload(uniqueId, { url }),
        });
      } catch (ex) {
        logger.warn('[jetstream-download][ERROR]', ex.message);
      }
    });
  }

  private static async onReady() {
    logger.log('[APP][onReady]');
    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.

    // safe storage is only available after app is ready on windows/linux
    try {
      await App.initializeAuth();
      logger.log('[AUTH][INIT][AUTHENTICATED]', App.authenticated);
    } catch (ex) {
      logger.log('[AUTH][INIT][INVALID]', ex.message);
    }

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
    App.splashWindow.loadURL(new URL(join(__dirname, 'assets/splash.html'), 'file:').toString());
    App.splashWindow.on('closed', () => {
      logger.log('[SPLASH] closed');
      App.splashWindow = null;
    });

    App.registerFileDownloadProtocol();

    ElectronEvents.initOrgEvents();

    App.initBackgroundWindow();

    if (!App.authenticated) {
      // OR expired token and refresh failed
      App.openAuthWindow();
    } else {
      if (!App.preferences?.isInitialized) {
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

    // set CORS headers for Salesforce direct requests (platform events)
    session.defaultSession.webRequest.onHeadersReceived({ urls: ['https://*.my.salesforce.com/cometd/*'] }, (details, callback) => {
      console.log('[CORS][REQUEST]', details.url);
      // localhost has a referrer, otherwise from filesystem there is no origin
      details.responseHeaders['Access-Control-Allow-Origin'] = [details.referrer ? new URL(details.referrer).origin : '*'];
      details.responseHeaders['Access-Control-Allow-Credentials'] = ['true'];
      details.responseHeaders['Access-Control-Allow-Methods'] = ['*'];
      details.responseHeaders['Access-Control-Allow-Headers'] = ['Authorization', 'Content-Type', 'Referer', 'User-Agent'];
      callback({ responseHeaders: details.responseHeaders });
    });

    session.defaultSession.on('will-download', (event, item, webContents) => {
      logger.log('[DOWNLOADING]', item.getURL());
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
    App.authWindow.loadURL(new URL(join(__dirname, 'assets/login.html'), 'file:').toString());

    App.authWindow.on('closed', () => {
      logger.log('[AUTH] closed');
      App.authWindow = null;
      if (App.authenticated) {
        if (!App.preferences?.isInitialized) {
          App.openPreferencesWindow(true);
        } else {
          App.createWindow();
        }
      } else {
        logger.log('Authentication failure');
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

    if (!App.backgroundWindow) {
      App.initBackgroundWindow();
    }

    const workAreaSize = screen.getPrimaryDisplay().workAreaSize;
    let width = Math.max(1200, workAreaSize.width || 1200);
    let height = Math.max(720, workAreaSize.height || 720);

    const windowConfig: Electron.BrowserWindowConstructorOptions = {
      width,
      height,
      minWidth: 1100,
      show: showImmediately,
      titleBarStyle: isMac ? 'hidden' : 'default',
      titleBarOverlay: isMac,
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
      const url = new URL(join(__dirname, '..', '..', rendererAppName, `index.html${urlHash ? urlHash : ''}`), 'file:');
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

    ElectronEvents.initRequestWorkerChannelEvents(App.backgroundWindow);

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
      // if background window closed, application will not work - ensure all windows are closed
      // could cause application to fully quit (windows) or can be opened again (mac)
      if (App.windows.size) {
        Array.from(App.windows).forEach((window) => window.destroy());
      }
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
      // if window was closed without saving, save the defaults
      if (!App.preferences?.isInitialized) {
        App.preferences = writePreferences(App.userDataPath, {
          ...App.preferences,
          isInitialized: true,
        });
      }
      if (createMainWindowOnClose) {
        App.createWindow();
      }
    });

    App.preferencesWindow.webContents.on('will-navigate', (event, url) => {
      event.preventDefault();
      shell.openExternal(url);
    });

    App.preferencesWindow.webContents.once('did-finish-load', () => {
      App.preferencesWindow.show();
      App.preferencesWindow.focus();
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
    App.aboutWindow.loadURL(new URL(join(__dirname, 'assets/about.html'), 'file:').toString());
    App.aboutWindow.on('closed', () => {
      logger.log('[ABOUT] closed');
      App.aboutWindow = null;
    });

    App.aboutWindow.webContents.on('will-navigate', (event, url) => {
      event.preventDefault();
      shell.openExternal(url);
    });

    App.aboutWindow.webContents.on('new-window', (event, url) => {
      event.preventDefault();
      shell.openExternal(url);
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

      if ([App.splashWindow, App.preferencesWindow, App.authWindow, App.aboutWindow].includes(window)) {
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
        // wait 1 second and if no other windows get opened, destroy the background window
        // this ensures the process does not hang around
        setTimeout(() => {
          if (
            !App.windows.size &&
            !App.authWindow &&
            !App.preferencesWindow &&
            App.backgroundWindow &&
            !App.backgroundWindow.isDestroyed()
          ) {
            App.backgroundWindow.destroy();
            App.backgroundWindow = null;
          }
        }, 1000);
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

      if (url.startsWith('https://drive.google.com')) {
        // EX: https://drive.google.com/u/0/uc?id=1pOCPCoX4SxQWfdGc5IFa0wjXX_BKrBcV&export=download
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

        const gotTheLock = app.requestSingleInstanceLock();
        logger.log('[APPLICATION LOCK][SFDC AUTH][GOT LOCK]', gotTheLock);

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

  static async initializeAuth() {
    // NOTE: safe storage is only available after app is ready on windows/linux
    const { token, codeVerifier, userInfo } = appOauth.readAuthToken(App.userDataPath);
    App.authToken = token;
    App.userInfo = userInfo;
    App.authenticated = await appOauth.verifyToken(App.userDataPath, { token, codeVerifier, userInfo });
    if (App.authenticated) {
      App.application.releaseSingleInstanceLock();
    }
  }

  static async main(app: Electron.App) {
    App.application = app;
    App.userDataPath = app.getPath('userData');

    // TODO: we do want multiple windows, just not if user is on auth
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
      logger.log('[SINGLE INSTANCE LOCK FAILED] Not authenticated, quitting application');
      app.quit();
      return;
    }

    app.on('second-instance', (event, argv, workingDirectory) => {
      logger.log('[SECOND INSTANCE][OPENED]');
      // Someone tried to run a second instance, focus our main window.
      // mac uses 'open-url' events
      if (!isMac) {
        const customProtocolUrl = argv.find((arg) => arg.startsWith(`${appProtocol}://`));
        if (isString(customProtocolUrl)) {
          App.handleProtocolLinks(customProtocolUrl);

          if (App.windows.size > 0) {
            const mainWindow = Array.from(App.windows)[0];
            if (mainWindow) {
              mainWindow.restore();
            }
            mainWindow.focus();
          }
        }
      }
    });

    logger.log('[APP PATH]', App.userDataPath);
    App.preferences = readPreferences(App.userDataPath);
    // App.application = app.getPath('downloads')
    // Register "jetstream://" protocol for opening links
    if (process.defaultApp) {
      if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient(appProtocol, process.execPath, [resolve(process.argv[1])]);
      }
    } else {
      app.setAsDefaultProtocolClient(appProtocol);
    }

    protocol.registerSchemesAsPrivileged([
      {
        scheme: 'jetstream-download',
        privileges: { bypassCSP: true, allowServiceWorkers: true, stream: true, supportFetchAPI: true, secure: true },
      },
    ]);

    App.application.on('open-url', async (event, url) => App.handleProtocolLinks(url, event));
    App.application.on('window-all-closed', App.onWindowAllClosed); // Quit when all windows are closed.
    App.application.on('ready', App.onReady); // App is ready to load data
    App.application.on('activate', App.onActivate); // App is activated
    App.application.on('browser-window-created', App.handleNewWindow); // App is activated
    App.application.on('will-quit', () => {
      logger.log('[APP] will quit');
    });
    App.application.on('render-process-gone', (event, webContents, { exitCode, reason }) => {
      logger.log('render-process-gone', exitCode, reason, `webContents: ${webContents.getTitle()}`);
    });
    App.application.on('child-process-gone', (event, { exitCode, reason, type, name, serviceName }) => {
      logger.log('child-process-gone', exitCode, reason, type, name, serviceName);
    });
  }
}
