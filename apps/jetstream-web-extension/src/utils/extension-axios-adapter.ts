import { HTTP } from '@jetstream/shared/constants';
import { AxiosError, AxiosHeaders, AxiosResponse, InternalAxiosRequestConfig, isAxiosError } from 'axios';
import type { Method } from 'tiny-request-router';
import { extensionRoutes } from '../controllers/extension.routes';
import { initApiClient } from './api-client';
import { sendMessage } from './web-extension.utils';

let sfHost = new URLSearchParams(window?.location?.search?.substring(1)).get('host') || '';

export async function browserExtensionAxiosAdapter(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  sfHost = sfHost || new URLSearchParams(window?.location?.search?.substring(1)).get('host') || '';
  if (!sfHost) {
    throw new AxiosError('No Salesforce host found in URL');
  }
  const { headers, data, method, timeout } = config;

  // This gets modified
  const axiosResponse: AxiosResponse = {
    data: undefined,
    headers: {},
    status: 200,
    statusText: 'ok',
    config,
    request: undefined,
  };

  try {
    const url = getUrl(config);
    let body = data;
    if (data && typeof data !== 'string' && headers.get('content-type') === 'application/json') {
      body = JSON.stringify(data);
    }
    const request = new Request(url, {
      method: method?.toUpperCase() ?? 'GET',
      headers: headers.normalize(false).toJSON() as HeadersInit,
      body,
    });

    const route = extensionRoutes.match(request.method as Method, config.url || '/');

    if (!route) {
      return throwAxiosNotFoundResponse(config, request, axiosResponse);
    }

    const uniqueId = config.headers.get(HTTP.HEADERS.X_SFDC_ID);
    const connection = await sendMessage({ message: 'GET_CURRENT_ORG', data: { uniqueId: String(uniqueId || '_placeholder_') } });

    if (!uniqueId || !connection) {
      const response = await route.handler({
        request,
        params: route.params,
      });
      return getAxiosResponse(config, request, response, axiosResponse);
    }

    if (!connection) {
      return throwAxiosNotFoundResponse(config, request, axiosResponse);
    }

    const { sessionInfo, org } = connection;
    const apiConnection = initApiClient(sessionInfo);

    const response = await route.handler({
      request,
      params: route.params,
      jetstreamConn: apiConnection,
      org,
    });

    return getAxiosResponse(config, request, response, axiosResponse);
  } catch (ex) {
    throw isAxiosError(ex) ? ex : new AxiosError(ex.message || 'Unexpected error', undefined, config);
  }
}

function getUrl(config: InternalAxiosRequestConfig) {
  const params = new URLSearchParams();
  if (config.params) {
    Object.entries(config.params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '' || Number.isNaN(value)) {
        return;
      }
      if (value instanceof Date) {
        value = value.toISOString();
      } else if (!Array.isArray(value) && typeof value === 'object') {
        value = JSON.stringify(value);
      }
      params.append(key, String(value));
    });
  }
  const url = `${window.location.origin}${config.url || '/'}?${params.toString()}`;
  return url;
}

async function getAxiosResponse(
  config: InternalAxiosRequestConfig,
  request: Request,
  response: Response,
  axiosResponse: Partial<AxiosResponse>
): Promise<AxiosResponse> {
  axiosResponse.data = await getResponseBody(response);
  axiosResponse.status = response.status;
  axiosResponse.statusText = response.statusText;
  axiosResponse.headers = AxiosHeaders.from(response.headers as any);

  if (response.status < 200 || response.status >= 300) {
    throw new AxiosError(
      'Request failed with status code ' + response.status,
      'ERR_BAD_REQUEST',
      config,
      request,
      axiosResponse as AxiosResponse
    );
  }

  return axiosResponse as AxiosResponse;
}

async function throwAxiosNotFoundResponse(
  config: InternalAxiosRequestConfig,
  request: Request,
  axiosResponse: Partial<AxiosResponse>
): Promise<AxiosResponse> {
  axiosResponse.status = 404;
  axiosResponse.statusText = 'Not Found';
  throw new AxiosError('Request failed with status code ' + 404, 'ERR_BAD_REQUEST', config, request, axiosResponse as AxiosResponse);
}

async function getResponseBody(response: Response) {
  if (!response.body) {
    return response.body;
  }
  if (response.headers.get('content-type')?.includes('application/json')) {
    return await response.json();
  }
  return await response.text();
}
