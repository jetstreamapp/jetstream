import { HTTP } from '@jetstream/shared/constants';
import { app, BrowserWindow, clipboard, Menu, nativeImage } from 'electron';
import log from 'electron-log/main';
import * as path from 'path';
import { ENV } from '../config/environment';
import { initApiConnection } from '../utils/route.utils';
import { openExternalSafe } from '../utils/url.utils';
import { isMac } from '../utils/utils';
import { getWindowConfig } from './config';

log.transports.file.level = ENV.LOG_LEVEL;
log.initialize({
  includeFutureSessions: false,
});

const clientUrl = new URL(ENV.CLIENT_URL);

export class Browser {
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

    browserWindow.webContents.on('context-menu', this.createContextMenu(browserWindow));

    browserWindow.webContents.setWindowOpenHandler((details) => {
      const url = new URL(details.url);

      // Frontdoor login
      const orgUniqueId = url.searchParams.get(HTTP.HEADERS.X_SFDC_ID);
      const returnUrl = url.searchParams.get('returnUrl');
      if (url.pathname === '/static/sfdc/login' && orgUniqueId) {
        const connection = initApiConnection(orgUniqueId);
        if (connection) {
          connection.jetstreamConn.org.identity().then(() => {
            const sfdcUrl = connection.jetstreamConn.org.getFrontdoorLoginUrl(returnUrl);
            openExternalSafe(sfdcUrl);
          });
          return { action: 'deny' };
        }
      }

      // Open all external links in the browser (only safe schemes are actually opened).
      // Use a full origin check (protocol + host) like will-navigate below: with an
      // app://jetstream/... CLIENT_URL the host alone is just "jetstream", so a matching-host
      // link on another scheme must not be treated as internal.
      const isSameAppOrigin = url.protocol === clientUrl.protocol && url.host === clientUrl.host;
      if (!isSameAppOrigin) {
        openExternalSafe(details.url);
        return { action: 'deny' };
      }

      return {
        action: 'allow',
        outlivesOpener: true,
        overrideBrowserWindowOptions: getWindowConfig(icon, { show: true }),
      };
    });

    // Prevent the renderer from navigating the privileged window away from the app.
    // Anything cross-origin is blocked and, if it uses a safe scheme, handed to the default browser
    // instead. In-app (SPA) routing uses the history API and does not trigger these events.
    const handleWindowNavigation = (event: Electron.Event, targetUrl: string) => {
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(targetUrl);
      } catch {
        event.preventDefault();
        return;
      }
      const isSameAppOrigin = parsedUrl.protocol === clientUrl.protocol && parsedUrl.host === clientUrl.host;
      if (!isSameAppOrigin) {
        event.preventDefault();
        openExternalSafe(targetUrl);
      }
    };
    browserWindow.webContents.on('will-navigate', handleWindowNavigation);
    browserWindow.webContents.on('will-redirect', handleWindowNavigation);

    this.createDock();

    browserWindow.once('ready-to-show', () => {
      browserWindow.show();
      if (ENV.ENVIRONMENT === 'development') {
        browserWindow.webContents.openDevTools();
      }
    });

    return browserWindow;
  }

  private createDock(): void {
    if (isMac() && app.dock) {
      app.dock.setIcon(Browser.nativeIcon);
    }
  }

  private createContextMenu(browserWindow: BrowserWindow) {
    return (
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      event: {
        preventDefault: () => void;
        readonly defaultPrevented: boolean;
      },
      properties: Electron.ContextMenuParams,
    ) => {
      const menuItems: Parameters<typeof Menu.buildFromTemplate>[0] = [];

      if (properties.isEditable) {
        menuItems.push({ label: 'Cut', role: 'cut' }, { label: 'Copy', role: 'copy' }, { label: 'Paste', role: 'paste' });
      }

      if (properties.selectionText) {
        menuItems.push({
          label: 'Copy Selection',
          click: () => {
            clipboard.writeText(properties.selectionText);
          },
        });
      }

      if (ENV.ENVIRONMENT === 'development') {
        menuItems.push(
          { type: 'separator' },
          {
            label: 'Reload',
            click: () => browserWindow.webContents.reload(),
          },
          {
            id: 'inspect',
            label: 'Inspect Element',
            click() {
              browserWindow.webContents.inspectElement(properties.x, properties.y);

              if (browserWindow.webContents.isDevToolsOpened()) {
                browserWindow.webContents.devToolsWebContents?.focus();
              }
            },
          },
        );
      }

      if (menuItems.length === 0) {
        menuItems.push({ label: 'No actions available', enabled: false });
      }

      const menu = Menu.buildFromTemplate(menuItems);
      menu.popup({ window: browserWindow });
    };
  }
}
