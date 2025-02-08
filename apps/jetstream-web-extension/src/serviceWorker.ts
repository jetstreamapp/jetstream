/* eslint-disable no-restricted-globals */
/**
 * Some parts of this file are based on the Salesforce Inspector extension for Chrome. (MIT license)
 * Credit: https://github.com/sorenkrabbe/Chrome-Salesforce-inspector/blob/master/addon/background.js
 */
/// <reference types="chrome" />
/// <reference lib="WebWorker" />
import { enableLogger, logger } from '@jetstream/shared/client-logger';
import { HTTP } from '@jetstream/shared/constants';
import { addMinutes } from 'date-fns/addMinutes';
import { fromUnixTime } from 'date-fns/fromUnixTime';
import { isAfter } from 'date-fns/isAfter';
import { jwtDecode } from 'jwt-decode';
import isNumber from 'lodash/isNumber';
import { Method } from 'tiny-request-router';
import { extensionRoutes } from './controllers/extension.routes';
import { environment } from './environments/environment';
import { initApiClient, initApiClientAndOrg } from './utils/api-client';
import {
  ApiAction,
  AUTH_CHECK_INTERVAL_MIN,
  AuthTokensStorage,
  eventPayload,
  ExtIdentifierStorage,
  GetPageUrl,
  GetSession,
  GetSfHost,
  InitOrg,
  JwtPayload,
  Logout,
  Message,
  MessageResponse,
  OrgAndSessionInfo,
  StorageTypes,
  storageTypes,
  VerifyAuth,
} from './utils/extension.types';
import './utils/serviceWorker.zip-handler';
import { handleDownloadZipFiles } from './utils/serviceWorker.zip-handler';
import { getRecordPageRecordId } from './utils/web-extension.utils';

const ctx: ServiceWorkerGlobalScope = self as any;

if (!environment.production) {
  enableLogger(true);
}

logger.log('Jetstream Service worker loaded.');

let connections: Record<string, OrgAndSessionInfo> = {};

const storageSyncCache: Partial<StorageTypes> = {};
const initStorageSyncCache = chrome.storage.sync.get().then((data) => Object.assign(storageSyncCache, data));

const storageSessionCache: Partial<{ connections: Record<string, OrgAndSessionInfo> }> = {};
const initStorageSessionCache = chrome.storage.session.get().then((data) => {
  if (data.connections) {
    connections = data.connections;
  }
  Object.assign(storageSessionCache, data);
});

chrome.runtime.onInstalled.addListener(async () => {
  logger.log('Jetstream Extension successfully installed!');
});

chrome.tabs.onActivated.addListener(async (info) => {
  // ensure connections get initialized on activation
  if (initStorageSessionCache) {
    await initStorageSessionCache;
  }
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  for (const [key, { newValue }] of Object.entries(changes)) {
    switch (namespace) {
      case 'sync': {
        if (storageTypes.authTokens.key === key) {
          storageSyncCache.authTokens = newValue as AuthTokensStorage['authTokens'];
        }
        if (storageTypes.extIdentifier.key === key) {
          storageSyncCache.extIdentifier = newValue as ExtIdentifierStorage['extIdentifier'];
        }
        break;
      }
      case 'session': {
        if (key === 'connections') {
          storageSessionCache.connections = newValue as Record<string, OrgAndSessionInfo>;
        }
        break;
      }
    }
  }
});

const SALESFORCE_DOMAINS = [
  'force.com',
  'salesforce.com',
  'salesforce-setup.com',
  'salesforce-sites.com',
  'lightning.com',
  'visualforce.com',
];

/**
 * Handle keyboard shortcuts
 */
