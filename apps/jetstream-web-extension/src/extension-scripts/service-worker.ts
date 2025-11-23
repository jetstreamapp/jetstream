/**
 * Some parts of this file are based on the Salesforce Inspector extension for Chrome. (MIT license)
 * Credit: https://github.com/sorenkrabbe/Chrome-Salesforce-inspector/blob/master/addon/background.js
 */
/// <reference lib="WebWorker" />
import { enableLogger, logger } from '@jetstream/shared/client-logger';
import { addMinutes } from 'date-fns/addMinutes';
import { fromUnixTime } from 'date-fns/fromUnixTime';
import { isAfter } from 'date-fns/isAfter';
import { jwtDecode } from 'jwt-decode';
import isNumber from 'lodash/isNumber';
import browser from 'webextension-polyfill';
import { environment } from '../environments/environment';
import { initApiClientAndOrg } from '../utils/api-client';
import {
  AUTH_CHECK_INTERVAL_MIN,
  AuthTokensStorage,
  eventPayload,
  ExternalIdentifier,
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
  TokenExchange,
  VerifyAuth,
} from '../utils/extension.types';
import { getRecordPageRecordId } from '../utils/web-extension.utils';

if (!environment.production) {
  enableLogger(true);
}

logger.log('Jetstream Service worker loaded.');

let connections: Record<string, OrgAndSessionInfo> = {};

const storageSyncCache: Partial<StorageTypes> = {};
const initStorageSyncCache = browser.storage.sync.get().then((data) => Object.assign(storageSyncCache, data));

const storageSessionCache: Partial<{ connections: Record<string, OrgAndSessionInfo> }> = {};
const initStorageSessionCache = browser.storage.session.get().then((data) => {
  if (data.connections) {
    connections = data.connections as Record<string, OrgAndSessionInfo>;
  }
  Object.assign(storageSessionCache, data);
});

browser.runtime.onInstalled.addListener(async () => {
  logger.log('Jetstream Extension successfully installed!');
});

browser.tabs.onActivated.addListener(async (info) => {
  // ensure connections get initialized on activation
  if (initStorageSessionCache) {
    await initStorageSessionCache;
  }
});

