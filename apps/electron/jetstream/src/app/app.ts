import {
  BrowserWindow,
  BrowserWindowConstructorOptions,
  dialog,
  Event,
  HandlerDetails,
  ipcMain,
  MessageChannelMain,
  screen,
  session,
  shell,
} from 'electron';
import { join, resolve } from 'path';
import * as querystring from 'querystring';
import { URL } from 'url';
import { environment } from '../environments/environment';
import { exchangeCodeForToken, getRedirectUrl } from './api/oauth';
import { electronAppName, rendererAppName, rendererAppPort, workerAppName } from './constants';
import ElectronEvents from './events/electron.events';

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
  static firstRunWindow: Electron.BrowserWindow;
  static application: Electron.App;
  static userDataPath: string;
  static tray: Electron.Tray;

  public static isDevelopmentMode() {
    const isEnvironmentSet: boolean = 'ELECTRON_IS_DEV' in process.env;
    const getFromEnvironment: boolean = parseInt(process.env.ELECTRON_IS_DEV, 10) === 1;

    return isEnvironmentSet ? getFromEnvironment : !environment.production;
  }

  public static isDevelopmentOrDebug() {
    return this.isDevelopmentMode() || !!process.env.ELECTRON_ENABLE_LOGGING;
  }

  private static onWindowAllClosed() {
    if (isMac) {
      App.application.quit();
    }
  }

  // TODO: might need to adjust to support windows
  private static handleProtocolLinks() {
    App.application.on('open-url', async (event, url) => {
      console.log('PROTOCOL LINK', url);
      const _url = new URL(url);
      // finish oauth flow
      if (_url.pathname.includes('oauth/sfdc/callback')) {
        try {
          event.preventDefault();
          const windowId = Number(querystring.parse(_url.searchParams.get('state')).windowId);
          const org = await exchangeCodeForToken('jetstream', _url.searchParams);

          BrowserWindow.getAllWindows().forEach((window) => {
            const switchActiveOrg = window.id === windowId;
            window.webContents.send('org-added', org, switchActiveOrg);
          });
        } catch (ex) {
          console.warn(ex.message);
          dialog.showErrorBox('Salesforce Authorization', `There was a problem authorizing with Salesforce`);
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
      height: 220,
      center: true,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      webPreferences: { devTools: false, contextIsolation: true, sandbox: true },
    });
    App.splashWindow.loadURL(new URL(join(__dirname, '..', electronAppName, 'assets/splash.html'), 'file:').toString());
    App.splashWindow.on('close', () => {
      console.log('[RENDER][WORKER] closed');
      App.splashWindow = null;
    });

    ElectronEvents.initOrgEvents();

    App.initBackgroundWindow();

    ElectronEvents.initRequestWorkerChannelEvents(App.backgroundWindow);

    App.createWindow();

    /**
     * Handle oauth with Salesforce
     */
    // TODO: set CSP - https://www.electronjs.org/docs/latest/tutorial/security#7-define-a-content-security-policy
    //  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    //   callback({
    //     responseHeaders: {
    //       ...details.responseHeaders,
    //       'Content-Security-Policy': ['default-src \'none\'']
    //     }
    //   })
    // })

    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ['http://localhost/*', 'https://localhost/*'] },
      async (details, callback) => {
        // http://localhost/oauth/sfdc/auth?loginUrl=https%3A%2F%2Flogin.salesforce.com&clientUrl=http%3A%2F%2Flocalhost%3A4200
        if (details.url.startsWith('http://localhost/')) {
          console.log('REQUEST INTERCEPTED', details.method, details.url);
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
  }

  private static onActivate() {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (!App.windows.size) {
      App.createWindow();
    }
  }

  public static createWindow(showImmediately = false, urlHash?: string) {
    const workAreaSize = screen.getPrimaryDisplay().workAreaSize;
    let width = Math.max(1200, workAreaSize.width || 1200);
    let height = Math.max(720, workAreaSize.height || 720);

    const currentWindow = BrowserWindow.getFocusedWindow();
    if (currentWindow && !currentWindow.isFullScreen()) {
      const bounds = currentWindow.getBounds();
      width = bounds.width + 24;
      height = bounds.height + 24;
    }

    const windowConfig: Electron.BrowserWindowConstructorOptions = {
      width,
      height,
      minWidth: 1000,
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
      App.splashWindow.destroy();
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
      webPreferences: {
        nodeIntegration: true,
        devTools: true,
        backgroundThrottling: false,
        contextIsolation: false,
      },
    });

    const url = new URL(join(__dirname, '..', workerAppName, 'assets', 'index.html'), 'file:');
    App.backgroundWindow.loadURL(url.toString());

    App.backgroundWindow.on('closed', () => {
      console.log('[RENDER][WORKER] closed');
      App.backgroundWindow = null;
    });
  }

  private static handleNewWindow(event: Event, window: BrowserWindow) {
    // Splash window is handled individually
    if (window === App.splashWindow) {
      return;
    }

    if (App.isDevelopmentOrDebug()) {
      window.webContents.openDevTools();
    }

    // BG window is handled individualy
    if (window === App.backgroundWindow) {
      return;
    }

    App.windows.add(window);

    window.webContents.setWindowOpenHandler(App.handleWindowOpen(window.id));

    window.webContents.once('did-finish-load', () => {
      window.show();
      window.focus();
    });

    window.on('focus', () => {
      window.webContents.send('focused', true);
    });

    window.on('blur', () => {
      if (!window.isDestroyed()) {
        window.webContents.send('focused', false);
      }
    });

    window.on('closed', () => {
      console.log('[RENDER][MAIN] closed');
      App.windows.delete(window);
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
      console.log('window open url', url);

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
        const redirectURL = getRedirectUrl(
          windowId,
          'jetstream',
          _url.searchParams.get('loginUrl'),
          _url.searchParams.get('replaceOrgUniqueId')
        );
        console.log('[REDIRECT][SHELL]', redirectURL);
        shell.openExternal(redirectURL);
        return { action: 'deny' };
      }

      // For some reason, allowing a normal url to open caused the new window app to crash
      if ((url.startsWith('file://') || url.startsWith('http://localhost')) && _url.pathname === '/app') {
        console.log('New app window', _url.hash);
        App.createWindow(true, _url.hash);
        return { action: 'deny' };
      }

      return { action: 'allow' };
    };
  }

  static async main(app: Electron.App) {
    App.application = app;
    App.userDataPath = app.getPath('userData');
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
    App.application.on('render-process-gone', (event, webContents, { exitCode, reason }) => {
      console.log('render-process-gone', exitCode, reason);
    });
    App.application.on('child-process-gone', (event, { exitCode, reason, type, name, serviceName }) => {
      console.log('child-process-gone', exitCode, reason, type, name, serviceName);
    });
  }
}