chrome.commands.onCommand.addListener(async (command, tab) => {
  const { url } = tab;
  if (!url) {
    return;
  }

  const pageUrl = new URL(url);
  if (!SALESFORCE_DOMAINS.some((host) => pageUrl.hostname.endsWith(host))) {
    return;
  }

  const recordId = getRecordPageRecordId(pageUrl.pathname);
  if (command === 'open-view-record-modal' && !recordId) {
    return;
  }

  const orgId = await chrome.cookies
    .get({ url, name: 'sid', storeId: getCookieStoreId({ tab }) })
    .then((cookie) => cookie?.value?.split('!')?.[0]);

  if (!orgId) {
    return;
  }
  const sfHost = await Promise.all([
    chrome.cookies.getAll({ name: 'sid', domain: 'salesforce.com', secure: true, storeId: getCookieStoreId({ tab }) }),
    chrome.cookies.getAll({ name: 'sid', domain: 'cloudforce.com', secure: true, storeId: getCookieStoreId({ tab }) }),
  ]).then((results) => results.flat().find(({ value }) => value.startsWith(orgId + '!'))?.domain);

  // make sure we have this connection saved
  const connectionId = Object.keys(connections).find((key) => key.startsWith(orgId));
  if (!connectionId || !connections[connectionId]) {
    return;
  }

  switch (command) {
    case 'open-jetstream-home-page': {
      const jetstreamUrl = `${chrome.runtime.getURL('app.html')}?host=${sfHost}&url=${encodeURIComponent('/home.html')}`;
      chrome.tabs.create({ url: jetstreamUrl });
      break;
    }
    case 'open-view-record-modal': {
      const jetstreamUrl = `${chrome.runtime.getURL('app.html')}?host=${sfHost}&action=VIEW_RECORD&actionValue=${recordId}`;
      chrome.tabs.create({ url: jetstreamUrl });
      break;
    }
    default: {
      return;
    }
  }
});

/**
 * Handle authentication events from Jetstream server
 * User is redirected and authenticated on the Jetstream server
 * and tokens are sent back to the extension and stored in chrome storage
 */
chrome.runtime.onMessageExternal.addListener(async (message, sender, sendResponse) => {
  try {
    logger.log('Received message from external extension', message);
    const event = eventPayload.parse(message);
    switch (event.type) {
      case 'EXT_IDENTIFIER': {
        let result = (await chrome.storage.sync.get(storageTypes.extIdentifier.key)) as Partial<ExtIdentifierStorage>;
        if (!result.extIdentifier) {
          result = { extIdentifier: { id: crypto.randomUUID() } };
          await chrome.storage.sync.set(result);
          storageSyncCache.extIdentifier = result.extIdentifier;
        }
        if (!result.extIdentifier?.id) {
          throw new Error('Could not get or initialize extension identifier');
        }
        logger.info('Extension identifier', result.extIdentifier.id);
        sendResponse({ success: true, data: result.extIdentifier.id });
        break;
      }
      case 'TOKENS': {
        const { exp, userProfile } = jwtDecode<JwtPayload>(event.data.accessToken);
        const expiresAt = exp ? fromUnixTime(exp) : new Date();
        const authState = {
          accessToken: event.data.accessToken,
          userProfile,
          expiresAt: expiresAt.getTime(),
          lastChecked: null,
          loggedIn: true,
        };
        await chrome.storage.sync.set({ [storageTypes.authTokens.key]: authState });
        storageSyncCache.authTokens = authState;
        sendResponse({ success: true });
        break;
      }
      default: {
        sendResponse({ success: false, error: 'Unknown message type' });
      }
    }
  } catch (ex) {
    logger.error('Error handling message', ex);
    sendResponse({ success: false, error: 'Error handling message' });
  }
});

// connections seem to continually get reset
// and we cannot make async calls in the fetch event listener to get from storage
// could not find any other lifecycle callback that seemed to get called on startup
setInterval(() => {
  getConnections();
}, 1000);

async function getConnections(): Promise<Record<string, OrgAndSessionInfo>> {
  // TODO: use zod for types here
  const storage = await chrome.storage.session.get(['connections']);
  storage.connections = storage.connections || {};
  connections = storage.connections;
  return storage.connections;
}

async function setConnection(key: string, data: OrgAndSessionInfo) {
  const _connections = await getConnections();
  _connections[key] = data;
  connections = _connections;
  await chrome.storage.session.set({ connections });
}

