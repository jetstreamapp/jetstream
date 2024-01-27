/* eslint-disable no-restricted-globals */
/**
 * This file is based on the Salesforce Inspector extension for Chrome. (MIT license)
 * Credit: https://github.com/sorenkrabbe/Chrome-Salesforce-inspector/blob/master/addon/background.js
 */
// import 'chrome-types';
/// <reference types="chrome"/>
import { MessagePayload, MessageResponse } from './extension.types';
import { initializeStorageWithDefaults } from './storage';

console.log('Jetstream Service worker loaded.');

function getCookieStoreId(sender: chrome.runtime.MessageSender) {
  return (sender?.tab as any)?.cookieStoreId;
}

const handleError = (sendResponse: (response: MessageResponse) => void) => (err: unknown) => {
  console.log('ERROR', err);
  sendResponse({ data: null });
};

chrome.runtime.onInstalled.addListener(async () => {
  await initializeStorageWithDefaults({});
  console.log('Jetstream Extension successfully installed!');
});

chrome.runtime.onMessage.addListener((request: MessagePayload, sender, sendResponse: (response: MessageResponse) => void) => {
  console.log('MESSAGE', { request, sender });
  // Perform cookie operations in the background page, because not all foreground pages have access to the cookie API.
  // Firefox does not support incognito split mode, so we use sender.tab.cookieStoreId to select the right cookie store.
  // Chrome does not support sender.tab.cookieStoreId, which means it is undefined, and we end up using the default cookie store according to incognito split mode.
  if (request.message === 'getSalesforceHostWithApiAccess') {
    // When on a *.visual.force.com page, the session in the cookie does not have API access,
    // so we read the corresponding session from *.salesforce.com page.
    // The first part of the session cookie is the OrgID,
    // which we use as key to support being logged in to multiple orgs at once.
    // http://salesforce.stackexchange.com/questions/23277/different-session-ids-in-different-contexts
    // There is no straight forward way to unambiguously understand if the user authenticated against salesforce.com or cloudforce.com
    // (and thereby the domain of the relevant cookie) cookie domains are therefore tried in sequence.
    chrome.cookies
      .get({ url: request.url, name: 'sid', storeId: getCookieStoreId(sender) })
      .then((cookie) => cookie?.value?.split('!')?.[0])
      .then(async (orgId) =>
        Promise.all([
          chrome.cookies.getAll({ name: 'sid', domain: 'salesforce.com', secure: true, storeId: getCookieStoreId(sender) }),
          chrome.cookies.getAll({ name: 'sid', domain: 'cloudforce.com', secure: true, storeId: getCookieStoreId(sender) }),
        ]).then((results) => results.flat().find(({ value }) => value.startsWith(orgId + '!'))?.domain)
      )
      .then((domainWithApiAccess) => sendResponse({ data: domainWithApiAccess }))
      .catch(handleError(sendResponse));
    return true; // indicate that sendResponse will be called asynchronously
  } else if (request.message === 'getSession') {
    chrome.cookies
      .get({ url: `https://${request.salesforceHost}`, name: 'sid', storeId: getCookieStoreId(sender) })
      .then((sessionCookie) => {
        if (!sessionCookie) {
          return sendResponse({ data: null });
        }
        sendResponse({ data: { key: sessionCookie.value, hostname: sessionCookie.domain } });
      })
      .catch(handleError(sendResponse));
    return true; // Tell Chrome that we want to call sendResponse asynchronously.
  } else if (request.message === 'getPageUrl') {
    sendResponse({ data: chrome.runtime.getURL('query.html') });
    return true; // Tell Chrome that we want to call sendResponse asynchronously.
  }
  return false;
});
