import { BrowserWindow, shell, screen, ipcMain, MessageChannelMain, session } from 'electron';
import { rendererAppName, rendererAppPort, serverAppName } from './constants';
import { environment } from '../environments/environment';
import { join, resolve } from 'path';
import { format, URL } from 'url';
import ElectronEvents from './events/electron.events';
import { exchangeCodeForToken, getRedirectUrl } from './api/oauth';
// import { ChildProcess, fork } from 'child_process';
// import { findOpenSocket } from './utils';
// import * as remote from '@electron/remote/main';

export default class App {
  // Keep a global reference of the window object, if you don't, the window will
  // be closed automatically when the JavaScript object is garbage collected.
  static mainWindow: Electron.BrowserWindow;
  static backgroundWindow: Electron.BrowserWindow;
  static application: Electron.App;
  // static serverProcess: ChildProcess;
  // static serverSocket: string;
  static BrowserWindow: typeof BrowserWindow;

  public static isDevelopmentMode() {
    const isEnvironmentSet: boolean = 'ELECTRON_IS_DEV' in process.env;
    const getFromEnvironment: boolean = parseInt(process.env.ELECTRON_IS_DEV, 10) === 1;

    return isEnvironmentSet ? getFromEnvironment : !environment.production;
  }

  private static onWindowAllClosed() {
    if (process.platform !== 'darwin') {
      App.application.quit();
    }
  }

  private static onClose() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    App.mainWindow = null;
  }

  private static onRedirect(event: any, url: string) {
    if (url !== App.mainWindow.webContents.getURL()) {
      // this is a normal external redirect, open it in a new browser window
      event.preventDefault();
      shell.openExternal(url);
    }
  }

  private static async onReady() {
    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    // ElectronEvents.listenForWebRequests();
    App.initBackgroundWindow();

    App.initMainWindow();
    App.loadMainWindow();

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
          }
        }
        callback({ cancel: false });
      }
    );

    // TODO: main thread needs to talk to all threads
    // for example, adding a salesforce org opens a second window - and results need to go to both places
    ipcMain.on('request-worker-channel', (event) => {
      console.log('request-worker-channel received');
      // For security reasons, let's make sure only the frames we expect can
      // access the worker.
      if (event.senderFrame === App.mainWindow.webContents.mainFrame) {
        // Create a new channel ...
        const { port1, port2 } = new MessageChannelMain();
        // ... send one end to the worker ...
        App.backgroundWindow.webContents.postMessage('new-client', null, [port1]);
        // ... and the other end to the main window.
        event.senderFrame.postMessage('provide-worker-channel', null, [port2]);
      }
    });
  }

  private static onActivate() {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (App.mainWindow === null) {
      App.onReady();
    }
  }

  private static initMainWindow() {
    const workAreaSize = screen.getPrimaryDisplay().workAreaSize;
    const width = Math.min(1280, workAreaSize.width || 1280);
    const height = Math.min(720, workAreaSize.height || 720);

    // Create the browser window.
    App.mainWindow = new BrowserWindow({
      width: width,
      height: height,
      show: false,
      webPreferences: {
        contextIsolation: true,
        // nodeIntegration: true,
        backgroundThrottling: false,
        preload: join(__dirname, 'main.preload.ts.js'),
      },
    });
    App.mainWindow.setMenu(null);
    App.mainWindow.center();

    // if main window is ready to show, close the splash window and show the main window
    App.mainWindow.once('ready-to-show', () => {
      App.mainWindow.show();
    });

    // handle all external redirects in a new browser window
    // App.mainWindow.webContents.on('will-navigate', App.onRedirect);
    // App.mainWindow.webContents.on('new-window', (event, url, frameName, disposition, options) => {
    //     App.onRedirect(event, url);
    // });

    // Emitted when the window is closed.
    App.mainWindow.on('closed', () => {
      // Dereference the window object, usually you would store windows
      // in an array if your app supports multi windows, this is the time
      // when you should delete the corresponding element.
      App.mainWindow = null;
    });
  }

  /**
   * Create background window for the server in dev mode
   * allows refreshing to get new version of server code without full re-start
   * @param socketName
   */
  private static initBackgroundWindow() {
    // remote.initialize();

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

    const url = new URL(join(__dirname, '..', serverAppName, 'assets', 'index.html'), 'file:');
    App.backgroundWindow.loadURL(url.toString());

    // TODO: only for dev
    App.backgroundWindow.webContents.openDevTools();

    App.backgroundWindow.on('closed', () => {
      App.backgroundWindow = null;
    });
  }

  private static loadMainWindow() {
    // load the index.html of the app.
    if (!App.application.isPackaged) {
      App.mainWindow.loadURL(`http://localhost:${rendererAppPort}/app`);
    } else {
      const url = new URL(join(__dirname, '..', rendererAppName, 'index.html'), 'file:');
      App.mainWindow.loadURL(url.toString());
    }

    // TODO: only under debug condition
    App.mainWindow.webContents.openDevTools();

    App.mainWindow.webContents.on('did-finish-load', () => {
      //
    });
  }

  static async main(app: Electron.App, browserWindow: typeof BrowserWindow) {
    // we pass the Electron.App object and the
    // Electron.BrowserWindow into this function
    // so this class has no dependencies. This
    // makes the code easier to write tests for

    App.BrowserWindow = browserWindow;
    App.application = app;

    // http://localhost/oauth/sfdc/callback

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
    App.application.on('before-quit', () => {
      // if (App.serverProcess) {
      //   App.serverProcess.kill();
      //   App.serverProcess = null;
      // }
    });
  }
}