chrome.runtime.onMessage.addListener(
  (request: Message['request'], sender: chrome.runtime.MessageSender, sendResponse: (response: MessageResponse) => void) => {
    logger.log('[SW EVENT] onMessage', request);
    switch (request.message) {
      case 'LOGOUT': {
        handleLogout(sender)
          .then((data) => handleResponse(data, sendResponse))
          .catch(handleError(sendResponse));
        return true; // indicate that sendResponse will be called asynchronously
      }
      case 'VERIFY_AUTH': {
        if (storageSyncCache.authTokens?.accessToken && !doesAuthNeedToBeChecked(storageSyncCache.authTokens)) {
          handleResponse({ hasTokens: true, loggedIn: true }, sendResponse);
          return false; // handle response synchronously
        }
        handleVerifyAuth(sender)
          .then((data) => {
            chrome.storage.session.set({ authState: data }).catch((err) => {
              logger.error('Error setting session tokens', err);
            });
            handleResponse(data, sendResponse);
          })
          .catch(handleError(sendResponse));
        return true; // indicate that sendResponse will be called asynchronously
      }
      case 'GET_SF_HOST': {
        handleGetSalesforceHostWithApiAccess(request.data, sender)
          .then((data) => handleResponse(data, sendResponse))
          .catch(handleError(sendResponse));
        return true; // indicate that sendResponse will be called asynchronously
      }
      case 'GET_SESSION': {
        handleGetSession(request.data, sender)
          .then((data) => handleResponse(data, sendResponse))
          .catch(handleError(sendResponse));
        return true; // indicate that sendResponse will be called asynchronously
      }
      case 'GET_PAGE_URL': {
        handleResponse(handleGetPageUrl(request.data.page), sendResponse);
        return true; // indicate that sendResponse will be called asynchronously
      }
      case 'INIT_ORG': {
        handleInitOrg(request.data, sender)
          .then((data) => handleResponse({ org: data.org }, sendResponse))
          .catch(handleError(sendResponse));
        return true; // indicate that sendResponse will be called asynchronously
      }
      case 'API_ACTION': {
        // Used to call API from the Salesforce page button popover (e.g. user search)
        handleApiRequestEvent(request.data, sender)
          .then((data) => handleResponse(data, sendResponse))
          .catch(handleError(sendResponse));
        return true; // indicate that sendResponse will be called asynchronously
      }
      case 'GET_CURRENT_ORG': {
        getCurrentOrg(request.data.sfHost, sender)
          .then((data) => handleResponse(data, sendResponse))
          .catch(handleError(sendResponse));
        return true; // indicate that sendResponse will be called asynchronously
      }
      default:
        logger.warn(`Unknown message`, request);
        return false;
    }
  }
);

ctx.addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url);
  const { method } = event.request;
  const pathname = url.pathname;
  if (!url.origin.startsWith('chrome-extension') || (!url.pathname.startsWith('/api') && !url.pathname.startsWith('/download-zip'))) {
    return;
  }

  logger.debug('[FETCH]', { event });

  if (url.pathname.startsWith('/download-zip')) {
    handleDownloadZipFiles(url, event, connections);
    return;
  }

  const route = extensionRoutes.match(method as Method, pathname);

  if (!route) {
    event.respondWith(new Response('Not found', { status: 404 }));
    return;
  }

  const orgHeader = event.request.headers.get(HTTP.HEADERS.X_SFDC_ID);
  const connection = connections[orgHeader || '_placeholder_'];
  if (!orgHeader || !connection) {
    event.respondWith(
      (async () => {
        return route.handler({
          event,
          params: route.params,
        });
      })()
    );
  } else {
    if (!connection) {
      event.respondWith(new Response('Not found', { status: 404 }));
      return;
    }

    const { sessionInfo, org } = connection;
    const apiConnection = initApiClient(sessionInfo);

    // TODO: use zod to validate input on web extension and server

    event.respondWith(
      (async () => {
        return route.handler({
          event,
          params: route.params,
          // user: {},
          jetstreamConn: apiConnection,
          // targetJetstreamConn
          org,
          // targetOrg
        });
      })()
    );
  }
});

