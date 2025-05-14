import { HTTP, HTTP_SOURCE_DESKTOP } from '@jetstream/shared/constants';
import { ApplicationCookie } from '@jetstream/types';
import { net, protocol, session } from 'electron';
import logger from 'electron-log';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ENV, SERVER_URL } from '../config/environment';
import { initApiConnection } from '../utils/route.utils';
import { getCspPolicy } from '../utils/utils';
import { getAppData } from './persistence.service';

const cspPolicy = getCspPolicy();
const platformEventUrl = 'https://*.salesforce.com/cometd/*';
const desktopSocketRoutes = [
  `*://${SERVER_URL.hostname}/socket.io/*`, // Matches http://localhost:3333/socket.io/*
  `ws://${SERVER_URL.hostname}/socket.io/*`, // Matches ws://localhost:3333/socket.io/*
];

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, allowServiceWorkers: true },
  },
]);

/**
 * Since we are unable to set cookies for file paths, we use a custom URL to load the client application
 */
export function registerProtocols() {
  const allowedPaths = ['/assets/', '/client/', '/download-zip.sw.js'];
  protocol.handle('app', (req) => {
    const { hostname, pathname } = new URL(req.url);
    if (hostname === 'jetstream' && (req.url === ENV.CLIENT_URL || allowedPaths.some((path) => pathname.startsWith(path)))) {
      const pathToServe = join(__dirname, pathname);
      return net.fetch(pathToFileURL(pathToServe).toString());
    }

    return new Response('Bad Request', {
      status: 400,
      headers: { 'content-type': 'text/html' },
    });
  });
}

/**
 * @deprecated - this does not work for custom protocols
 * we are using ipc instead
 */
export async function setApplicationCookies() {
  // Dynamically set the domain based on the environment
  const { hostname } = new URL(ENV.CLIENT_URL);

  const appCookie: ApplicationCookie = {
    serverUrl: ENV.SERVER_URL,
    environment: ENV.ENVIRONMENT,
    defaultApiVersion: `v${ENV.SFDC_API_VERSION}`,
    google_appId: '1071580433137',
    google_apiKey: 'AIzaSyAOo0Xb3gNHDuXCDgmPJA0Jx2cpYroTXiA',
    google_clientId: '1046118608516-lstbl00607e43hev2abfh9hegbv7iuav.apps.googleusercontent.com',
  };

  await session.defaultSession.cookies.set({
    url: ENV.CLIENT_URL,
    name: HTTP.COOKIE.JETSTREAM,
    httpOnly: false,
    domain: hostname,
    path: '/',
    sameSite: 'strict',
    secure: false,
    value: `j:${encodeURIComponent(JSON.stringify(appCookie))}`,
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
