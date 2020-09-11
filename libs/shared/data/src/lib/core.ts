/* eslint-disable @typescript-eslint/no-explicit-any */
import * as request from 'superagent'; // http://visionmedia.github.io/superagent
import * as API from '@jetstream/api-interfaces';
import { SalesforceOrgUi } from '@jetstream/types';
import { HTTP, ERROR_MESSAGES } from '@jetstream/shared/constants';
import { logger } from '@jetstream/shared/client-logger';
import { errorMiddleware } from './middleware';

export async function handleRequest<T = any>(currRequest: request.SuperAgentRequest, org?: SalesforceOrgUi) {
  try {
    currRequest.set(HTTP.HEADERS.ACCEPT, HTTP.CONTENT_TYPE.JSON);
    if (org) {
      currRequest.set({
        [HTTP.HEADERS.X_SFDC_ID]: org.uniqueId || '',
      });
    }
    logger.info(`[HTTP][REQ][${currRequest.method}]`, currRequest.url, { request: currRequest });
    const response = await currRequest;
    logger.info(`[HTTP][RES][${currRequest.method}][${response.status}]`, currRequest.url, { response: response.body });
    const body: API.RequestResult<T> = response.body;

    return body ? body.data : undefined;
  } catch (ex) {
    logger.info('[HTTP][RESPONSE][ERROR]', ex.status, ex.message);
    let message = 'An unknown error has occurred';
    if (ex.response) {
      const response = ex.response as request.Response;
      // Run middleware for error responses
      errorMiddleware.forEach((middleware) => middleware(response, org));
      const responseBody: { error: boolean; message: string } = response.body;
      message = responseBody.message || 'An unknown error has occurred';
      // take user to login page
      if (response.get(HTTP.HEADERS.X_LOGOUT) === '1') {
        // LOG USER OUT
        const logoutUrl = response.get(HTTP.HEADERS.X_LOGOUT_URL) || '/oauth/logout';
        // eslint-disable-next-line no-restricted-globals
        location.href = logoutUrl;
      }
    }
    throw new Error(message);
  }
}