/**
 * HELPER FUNCTIONS
 */

function getCookieStoreId(sender?: { tab?: chrome.tabs.Tab }) {
  return (sender?.tab as any)?.cookieStoreId;
}

const handleResponse = (data: Message['response'], sendResponse: (response: MessageResponse) => void) => {
  logger.log('RESPONSE', data);
  sendResponse({ data });
};

const handleError = (sendResponse: (response: MessageResponse) => void) => (err: unknown) => {
  logger.log('ERROR', err);
  sendResponse({
    data: null,
    error: {
      error: true,
      message: err instanceof Error ? err.message : 'An unknown error occurred',
    },
  });
};

const doesAuthNeedToBeChecked = (authTokens: AuthTokensStorage['authTokens']): boolean => {
  if (!authTokens || !authTokens.accessToken || !isNumber(authTokens.lastChecked)) {
    return true;
  }
  return isAfter(new Date(), addMinutes(new Date(authTokens.lastChecked), AUTH_CHECK_INTERVAL_MIN));
};

async function getCurrentOrg(sfHost: string, sender: chrome.runtime.MessageSender) {
  // Because we offer loginAs, we need to find the connection based on the session id
  // we cannot rely just on the host as the session id changes when using loginAs and we don't know the user id
  // so we don't have a way to associate the session to a specific user unless we were to make API calls to see what user a session belongs to
  const sessionCookie = await chrome.cookies.get({
    url: `https://${sfHost}`,
    name: 'sid',
    storeId: getCookieStoreId(sender),
  });

  if (!sessionCookie?.value) {
    throw new Error(`Session cookie not found for host ${sfHost}`);
  }

  const connection = Object.values(connections).find(({ sessionInfo }) => sessionInfo.key === sessionCookie.value);

  if (!connection) {
    throw new Error(`Connection not found for host ${sfHost}`);
  }

  return connection;
}

/**
 * HANDLERS
 */

/**
 * Verifies that user is logged in to Jetstream and has access to use the chrome extension
 */
async function handleLogout(sender: chrome.runtime.MessageSender): Promise<Logout['response']> {
  try {
    await initStorageSyncCache;
    const { authTokens, extIdentifier } = storageSyncCache;

    if (!authTokens || !extIdentifier) {
      return { hasTokens: false, loggedIn: false };
    }

    const results: { success: true } | { success: false; error: string } = await fetch(`${environment.serverUrl}/web-extension/logout`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: authTokens.accessToken, deviceId: extIdentifier.id }),
    }).then((res) =>
      res
        .json()
        .then(({ data }) => data)
        .catch(() => ({ success: false, error: 'Invalid response' }))
    );

    await chrome.storage.sync.remove(storageTypes.authTokens.key).catch((err) => {
      logger.error('Error removing tokens', err);
    });
    storageSyncCache.authTokens = undefined;

    if (!results.success) {
      logger.info('Error logging out', results.error);
      return { hasTokens: false, loggedIn: false, error: results.error };
    }
    return { hasTokens: false, loggedIn: false };
  } catch (ex) {
    logger.info('Fatal Error logging out', ex);
    chrome.storage.sync.remove(storageTypes.authTokens.key).catch((err) => {
      logger.error('Error removing tokens', err);
    });
    storageSyncCache.authTokens = undefined;
    // TODO: should we use a specific error message
    return { hasTokens: false, loggedIn: false, error: ex.message };
  }
}

/**
 * Verifies that user is logged in to Jetstream and has access to use the chrome extension
 */
