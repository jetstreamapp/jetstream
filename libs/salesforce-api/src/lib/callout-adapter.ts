import { HTTP } from '@jetstream/shared/constants';
import isObject from 'lodash/isObject';
import { convert as xmlConverter } from 'xmlbuilder2';
import { ApiRequestOptions, ApiRequestOutputType, BulkXmlErrorResponse, Logger, SoapErrorResponse, fetchFn } from './types';

const SOAP_API_AUTH_ERROR_REGEX = /<faultcode>[a-zA-Z]+:INVALID_SESSION_ID<\/faultcode>/;

/**
 * Factory function to get api request
 * Requires a fetch compatible function to avoid relying any specific fetch implementation
 */
export function getApiRequestFactoryFn(fetch: fetchFn) {
  return (onRefresh?: (accessToken: string) => void, enableLogging?: boolean, logger: Logger = console) => {
    const apiRequest = async <Response = unknown>(options: ApiRequestOptions, attemptRefresh: boolean = true): Promise<Response> => {
      let { url, body, outputType } = options;
      const { method = 'GET', sessionInfo, headers, rawBody = false } = options;
      const { accessToken, instanceUrl } = sessionInfo;
      url = `${instanceUrl}${url}`;
      outputType = outputType || 'json';
      if (isObject(body) && !rawBody) {
        body = JSON.stringify(body);
      }
      if (enableLogging) {
        logger.debug(`[API REQUEST]: ${method} ${url}`);
      }

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
            logger.debug(`[API RESPONSE]: ${response.status}`);
            if (response.status !== 204) {
              response
                .clone()
                .text()
                .then((responseBody) => logger.debug({ responseBody }))
                .catch((_) => {});
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
              // .then((soapResponse) => ({
              //   body: soapResponse.ns1LEnvelope.Body,
              //   header: soapResponse.ns1LEnvelope.Header,
              // }));
            } else if (outputType === 'response') {
              return response;
            } else if (outputType === 'void') {
              return;
            } else {
              return response.json();
            }
          }

          const responseText = await response.clone().text();

          if (
            attemptRefresh &&
            (response.status === 401 || (response.status === 500 && SOAP_API_AUTH_ERROR_REGEX.test(responseText))) &&
            sessionInfo.sfdcClientId &&
            sessionInfo.sfdcClientSecret &&
            sessionInfo.refreshToken
          ) {
            // if 401 and we have a refresh token, then attempt to refresh the token
            // attemptRefresh
            const { access_token: accessToken } = await exchangeRefreshToken(fetch, sessionInfo);
            onRefresh?.(accessToken);
            return apiRequest({ ...options, sessionInfo: { ...sessionInfo, accessToken } });
          }
          // don't throw if caller wants the response back
          if (outputType === 'response') {
            return response as Response;
          }

          throw new Error(handleSalesforceApiError(outputType || 'json', responseText));
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
      client_id: sessionInfo.sfdcClientId!,
      client_secret: sessionInfo.sfdcClientSecret!,
      refresh_token: sessionInfo.refreshToken!,
    }).toString(),
    headers: {
      [HTTP.HEADERS.CONTENT_TYPE]: HTTP.CONTENT_TYPE.FORM_URL,
      [HTTP.HEADERS.ACCEPT]: HTTP.CONTENT_TYPE.JSON,
    },
  })
    .then((response) => response.json())
    .then((response) => {
      return response as { access_token: string };
    });
}
