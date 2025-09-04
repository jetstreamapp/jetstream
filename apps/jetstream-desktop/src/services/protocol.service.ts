import { DesktopActionLoadRecord } from '@jetstream/desktop/types';
import { HTTP, HTTP_SOURCE_DESKTOP } from '@jetstream/shared/constants';
import { getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { app, net, protocol, session } from 'electron';
import logger from 'electron-log';
import { existsSync, readFileSync } from 'node:fs';
import path, { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Browser } from '../browser/browser';
import { ENV, SERVER_URL } from '../config/environment';
import { initApiConnection } from '../utils/route.utils';
import { getCspPolicy } from '../utils/utils';
import { getAppData, getUserPreferences } from './persistence.service';

const cspPolicy = getCspPolicy();
const platformEventUrl = 'https://*.salesforce.com/cometd/*';
const desktopSocketRoutes = [
  `*://${SERVER_URL.hostname}/socket.io/*`, // Matches http://localhost:3333/socket.io/*
  `ws://${SERVER_URL.hostname}/socket.io/*`, // Matches ws://localhost:3333/socket.io/*
];

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, allowServiceWorkers: true, bypassCSP: true },
  },
]);

/**
 * Since we are unable to set cookies for file paths, we use a custom URL to load the client application
 */
export function registerProtocols() {
  const allowedPaths = ['/assets/', '/client/', '/download-zip.sw.js'];
  protocol.handle('app', (req) => {
    const { hostname, pathname, searchParams } = new URL(req.url);
    // Fetch files
    if (hostname === 'jetstream' && (req.url === ENV.CLIENT_URL || allowedPaths.some((path) => pathname.startsWith(path)))) {
      const pathToServe = join(__dirname, pathname);
      return net.fetch(pathToFileURL(pathToServe).toString());
      // Handle streaming file downloads
    } else if (hostname === 'jetstream' && pathname === '/api/file/stream-download') {
      const uniqueId = searchParams.get(HTTP.HEADERS.X_SFDC_ID);
      const url = searchParams.get('url');
      if (uniqueId && url) {
        const result = initApiConnection(uniqueId);
        if (result) {
          const { jetstreamConn } = result;
          return jetstreamConn!.org.streamDownload(url as string).then((results) => new Response(results));
        }
      }
    }

    return new Response('Bad Request', {
      status: 400,
      headers: { 'content-type': 'text/html' },
    });
  });
}

export function registerWebRequestHandlers() {
  // Only handles platform events routes
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: [platformEventUrl, ...desktopSocketRoutes] }, async (details, callback) => {
    const sourceUrl = new URL(details.url);
    const requestHeaders = details.requestHeaders || {};
    if (sourceUrl.hostname.endsWith('.salesforce.com') && sourceUrl.pathname.startsWith('/cometd/')) {
      const url = new URL(details.url);
      const uniqueId = url.searchParams.get(HTTP.HEADERS.X_SFDC_ID);
      if (uniqueId) {
        const result = initApiConnection(uniqueId);
        if (result) {
          const { jetstreamConn } = result;
          requestHeaders.Authorization = `Bearer ${jetstreamConn.sessionInfo.accessToken}`;
        }
      }
    }
    if (details.url.includes('/socket.io/')) {
      const { accessToken, deviceId } = getAppData();
      if (accessToken) {
        requestHeaders[HTTP.HEADERS.X_SOURCE] = HTTP_SOURCE_DESKTOP;
        requestHeaders[HTTP.HEADERS.AUTHORIZATION] = `Bearer ${accessToken}`;
        requestHeaders[HTTP.HEADERS.X_EXT_DEVICE_ID] = deviceId;
      }
    }
    callback({ requestHeaders });
  });

  // Add CORS to all requests and CORS for platform events
  // Having multiple onHeadersReceived handlers is not supported even with different filters
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };

    try {
      const targetUrl = new URL(details.url);
      const clientUrl = new URL(ENV.CLIENT_URL);
      // Node treats custom protocols as 'null'
      const origin = clientUrl.origin !== 'null' ? clientUrl.origin : `${clientUrl.protocol}//${clientUrl.hostname}`;

      // Set CSP
      responseHeaders['Content-Security-Policy'] = [cspPolicy];
      if (
        // Handle PlatformEvent CORS - allow connecting directly to Salesforce
        (targetUrl.hostname.endsWith('.salesforce.com') && targetUrl.pathname.startsWith('/cometd/')) ||
        // Allow access to server desktop-app routes CORS
        (targetUrl.hostname === SERVER_URL.hostname && targetUrl.pathname.startsWith('/desktop-app/')) ||
        // Allow access to data sync socket requests CORS
        (targetUrl.hostname === SERVER_URL.hostname && targetUrl.pathname.startsWith('/socket.io/'))
      ) {
        // const origin = new URL(details.referrer).origin;
        responseHeaders['Access-Control-Allow-Origin'] = [origin];
        responseHeaders['Access-Control-Allow-Credentials'] = ['true'];
        responseHeaders['Access-Control-Allow-Headers'] = [
          'accept',
          'authorization',
          'content-type',
          'cookie',
          'referer',
          'user-agent',
          'x-sfdc-api-version',
        ];
        responseHeaders['Access-Control-Allow-Methods'] = ['GET, POST, PUT, DELETE, OPTIONS'];
        responseHeaders['Access-Control-Expose-Headers'] = ['content-type', 'accept', 'set-cookie', 'cookie'];
      }
    } catch (ex) {
      logger.warn('Error parsing URL in onHeadersReceived:', ex);
      logger.warn(JSON.stringify(details));
    }

    callback({ responseHeaders });
  });
}

export function registerDownloadHandler() {
  session.defaultSession.on('will-download', (event, item, webContents) => {
    const downloadPreferences = getUserPreferences().fileDownload;
    if (
      !downloadPreferences ||
      !downloadPreferences.omitPrompt ||
      !downloadPreferences.downloadPath ||
      !existsSync(downloadPreferences.downloadPath)
    ) {
      return;
    }
    const downloadFilename = join(downloadPreferences.downloadPath, item.getFilename());
    item.setSavePath(downloadFilename);
    item.once('done', (event, state) => {
      if (state === 'completed') {
        logger.info(`Download completed: ${item.getSavePath()}`);
        app.addRecentDocument(downloadFilename);
      }
    });
  });
}

export function registerFileOpenHandler() {
  app.on('open-file', async (event, filePath) => {
    event.preventDefault();
    function isAllowedExtension(extension?: string): boolean {
      switch (extension) {
        case '.csv':
        case '.xlsx':
          return true;
        default:
          return false;
      }
    }
    try {
      const name = path.basename(filePath);
      const extension = path.extname(name).toLowerCase();
      if (!isAllowedExtension(extension)) {
        return;
      }
      const fileData: DesktopActionLoadRecord = {
        action: 'LOAD_RECORD',
        payload: {
          fileContent: {
            content: readFileSync(filePath).buffer as ArrayBuffer,
            filename: name,
            extension,
            isPasteFromClipboard: false,
          },
        },
      };

      const newWindow = Browser.create();
      if (newWindow.webContents?.isLoading()) {
        newWindow.webContents.once('did-finish-load', () => {
          newWindow.webContents.send('action', fileData);
        });
      } else if (newWindow) {
        newWindow.webContents.send('file-dropped', fileData);
      }
    } catch (ex) {
      logger.error('Error opening file:', getErrorMessageAndStackObj(ex));
    }
  });
}