async function handleVerifyAuth(sender: chrome.runtime.MessageSender): Promise<VerifyAuth['response']> {
  try {
    await initStorageSyncCache;
    const { authTokens, extIdentifier } = storageSyncCache;

    if (!authTokens || !extIdentifier) {
      return { hasTokens: false, loggedIn: false };
    }

    // Don't check for auth if we've checked recently
    if (!doesAuthNeedToBeChecked(authTokens)) {
      return { hasTokens: true, loggedIn: true };
    }

    const results: { success: true } | { success: false; error: string } = await fetch(`${environment.serverUrl}/web-extension/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: authTokens.accessToken, deviceId: extIdentifier.id }),
    }).then((res) =>
      res
        .json()
        .then(({ data }) => data)
        .catch(() => ({ success: false, error: 'Invalid response' }))
    );

    if (!results.success) {
      logger.info('Error verifying tokens', results.error);
      chrome.storage.sync.remove(storageTypes.authTokens.key).catch((err) => {
        logger.error('Error removing tokens', err);
      });
      storageSyncCache.authTokens = undefined;
      return { hasTokens: true, loggedIn: false, error: results.error };
    }
    const syncState = { ...authTokens, loggedIn: true, lastChecked: Date.now() };
    await chrome.storage.sync.set({ [storageTypes.authTokens.key]: syncState });
    storageSyncCache.authTokens = syncState;
    return { hasTokens: true, loggedIn: true };
  } catch (ex) {
    logger.info('Fatal Error verifying tokens', ex);
    chrome.storage.sync.remove(storageTypes.authTokens.key).catch((err) => {
      logger.error('Error removing tokens', err);
    });
    storageSyncCache.authTokens = undefined;
    return { hasTokens: false, loggedIn: false, error: ex.message };
  }
}

async function handleGetSalesforceHostWithApiAccess(
  { url }: GetSfHost['request']['data'],
  sender: chrome.runtime.MessageSender
): Promise<GetSfHost['response']> {
  const orgId = await chrome.cookies
    .get({ url, name: 'sid', storeId: getCookieStoreId(sender) })
    .then((cookie) => cookie?.value?.split('!')?.[0]);

  const results = await Promise.all([
    chrome.cookies.getAll({ name: 'sid', domain: 'salesforce.com', secure: true, storeId: getCookieStoreId(sender) }),
    chrome.cookies.getAll({ name: 'sid', domain: 'cloudforce.com', secure: true, storeId: getCookieStoreId(sender) }),
  ]);
  return results.flat().find(({ value }) => value.startsWith(orgId + '!'))?.domain;
}

async function handleGetSession(
  { salesforceHost }: GetSession['request']['data'],
  sender: chrome.runtime.MessageSender
): Promise<GetSession['response']> {
  const sessionCookie = await chrome.cookies.get({
    url: `https://${salesforceHost}`,
    name: 'sid',
    storeId: getCookieStoreId(sender),
  });
  if (!sessionCookie) {
    return null;
  }
  return { key: sessionCookie.value, hostname: sessionCookie.domain };
}

function handleGetPageUrl(page: string): GetPageUrl['response'] {
  return chrome.runtime.getURL(page);
}

async function handleInitOrg(
  { sessionInfo }: InitOrg['request']['data'],
  sender: chrome.runtime.MessageSender
): Promise<InitOrg['response']> {
  const response = await initApiClientAndOrg(sessionInfo);
  await setConnection(response.org.uniqueId, { sessionInfo, org: response.org });
  return response;
}

/**
 * Used to make API requests outside of the extension context (e.x. on a Salesforce page)
 */
async function handleApiRequestEvent(
  { method, sfHost, pathname, body, queryParams }: ApiAction['request']['data'],
  sender: chrome.runtime.MessageSender
) {
  const route = extensionRoutes.match(method as Method, pathname);
  if (!route) {
    throw new Error('Route not found');
  }
  const connection = await getCurrentOrg(sfHost, sender);

  queryParams = queryParams || new URLSearchParams();
  const { sessionInfo, org } = connection;
  const apiConnection = initApiClient(sessionInfo);

  const response = await route
    .handler({
      event: {
        request: {
          url: `https://${sfHost}${pathname}?${queryParams.toString()}`,
          headers: new Headers({
            'content-type': 'application/json',
          }),
          json: async () => body,
          text: async () => body,
          body,
        },
      } as FetchEvent,
      params: route.params,
      jetstreamConn: apiConnection,
      org,
    })
    .then((response) => {
      if (!response.ok) {
        return response.text().then((message) => {
          throw new Error(message);
        });
      }
      return response.json();
    });

  return response;
}
