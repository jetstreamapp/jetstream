/* eslint-disable @typescript-eslint/no-explicit-any */
import * as request from 'superagent'; // http://visionmedia.github.io/superagent
import * as API from '@jetstream/api-interfaces';
import { SalesforceOrg } from '@jetstream/types';
import { HTTP } from '@jetstream/shared/constants';
import { logger } from '@jetstream/shared/client-logger';

export async function handleRequest<T = any>(currRequest: request.SuperAgentRequest, org?: SalesforceOrg) {
  try {
    currRequest.set(HTTP.HEADERS.ACCEPT, HTTP.CONTENT_TYPE.JSON);
    if (org) {
      currRequest.set({
        [HTTP.HEADERS.X_SFDC_ID]: org.uniqueId || '',
        [HTTP.HEADERS.X_SFDC_LOGIN_URL]: org.loginUrl || '',
        [HTTP.HEADERS.X_SFDC_INSTANCE_URL]: org.instanceUrl || '',
        [HTTP.HEADERS.X_SFDC_ACCESS_TOKEN]: org.accessToken || '',
        [HTTP.HEADERS.X_SFDC_API_VER]: org.apiVersion || '',
        [HTTP.HEADERS.X_SFDC_NAMESPACE_PREFIX]: org.orgNamespacePrefix || '',
      });
    }
    logger.info(`[HTTP][REQUEST][${currRequest.method}]`, currRequest.url, { request: currRequest });
    const response = await currRequest;
    logger.info(`[HTTP][RESPONSE][${currRequest.method}][${response.status}]`, currRequest.url, { response: response.body });
    const body: API.RequestResult<T> = response.body;
    return body.data;
  } catch (ex) {
    logger.info('[HTTP][RESPONSE][ERROR]', ex.status, ex.message);
    let message = 'An unknown error has occurred';
    if (ex.response) {
      const response: { error: boolean; message: string } = ex.response.body;
      message = response.message || 'An unknown error has occurred';
      // take user to login page
      if (ex.response.get(HTTP.HEADERS.X_LOGOUT) === '1') {
        // LOG USER OUT
        const logoutUrl = ex.response.get(HTTP.HEADERS.X_LOGOUT_URL) || '/oauth/login';
        // eslint-disable-next-line no-restricted-globals
        location.href = logoutUrl;
      }
    }
    throw new Error(message);
  }
}
