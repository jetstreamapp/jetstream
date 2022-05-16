import { BrowserWindow, ipcMain, MessageChannelMain, screen, session, shell } from 'electron';
import { join, resolve } from 'path';
import { URL } from 'url';
import { environment } from '../environments/environment';
import { exchangeCodeForToken, getRedirectUrl } from './api/oauth';
import { rendererAppName, rendererAppPort, workerAppName } from './constants';

// TODO: move to constants
const isMac = process.platform === 'darwin';

// TODO: move magic strings etc.. to constants

// TODO: some of this stuff should be moved out of this file into other files (e.x. events)

export default class App {
  // Keep a global reference of the window object, if you don't, the window will
  // be closed automatically when the JavaScript object is garbage collected.
  // static mainWindow: Electron.BrowserWindow;
  static windows: Electron.BrowserWindow[] = [];
  static backgroundWindow: Electron.BrowserWindow;
  static application: Electron.App;
  static tray: Electron.Tray;

  public static isDevelopmentMode() {
    const isEnvironmentSet: boolean = 'ELECTRON_IS_DEV' in process.env;
    const getFromEnvironment: boolean = parseInt(process.env.ELECTRON_IS_DEV, 10) === 1;

    return isEnvironmentSet ? getFromEnvironment : !environment.production;
  }

  private static onWindowAllClosed() {
    if (isMac) {
      App.application.quit();
    }
  }

  // private static onClose() {
  //   // Dereference the window object, usually you would store windows
  //   // in an array if your app supports multi windows, this is the time
  //   // when you should delete the corresponding element.
  //   App.mainWindow = null;
  // }

  // private static onRedirect(event: any, url: string) {
  //   if (url !== App.mainWindow.webContents.getURL()) {
  //     // this is a normal external redirect, open it in a new browser window
  //     event.preventDefault();
  //     shell.openExternal(url);
  //   }
  // }

  private static async onReady() {
    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.

    App.initBackgroundWindow();

    // App.initMainWindow();
    // App.loadMainWindow();
    App.createWindow();

    /**
     * Handle oauth with Salesforce
     */
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ['http://localhost/*', 'https://localhost/*'] },
      async (details, callback) => {
        // http://localhost/oauth/sfdc/auth?loginUrl=https%3A%2F%2Flogin.salesforce.com&clientUrl=http%3A%2F%2Flocalhost%3A4200
        if (details.url.startsWith('http://localhost/')) {
          console.log('REQUEST INTERCEPTED', details.method, details.url);
          const url = new URL(details.url);

          if (url.pathname === '/oauth/sfdc/auth') {
            const redirectURL = getRedirectUrl(url.searchParams.get('loginUrl'), url.searchParams.get('replaceOrgUniqueId'));
            console.log('[REDIRECT]', redirectURL);
            callback({ cancel: false, redirectURL });
            return;
          } else if (url.pathname === '/oauth/sfdc/callback') {
            /**
             * get org
             * emit to renderer
             * close the window used for auth (how do we know which one?)
             *
             * TODO: handle errors
             */
            const org = await exchangeCodeForToken(url.searchParams);

            callback({ cancel: true });

            BrowserWindow.getAllWindows().forEach((window) => {
              if (window.webContents.id === details.webContentsId) {
                window.close();
              } else {
                window.webContents.send('org-added', org);
              }
            });
            return;
          } else if (url.pathname === '/static/sfdc/login') {
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

    // TODO: main thread needs to talk to all threads
    // for example, adding a salesforce org opens a second window - and results need to go to both places
    ipcMain.on('request-worker-channel', (event) => {
      console.log('request-worker-channel received');
      // For security reasons, let's make sure only the frames we expect can
      // access the worker.
      if (event.senderFrame !== App.backgroundWindow.webContents.mainFrame) {
        // Create a new channel ...
        const { port1, port2 } = new MessageChannelMain();
        const { port1: loadWorkerPort1, port2: loadWorkerPort2 } = new MessageChannelMain();
        const { port1: queryWorkerPort1, port2: queryWorkerPort2 } = new MessageChannelMain();
        const { port1: jobsWorkerPort1, port2: jobsWorkerPort2 } = new MessageChannelMain();
        // ... send one end to the worker ...
        App.backgroundWindow.webContents.postMessage('new-client', null, [port1, loadWorkerPort1, queryWorkerPort1, jobsWorkerPort1]);
        // ... and the other end to the main window.
        event.senderFrame.postMessage('provide-worker-channel', null, [port2, loadWorkerPort2, queryWorkerPort2, jobsWorkerPort2]);
      }
    });

    ipcMain.on('sfdc-frontdoor-login', (event, url) => shell.openExternal(url));
  }

  private static onActivate() {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (!App.windows.length) {
      App.createWindow();
    }
  }

  public static createWindow(showImmediately = false) {
    const workAreaSize = screen.getPrimaryDisplay().workAreaSize;
    const width = Math.max(1000, Math.min(1280, workAreaSize.width || 1280));
    const height = Math.min(720, workAreaSize.height || 720);

    const windowConfig: Electron.BrowserWindowConstructorOptions = {
      width: width,
      height: height,
      minWidth: 1000,
      show: showImmediately,
      titleBarStyle: 'hidden',
      titleBarOverlay: true,
      webPreferences: {
        contextIsolation: true,
        // nodeIntegration: true,
        backgroundThrottling: false,
        preload: join(__dirname, 'main.preload.js'),
      },
    };

    const window = new BrowserWindow(windowConfig);
    App.windows.push(window);
    window.setMenu(null);

    window.once('ready-to-show', () => window.show());
    window.on('closed', () => App.windows.filter((win) => win !== window));

    window.webContents.setWindowOpenHandler(({ url }) => {
      console.log('window open url', url);
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

      if (url.startsWith('file://') || url.startsWith('http://localhost')) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            ...windowConfig,
            show: true,
          },
        };
      }

      return { action: 'allow' };
    });

    if (!App.application.isPackaged) {
      window.loadURL(`http://localhost:${rendererAppPort}/app`);
    } else {
      const url = new URL(join(__dirname, '..', rendererAppName, 'index.html'), 'file:');
      window.loadURL(url.toString());
    }

    // TODO: only under debug condition
    window.webContents.openDevTools();

    // window.webContents.on('did-finish-load', () => {
    //   //
    // });

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
      height: 500,
      show: true, // TODO: hide in production but allow debug flag to show
      webPreferences: {
        nodeIntegration: true,
        devTools: true,
        // maybe todo?
        contextIsolation: false,
      },
    });

    const url = new URL(join(__dirname, '..', workerAppName, 'assets', 'index.html'), 'file:');
    App.backgroundWindow.loadURL(url.toString());

    // TODO: only for dev
    App.backgroundWindow.webContents.openDevTools();

    App.backgroundWindow.on('closed', () => {
      App.backgroundWindow = null;
    });
  }

  static async main(app: Electron.App) {
    App.application = app;

    // Register "jetstream://" protocol for opening links
    if (process.defaultApp) {
      if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('jetstream', process.execPath, [resolve(process.argv[1])]);
      }
    } else {
      app.setAsDefaultProtocolClient('jetstream');
    }

    App.application.on('window-all-closed', App.onWindowAllClosed); // Quit when all windows are closed.
    App.application.on('ready', App.onReady); // App is ready to load data
    App.application.on('activate', App.onActivate); // App is activated
    // ensure server process is killed
    // App.application.on('before-quit', () => {
    //   if (App.serverProcess) {
    //     App.serverProcess.kill();
    //     App.serverProcess = null;
    //   }
    // });
  }
}
