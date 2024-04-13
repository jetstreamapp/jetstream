import { ERROR_MESSAGES, HTTP } from '@jetstream/shared/constants';
import isObject from 'lodash/isObject';
import { convert as xmlConverter } from 'xmlbuilder2';
import { ApiRequestOptions, ApiRequestOutputType, BulkXmlErrorResponse, FetchResponse, Logger, SoapErrorResponse, fetchFn } from './types';

const SOAP_API_AUTH_ERROR_REGEX = /<faultcode>[a-zA-Z]+:INVALID_SESSION_ID<\/faultcode>/;
// Shows up for certain API requests, such as Identity
const BAS_ACCESS_TOKEN_403 = 'Bad_OAuth_Token';

export class ApiRequestError extends Error {
  readonly status: number;
  readonly statusText?: string;
  readonly ok: boolean;
  readonly headers: Headers;
  readonly type: string;

  constructor(message: string | undefined, response: FetchResponse<unknown>) {
    super(message);
    if (response) {
      this.status = response.status;
      this.statusText = response.statusText;
      this.ok = response.ok;
      this.headers = response.headers;
      this.type = response.type;
    }
  }
}

/**
 * Factory function to get api request
 * Requires a fetch compatible function to avoid relying any specific fetch implementation
 */
export function getApiRequestFactoryFn(fetch: fetchFn) {
  return (onRefresh?: (accessToken: string) => void, enableLogging?: boolean, logger: Logger = console) => {
    const apiRequest = async <Response = unknown>(options: ApiRequestOptions, attemptRefresh = true): Promise<Response> => {
      let { url, body, outputType } = options;
      const { method = 'GET', sessionInfo, headers, rawBody = false } = options;
      const { accessToken, instanceUrl } = sessionInfo;
      url = `${instanceUrl}${url}`;
      outputType = outputType || 'json';
      if (isObject(body) && !rawBody) {
        body = JSON.stringify(body);
      }

      logger.trace(`[API REQUEST]: ${method} ${url}`);

      return fetch(url, {
        method,
        body,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          [HTTP.HEADERS.CONTENT_TYPE]: 'application/json; charset=UTF-8',
          [HTTP.HEADERS.ACCEPT]: 'application/json; charset=UTF-8',
          [HTTP.HEADERS.X_SFDC_Session]: accessToken,
          ...headers,
        },
      })
        .then(async (response) => {
          if (enableLogging) {
            logger.trace(`[API RESPONSE]: ${response.status}`);
            if (response.status !== 204) {
              response
                .clone()
                .text()
                .then((responseBody) => logger.trace({ responseBody }))
                // eslint-disable-next-line @typescript-eslint/no-empty-function
                .catch(() => {});
            }
          }
          if (response.ok) {
            if (outputType === 'text') {
              return response.text();
            } else if (outputType === 'arrayBuffer') {
              return response.arrayBuffer();
            } else if (outputType === 'stream') {
              return response.body;
            } else if (outputType === 'xml') {
              return response.text().then((text) => xmlConverter(text, { format: 'object', wellFormed: true }) as Response);
            } else if (outputType === 'soap') {
              return response.text().then((text) => xmlConverter(text, { format: 'object', wellFormed: true }));
            } else if (outputType === 'response') {
              return response;
            } else if (outputType === 'void') {
              return;
            } else {
              return response.json();
            }
          }

          let responseText = await response.clone().text();

          if (
            attemptRefresh &&
            (response.status === 401 ||
              (response.status === 403 && responseText === BAS_ACCESS_TOKEN_403) ||
              (response.status === 500 && SOAP_API_AUTH_ERROR_REGEX.test(responseText))) &&
            sessionInfo.sfdcClientId &&
            sessionInfo.sfdcClientSecret &&
            sessionInfo.refreshToken
          ) {
            try {
              // if 401 and we have a refresh token, then attempt to refresh the token
              const { access_token: newAccessToken } = await exchangeRefreshToken(fetch, sessionInfo);
              onRefresh?.(newAccessToken);
              // replace token in body
              if (typeof options.body === 'string' && options.body.includes(accessToken)) {
                // if the response is soap, we need to return the response as is
                options.body = options.body.replace(accessToken, newAccessToken);
              }

              return apiRequest({ ...options, sessionInfo: { ...sessionInfo, accessToken: newAccessToken } }, false);
            } catch (ex) {
              logger.warn('Unable to refresh accessToken');
              responseText = ERROR_MESSAGES.SFDC_EXPIRED_TOKEN;
            }
          } else if (response.status === 420 && response.headers.get(HTTP.HEADERS.CONTENT_TYPE) === 'text/html') {
            responseText = 'An unexpected response was received from Salesforce. Please try again.';
          }
          // don't throw if caller wants the response back
          if (outputType === 'response') {
            return response as Response;
          }

          throw new ApiRequestError(handleSalesforceApiError(outputType || 'json', responseText), response);
        })
        .then((response) => {
          return response as Response;
        });
    };
    return apiRequest;
  };
}

function handleSalesforceApiError(outputType: ApiRequestOutputType, responseText?: string) {
  let output = responseText;
  if (outputType === 'json' && typeof responseText === 'string') {
    try {
      const tempResult = JSON.parse(responseText) as { message: string } | { message: string }[];
      output = (Array.isArray(tempResult) ? tempResult[0] : tempResult)?.message;
    } catch (ex) {
      output = responseText;
    }
    output = output || responseText;
  } else if (outputType === 'soap' && typeof responseText === 'string') {
    try {
      const tempResult = xmlConverter(responseText, { format: 'object', wellFormed: true }) as unknown as SoapErrorResponse;
      output = tempResult['soapenv:Envelope']['soapenv:Body']['soapenv:Fault']['faultstring'];
    } catch (ex) {
      output = responseText;
    }
    output = output || responseText;
  } else if (
    outputType === 'xml' &&
    typeof responseText === 'string' &&
    responseText.includes(`xmlns="http://www.force.com/2009/06/asyncapi/dataload"`)
  ) {
    try {
      const tempResult = xmlConverter(responseText, { format: 'object', wellFormed: true }) as unknown as BulkXmlErrorResponse;
      output = tempResult.error.exceptionMessage;
    } catch (ex) {
      output = responseText;
    }
    output = output || responseText;
  }
  return output;
}

function exchangeRefreshToken(fetch: fetchFn, sessionInfo: ApiRequestOptions['sessionInfo']): Promise<{ access_token: string }> {
  return fetch(`${sessionInfo.instanceUrl}/services/oauth2/token`, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      client_id: sessionInfo.sfdcClientId!,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      client_secret: sessionInfo.sfdcClientSecret!,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      refresh_token: sessionInfo.refreshToken!,
    }).toString(),
    headers: {
      [HTTP.HEADERS.CONTENT_TYPE]: HTTP.CONTENT_TYPE.FORM_URL,
      [HTTP.HEADERS.ACCEPT]: HTTP.CONTENT_TYPE.JSON,
    },
  })
    .then((response) => {
      if (response.ok) {
        return response;
      }
      throw new Error(ERROR_MESSAGES.SFDC_EXPIRED_TOKEN);
    })
    .then((response) => response.json())
    .then((response) => {
      return response as { access_token: string };
    });
}