browser.storage.onChanged.addListener((changes, namespace) => {
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
browser.commands.onCommand.addListener(async (command, tab) => {
  if (!tab) {
    return;
  }
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

  const orgId = await browser.cookies
    .get({ url, name: 'sid', storeId: getCookieStoreId({ tab }) })
    .then((cookie) => cookie?.value?.split('!')?.[0]);

  if (!orgId) {
    return;
  }
  const sfHost = await Promise.all([
    browser.cookies.getAll({ name: 'sid', domain: 'salesforce.com', secure: true, storeId: getCookieStoreId({ tab }) }),
    browser.cookies.getAll({ name: 'sid', domain: 'cloudforce.com', secure: true, storeId: getCookieStoreId({ tab }) }),
  ]).then((results) => results.flat().find(({ value }) => value.startsWith(orgId + '!'))?.domain);

  // make sure we have this connection saved
  const connectionId = Object.keys(connections).find((key) => key.startsWith(orgId));
  if (!connectionId || !connections[connectionId]) {
    return;
  }

  switch (command) {
    case 'open-jetstream-home-page': {
      const jetstreamUrl = `${browser.runtime.getURL('app.html')}?host=${sfHost}&url=${encodeURIComponent('/home.html')}`;
      browser.tabs.create({ url: jetstreamUrl });
      break;
    }
    case 'open-view-record-modal': {
      const jetstreamUrl = `${browser.runtime.getURL('app.html')}?host=${sfHost}&action=VIEW_RECORD&actionValue=${recordId}`;
      browser.tabs.create({ url: jetstreamUrl });
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
browser.runtime.onMessageExternal.addListener(async (message, sender, sendResponse) => {
  try {
    logger.log('Received message from external extension', message);
    const event = eventPayload.parse(message);
    switch (event.type) {
      case 'EXT_IDENTIFIER': {
        let result = (await browser.storage.sync.get(storageTypes.extIdentifier.key)) as Partial<ExtIdentifierStorage>;
        if (!result.extIdentifier) {
          result = { extIdentifier: { id: crypto.randomUUID() } };
          await browser.storage.sync.set(result);
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
        await browser.storage.sync.set({ [storageTypes.authTokens.key]: authState });
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
  const storage = await browser.storage.session.get(['connections']);
  storage.connections = storage.connections || {};
  connections = storage.connections as Record<string, OrgAndSessionInfo>;
  return storage.connections as Record<string, OrgAndSessionInfo>;
}

async function setConnection(key: string, data: OrgAndSessionInfo) {
  const _connections = await getConnections();
  _connections[key] = data;
  connections = _connections;
  await browser.storage.session.set({ connections });
}

browser.runtime.onMessage.addListener(
  (
    request: Message['request'],
    sender: browser.Runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void,
  ): true | Promise<unknown> | undefined => {
    logger.log('[SW EVENT] onMessage', request);
    switch (request.message) {
      case 'EXT_IDENTIFIER': {
        handleGetExternalIdentifier(sender)
          .then((data) => handleResponse(data, sendResponse))
          .catch(handleError(sendResponse));
        return true; // indicate that sendResponse will be called asynchronously
      }
      case 'TOKEN_EXCHANGE': {
        handleTokenExchange(request.data, sender)
          .then((data) => handleResponse(data, sendResponse))
          .catch(handleError(sendResponse));
        return true; // indicate that sendResponse will be called asynchronously
      }
      case 'LOGOUT': {
        handleLogout(sender)
          .then((data) => handleResponse(data, sendResponse))
          .catch(handleError(sendResponse));
        return true; // indicate that sendResponse will be called asynchronously
      }
      case 'VERIFY_AUTH': {
        if (storageSyncCache.authTokens?.accessToken && !doesAuthNeedToBeChecked(storageSyncCache.authTokens)) {
          handleResponse({ hasTokens: true, loggedIn: true }, sendResponse);
          return; // handle response synchronously
        }
        handleVerifyAuth(sender)
          .then((data) => {
            browser.storage.session.set({ authState: data }).catch((err) => {
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
      case 'GET_CURRENT_ORG': {
        if ('uniqueId' in request.data) {
          handleResponse(getConnection(request.data.uniqueId, sender), sendResponse);
          return; // synchronous response
        }
        getConnectionFromHost(request.data.sfHost, sender)
          .then((data) => handleResponse(data, sendResponse))
          .catch(handleError(sendResponse));
        return true; // indicate that sendResponse will be called asynchronously
      }
      default:
        logger.warn(`Unknown message`, request);
        return;
    }
  },
);

/**
 * HELPER FUNCTIONS
 */

function getCookieStoreId(sender?: { tab?: browser.Tabs.Tab }) {
  return sender?.tab?.cookieStoreId;
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

function getConnection(uniqueId: string, sender: browser.Runtime.MessageSender) {
  return connections[uniqueId || '_placeholder'];
}

async function getConnectionFromHost(sfHost: string, sender: browser.Runtime.MessageSender) {
  // Because we offer loginAs, we need to find the connection based on the session id
  // we cannot rely just on the host as the session id changes when using loginAs and we don't know the user id
  // so we don't have a way to associate the session to a specific user unless we were to make API calls to see what user a session belongs to
  const sessionCookie = await browser.cookies.get({
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

async function handleGetExternalIdentifier(sender: browser.Runtime.MessageSender): Promise<ExternalIdentifier['response']> {
  let result = (await browser.storage.sync.get(storageTypes.extIdentifier.key)) as Partial<ExtIdentifierStorage>;
  if (!result.extIdentifier) {
    result = { extIdentifier: { id: crypto.randomUUID() } };
    await browser.storage.sync.set(result);
    storageSyncCache.extIdentifier = result.extIdentifier;
  }
  if (!result.extIdentifier?.id) {
    throw new Error('Could not get or initialize extension identifier');
  }
  logger.info('Extension identifier', result.extIdentifier.id);
  return { success: true, deviceId: result.extIdentifier.id };
}

async function handleTokenExchange(
  { accessToken }: TokenExchange['request']['data'],
  sender: browser.Runtime.MessageSender,
): Promise<TokenExchange['response']> {
  const { exp, userProfile } = jwtDecode<JwtPayload>(accessToken);
  const expiresAt = exp ? fromUnixTime(exp) : new Date();
  const authState = {
    accessToken,
    userProfile,
    expiresAt: expiresAt.getTime(),
    lastChecked: null,
    loggedIn: true,
  };
  await browser.storage.sync.set({ [storageTypes.authTokens.key]: authState });
  storageSyncCache.authTokens = authState;
  return { success: true };
}

/**
 * Verifies that user is logged in to Jetstream and has access to use the browser extension
 */
async function handleLogout(sender: browser.Runtime.MessageSender): Promise<Logout['response']> {
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
        .catch(() => ({ success: false, error: 'Invalid response' })),
    );

    await browser.storage.sync.remove(storageTypes.authTokens.key).catch((err) => {
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
    browser.storage.sync.remove(storageTypes.authTokens.key).catch((err) => {
      logger.error('Error removing tokens', err);
    });
    storageSyncCache.authTokens = undefined;
    // TODO: should we use a specific error message
    return { hasTokens: false, loggedIn: false, error: ex.message };
  }
}

/**
 * Verifies that user is logged in to Jetstream and has access to use the browser extension
 */
async function handleVerifyAuth(sender: browser.Runtime.MessageSender): Promise<VerifyAuth['response']> {
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
        .catch(() => ({ success: false, error: 'Invalid response' })),
    );

    if (!results.success) {
      logger.info('Error verifying tokens', results.error);
      browser.storage.sync.remove(storageTypes.authTokens.key).catch((err) => {
        logger.error('Error removing tokens', err);
      });
      storageSyncCache.authTokens = undefined;
      return { hasTokens: true, loggedIn: false, error: results.error };
    }
    const syncState = { ...authTokens, loggedIn: true, lastChecked: Date.now() };
    await browser.storage.sync.set({ [storageTypes.authTokens.key]: syncState });
    storageSyncCache.authTokens = syncState;
    return { hasTokens: true, loggedIn: true };
  } catch (ex) {
    logger.info('Fatal Error verifying tokens', ex);
    browser.storage.sync.remove(storageTypes.authTokens.key).catch((err) => {
      logger.error('Error removing tokens', err);
    });
    storageSyncCache.authTokens = undefined;
    return { hasTokens: false, loggedIn: false, error: ex.message };
  }
}

async function handleGetSalesforceHostWithApiAccess(
  { url }: GetSfHost['request']['data'],
  sender: browser.Runtime.MessageSender,
): Promise<GetSfHost['response']> {
  const orgId = await browser.cookies
    .get({ url, name: 'sid', storeId: getCookieStoreId(sender) })
    .then((cookie) => cookie?.value?.split('!')?.[0]);

  const results = await Promise.all([
    browser.cookies.getAll({ name: 'sid', domain: 'salesforce.com', secure: true, storeId: getCookieStoreId(sender) }),
    browser.cookies.getAll({ name: 'sid', domain: 'cloudforce.com', secure: true, storeId: getCookieStoreId(sender) }),
  ]);
  return results.flat().find(({ value }) => value.startsWith(orgId + '!'))?.domain;
}

async function handleGetSession(
  { salesforceHost }: GetSession['request']['data'],
  sender: browser.Runtime.MessageSender,
): Promise<GetSession['response']> {
  const sessionCookie = await browser.cookies.get({
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
  return browser.runtime.getURL(page);
}

async function handleInitOrg(
  { sessionInfo }: InitOrg['request']['data'],
  sender: browser.Runtime.MessageSender,
): Promise<InitOrg['response']> {
  const response = await initApiClientAndOrg(sessionInfo);
  await setConnection(response.org.uniqueId, { sessionInfo, org: response.org });
  return response;
}
