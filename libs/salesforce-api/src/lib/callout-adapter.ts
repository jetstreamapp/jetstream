import { HTTP } from '@jetstream/shared/constants';
import isObject from 'lodash/isObject';
import { convert as xmlConverter } from 'xmlbuilder2';
import { ApiRequestOptions, fetchFn } from './types';

const SOAP_API_AUTH_ERROR_REGEX = /<faultcode>[a-zA-Z]+:INVALID_SESSION_ID<\/faultcode>/;

/**
 * Factory function to get api request
 * Requires a fetch compatible function to avoid relying any specific fetch implementation
 */
export function getApiRequestFactoryFn(fetch: fetchFn) {
  return (onRefresh?: (accessToken: string) => void) => {
    const apiRequest = async <Response = unknown, ResponseHeader = never>(
      {
        method = 'GET',
        sessionInfo,
        basePath = `/services/data/v${sessionInfo.apiVersion}`,
        url,
        body,
        headers,
        outputType,
        rawBody = false,
      }: ApiRequestOptions,
      attemptRefresh: boolean = true
    ): Promise<Response> => {
      const { accessToken, instanceUrl } = sessionInfo;
      basePath = basePath || '';
      if (url.startsWith('/')) {
        url = `${instanceUrl}${basePath}${url}`;
      }
      if (isObject(body) && !rawBody) {
        body = JSON.stringify(body);
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
          if (response.ok) {
            outputType = outputType || 'json';
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
            } else {
              return response.json();
            }
          }

          const responseText = await response.text();

          if (
            (response.status === 401 || (response.status === 500 && SOAP_API_AUTH_ERROR_REGEX.test(responseText))) &&
            attemptRefresh &&
            sessionInfo.sfdcClientId &&
            sessionInfo.sfdcClientSecret &&
            sessionInfo.refreshToken
          ) {
            // if 401 and we have a refresh token, then attempt to refresh the token
            // attemptRefresh
            const { access_token: accessToken } = await exchangeRefreshToken(fetch, sessionInfo);
            onRefresh?.(accessToken);
            return apiRequest({ method, sessionInfo: { ...sessionInfo, accessToken }, basePath, url, body, headers, outputType }, false);
          }
          throw new Error(responseText);
        })
        .then((response) => {
          return response as Response;
        });
    };
    return apiRequest;
  };
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
