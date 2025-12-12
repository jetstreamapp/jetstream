import { createMultipartFromFormData } from '@jetstream/shared/data';
import { getErrorMessage } from '@jetstream/shared/utils';
import { AxiosError, AxiosHeaders, AxiosResponse, InternalAxiosRequestConfig, isAxiosError } from 'axios';

interface IcpRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: BodyInit | null;
}

interface IcpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body?: unknown;
}

export async function desktopExtensionAxiosAdapter(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  if (!window.electronAPI) {
    throw new AxiosError('Environment not configured for Desktop');
  }
  const { headers, data, method } = config;

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
    const url = getUrl(config) || '/';
    let body = data;

    // NOTE: this assumes that FormData is always multipart/form-data, will need to adjust if that assumption changes
    if (data instanceof FormData) {
      const { body: formBody, boundary } = await createMultipartFromFormData(data);
      body = formBody;

      headers.set('Content-Type', `multipart/form-data; boundary=${boundary}`);
      headers.set('Content-Length', String(formBody.byteLength));
    } else if (data && typeof data !== 'string' && headers.get('content-type') === 'application/json') {
      body = JSON.stringify(data);
    }

    const request: IcpRequest = {
      url,
      method: method?.toUpperCase() ?? 'GET',
      headers: headers.normalize(false).toJSON() as Record<string, string>,
      body,
    };

    const response = await window.electronAPI.request({ url, request });

    if (!response) {
      return throwAxiosNotFoundResponse(config, request, axiosResponse);
    }

    return getAxiosResponse(config, request, response, axiosResponse);
  } catch (ex) {
    throw isAxiosError(ex) ? ex : new AxiosError(getErrorMessage(ex) || 'Unexpected error', undefined, config);
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
  request: IcpRequest,
  response: IcpResponse,
  axiosResponse: Partial<AxiosResponse>,
): Promise<AxiosResponse> {
  axiosResponse.data = response.body;
  axiosResponse.status = response.status;
  axiosResponse.statusText = response.statusText;
  axiosResponse.headers = AxiosHeaders.from(response.headers);

  if (response.status < 200 || response.status >= 300) {
    throw new AxiosError(
      'Request failed with status code ' + response.status,
      'ERR_BAD_REQUEST',
      config,
      request,
      axiosResponse as AxiosResponse,
    );
  }

  return axiosResponse as AxiosResponse;
}

async function throwAxiosNotFoundResponse(
  config: InternalAxiosRequestConfig,
  request: IcpRequest,
  axiosResponse: Partial<AxiosResponse>,
): Promise<AxiosResponse> {
  axiosResponse.status = 404;
  axiosResponse.statusText = 'Not Found';
  throw new AxiosError('Request failed with status code ' + 404, 'ERR_BAD_REQUEST', config, request, axiosResponse as AxiosResponse);
}
