import {
  GetPageUrlPayload,
  GetPageUrlResponse,
  GetSalesforceHostWithApiAccessPayload,
  GetSalesforceHostWithApiAccessResponse,
  GetSessionPayload,
  GetSessionPayloadResponse,
} from './extension.types';

export async function getHost(url: string) {
  try {
    return chrome.runtime
      .sendMessage<GetSalesforceHostWithApiAccessPayload, GetSalesforceHostWithApiAccessResponse>({
        message: 'getSalesforceHostWithApiAccess',
        url,
      })
      .then(({ data }) => data);
  } catch (error) {
    console.error('Error getting salesforce host', error);
    throw error;
  }
}

export async function getSession(salesforceHost: string) {
  try {
    return await chrome.runtime
      .sendMessage<GetSessionPayload, GetSessionPayloadResponse>({ message: 'getSession', salesforceHost })
      .then(({ data }) => data);
  } catch (error) {
    console.error('Error getting session', error);
    throw error;
  }
}

export async function getPageUrl(page: string) {
  try {
    return await chrome.runtime
      .sendMessage<GetPageUrlPayload, GetPageUrlResponse>({ message: 'getPageUrl', page })
      .then(({ data }) => data);
  } catch (error) {
    console.error('Error getting session', error);
    throw error;
  }
}
