/* eslint-disable no-restricted-globals */
/**
 * This file is based on the Salesforce Inspector extension for Chrome. (MIT license)
 * Credit: https://github.com/sorenkrabbe/Chrome-Salesforce-inspector/blob/master/addon/background.js
 */
/// <reference types="chrome" />
/// <reference lib="WebWorker" />
import { logger } from '@jetstream/shared/client-logger';
import { HTTP } from '@jetstream/shared/constants';
import { GetPageUrl, GetSession, GetSfHost, InitOrg, Message, MessageResponse, OrgAndSessionInfo } from '@jetstream/web-extension-utils';
import { Method } from 'tiny-request-router';
import { extensionRoutes } from './controllers/extension.routes';
import { initializeStorageWithDefaults } from './storage';
import { initApiClient, initApiClientAndOrg } from './utils/api-client';

const ctx: ServiceWorkerGlobalScope = self as any;

console.log('Jetstream Service worker loaded.');

let connections: Record<string, OrgAndSessionInfo> = {};

// connections seem to continually get reset
// and we cannot make async calls in the fetch event listener to get from storage
// could not find any other lifecycle callback that seemed to get called on startup
setInterval(() => {
  getConnections();
}, 1000);

async function getConnections(): Promise<Record<string, OrgAndSessionInfo>> {
  const storage = await chrome.storage.local.get(['connections']);
  storage.connections = storage.connections || {};
  connections = storage.connections;
  return storage.connections;
}

async function setConnection(key: string, data: OrgAndSessionInfo) {
  const _connections = await getConnections();
  _connections[key] = data;
  connections = _connections;
  await chrome.storage.local.set({ connections });
}

chrome.runtime.onInstalled.addListener(async () => {
  await initializeStorageWithDefaults({});
  console.log('Jetstream Extension successfully installed!');
});

chrome.runtime.onMessage.addListener(
  (request: Message['request'], sender: chrome.runtime.MessageSender, sendResponse: (response: MessageResponse) => void) => {
    console.log('[SW EVENT] onMessage', request);
    getConnections(); // ensure connections get initialized
    switch (request.message) {
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
          .then((data) => {
            handleResponse({ org: data.org }, sendResponse);
          })
          .catch(handleError(sendResponse));
        return true; // indicate that sendResponse will be called asynchronously
      }
      default:
        console.warn(`Unknown message`, request);
        return false;
    }
  }
);

ctx.addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url);
  const { method } = event.request;
  const pathname = url.pathname;
  if (!url.origin.startsWith('chrome-extension') || !url.pathname.startsWith('/api')) {
    return;
  }

  logger.debug('[FETCH]', { event });
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

function getCookieStoreId(sender: chrome.runtime.MessageSender) {
  return (sender?.tab as any)?.cookieStoreId;
}

const handleResponse = (data: Message['response'], sendResponse: (response: MessageResponse) => void) => {
  console.log('RESPONSE', data);
  sendResponse({ data });
};

const handleError = (sendResponse: (response: MessageResponse) => void) => (err: unknown) => {
  console.log('ERROR', err);
  sendResponse({
    data: null,
    error: {
      error: true,
      message: err instanceof Error ? err.message : 'An unknown error occurred',
    },
  });
};

/**
 * HANDLERS
 */

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
