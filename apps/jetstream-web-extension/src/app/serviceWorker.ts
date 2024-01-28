/* eslint-disable no-restricted-globals */
/**
 * This file is based on the Salesforce Inspector extension for Chrome. (MIT license)
 * Credit: https://github.com/sorenkrabbe/Chrome-Salesforce-inspector/blob/master/addon/background.js
 */
/// <reference types="chrome" />
/// <reference lib="WebWorker" />
import '@cooby/crx-load-script-webpack-plugin/lib/loadScript'; // TODO: remove in production build
import { HTTP } from '@jetstream/shared/constants';
import { ensureBoolean } from '@jetstream/shared/utils';
import { GetPageUrl, GetSession, GetSfHost, InitOrg, Message, MessageResponse } from './extension.types';
import { initializeStorageWithDefaults } from './storage';
import { ApiClient, initApiClient } from './utils/api.utils';

console.log('Jetstream Service worker loaded.');

const connections = new Map<string, ApiClient>();

chrome.runtime.onInstalled.addListener(async () => {
  await initializeStorageWithDefaults({});
  console.log('Jetstream Extension successfully installed!');
});

chrome.runtime.onMessage.addListener(
  (request: Message['request'], sender: chrome.runtime.MessageSender, sendResponse: (response: MessageResponse) => void) => {
    console.log('MESSAGE', request);
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
            handleResponse(data, sendResponse);
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

self.addEventListener('fetch', (event: FetchEvent) => {
  console.log('[FETCH]', event);
  const url = new URL(event.request.url);
  const pathname = url.pathname;
  if (!url.origin.startsWith('chrome-extension') || !url.pathname.startsWith('/api')) {
    return;
  }
  const orgHeader = event.request.headers.get(HTTP.HEADERS.X_SFDC_ID);
  if (!orgHeader) {
    return;
  }
  const apiClient = connections.get(orgHeader)!;
  if (!apiClient) {
    event.respondWith(new Response('Not found', { status: 404 }));
    return;
  }

  event.respondWith(
    (async () => {
      const router = {
        '/api/describe': {
          handler: () => apiClient.describe(ensureBoolean(url.searchParams.get('isTooling'))),
        },
        '/api/describe/:sobject': {
          handler: (sobject: string) => apiClient.describeSobject(sobject, ensureBoolean(url.searchParams.get('isTooling'))),
        },
        '/api/query': {
          handler: async () =>
            apiClient.query(
              (await event.request.json()).query,
              ensureBoolean(url.searchParams.get('isTooling')),
              ensureBoolean(url.searchParams.get('includeDeletedRecords'))
            ),
        },
        '/api/query-more': {
          handler: async () => apiClient.queryMore(url.searchParams.get('nextRecordsUrl')!),
        },
        '/api/record/:retrieve/:sobject': {
          handler: async (operation: string, sobject: string) => {
            const { ids, records } = await event.request.json();
            return apiClient.recordOperation({
              operation,
              sobject,
              ids,
              records,
              externalId: url.searchParams.get('externalId'),
              allOrNone: ensureBoolean(url.searchParams.get('allOrNone')),
              isTooling: ensureBoolean(url.searchParams.get('isTooling')),
            });
          },
        },
        '/api/request': {
          handler: async () => apiClient.manualRequest(await event.request.json()),
        },
        '/api/request-manual': {
          handler: async () => apiClient.manualRequest(await event.request.json()),
        },
        // /services/data/v54.0/ui-api/object-info/Account/picklist-values/012000000000000AAA
        // http://localhost:3333/static/sfdc/login
        // /api/bulk
        // /api/record/retrieve/Account -> {"ids":"0016g00000ETu0HAAT"}
        // /api/request
        // /api/request-manual
      } as const;

      if (pathname in router) {
        const response = await router[pathname].handler();
        return new Response(JSON.stringify(response), { headers: { 'Content-Type': 'application/json' }, status: 200 });
      } else {
        let match = pathname.match(/^\/api\/describe\/(.+)$/);
        if (match) {
          const response = await router['/api/describe/:sobject'].handler(match[1]);
          return new Response(JSON.stringify(response), { headers: { 'Content-Type': 'application/json' }, status: 200 });
        }

        match = pathname.match(/^\/api\/record\/([^/]+)\/([^/]+)$/);
        if (match) {
          const response = await router['/api/record/:retrieve/:sobject'].handler(match[1], match[2]);
          return new Response(JSON.stringify(response), { headers: { 'Content-Type': 'application/json' }, status: 200 });
        }
      }
      console.log('UNKNOWN PATH', url.pathname);
      return fetch(event.request);
    })()
  );
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
  sendResponse({ data: null });
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
  const apiClient = await initApiClient(sessionInfo);
  connections.set(apiClient.org.uniqueId, apiClient);
  return apiClient;
}
