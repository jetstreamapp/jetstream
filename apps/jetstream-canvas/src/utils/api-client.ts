import { ApiConnection, getApiRequestFactoryFn } from '@jetstream/salesforce-api';
import { logger } from '@jetstream/shared/client-logger';
import { isObjectLike } from 'lodash';

export const fetchFn: Parameters<typeof getApiRequestFactoryFn>[0] = (url, options) => {
  return new Promise<Response>((resolve, reject) => {
    const headers = (options.headers as Record<string, string>) || {};
    const contentType = Object.entries(headers).find(([key]) => key.toLowerCase() === 'content-type')?.[1] || 'application/json';
    window.Sfdc.canvas.client.ajax(url, {
      client: sr.client,
      method: options.method,
      async: true,
      contentType,
      headers,
      data: options.body,
      // targetOrigin
      success: ({ payload, status, statusText }) => {
        payload = isObjectLike(payload) ? JSON.stringify(payload) : payload;
        // Headers are intentionally omitted — callout-adapter.ts parses the response
        // based on the caller-specified `outputType`, not content-type headers.
        resolve(new Response(payload, { status, statusText }));
      },
      failure: (responseText, xhr) => {
        reject(new Error(`Canvas AJAX failed: ${xhr.status} ${responseText}`));
      },
    });
  });
};

export function initApiClient(): ApiConnection {
  return new ApiConnection({
    apiRequestAdapter: getApiRequestFactoryFn(fetchFn),
    userId: 'unknown',
    organizationId: 'unknown',
    accessToken: window.sr.client.oauthToken,
    apiVersion: window.sr.context.environment.version.api,
    instanceUrl: window.sr.client.instanceUrl,
    // refreshToken: window.sr.client.refreshToken, // TODO: do we need/want to use this?
    logger,
    enableLogging: false,
  });
}
