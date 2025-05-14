import { HTTP } from '@jetstream/shared/constants';
import { app, BrowserWindow, nativeImage, shell } from 'electron';
import log from 'electron-log/main';
import * as path from 'path';
import { ENV } from '../config/environment';
import { initApiConnection } from '../utils/route.utils';
import { isMac } from '../utils/utils';
import { getWindowConfig } from './config';

// Optional, initialize the logger for any renderer process
log.initialize();

export class Browser {
  private browserWindow!: Electron.BrowserWindow;

  public get isVisible(): boolean {
    return this.browserWindow.isVisible();
  }

  public static get nativeIcon(): Electron.NativeImage {
    const icon = isMac() ? path.resolve(__dirname, './assets/icons/icon.icns') : path.resolve(__dirname, './assets/icons/icon.png');
    return nativeImage.createFromPath(icon);
  }

  public static create(callback?: () => void): BrowserWindow {
    const browser = new Browser();
    const _browser = browser.createBrowserWindow();
    if (callback) {
      callback();
    }
    return _browser;
  }

  public createBrowserWindow(): BrowserWindow {
    const icon = Browser.nativeIcon;
    const browserWindow = new BrowserWindow(getWindowConfig(icon));
    browserWindow.loadURL(ENV.CLIENT_URL);
    browserWindow.maximize();

    browserWindow.webContents.setWindowOpenHandler((details) => {
      const url = new URL(details.url);
      const clientUrl = new URL(ENV.CLIENT_URL);
      // Open all external links in the browser
      // FIXME: this should be more protective over what is externally opened
      if (url.hostname !== clientUrl.hostname) {
        shell.openExternal(details.url);
        return { action: 'deny' };
      }

      // Frontdoor login
      const orgUniqueId = url.searchParams.get(HTTP.HEADERS.X_SFDC_ID);
      const returnUrl = url.searchParams.get('returnUrl');
      if (url.pathname === '/static/sfdc/login' && orgUniqueId) {
        const connection = initApiConnection(orgUniqueId);
        if (connection) {
          connection.jetstreamConn.org.identity().then(() => {
            const sfdcUrl = connection.jetstreamConn.org.getFrontdoorLoginUrl(returnUrl);
            shell.openExternal(sfdcUrl);
          });
          return { action: 'deny' };
        }
      }

      return {
        action: 'allow',
        outlivesOpener: true,
        overrideBrowserWindowOptions: getWindowConfig(icon, { show: true }),
      };
    });

    this.createDock();
    // TODO: use this to change styles when app is not focused (eg. dim elements)
    // https://dev.to/vadimdemedes/making-electron-apps-feel-native-on-mac-52e8
    // browserWindow.on('focus', () => {
    //   browserWindow.webContents.send('focus');
    // });

    // browserWindow.on('blur', () => {
    //   browserWindow.webContents.send('blur');
    // });
    //   ipcRenderer.on('focus', () => {
    //     // Change UI state to focused
    // });

    // ipcRenderer.on('blur', () => {
    //     // Change UI state to unfocused
    // });

    browserWindow.once('ready-to-show', () => {
      browserWindow.show();
      browserWindow.webContents.openDevTools();
    });

    return browserWindow;
  }

  private createDock(): void {
    if (isMac() && app.dock) {
      // const dockMenu = Menu.buildFromTemplate([
      //   {
      //     label: 'New Window',
      //     click() {
      //       // TODO: create a new window
      //       // const newWindow = new Browser();
      //       // newWindow.createBrowserWindow();
      //       // newWindow.browserWindow.show();
      //       // newWindow.browserWindow.focus();
      //       console.log('New Window');
      //     },
      //   },
      // ]);
      // app.dock.setMenu(dockMenu);
      app.dock.setIcon(Browser.nativeIcon);
    }
  }
}
