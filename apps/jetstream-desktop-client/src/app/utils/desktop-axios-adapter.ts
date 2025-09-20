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

/**
 * Axios normally handles FormData automatically in the browser, but since we're
 * using a custom adapter to route requests through Electron's IPC, we need to manually
 * handle FormData
 */
async function formDataToMultipart(formData: FormData, boundary: string): Promise<Uint8Array> {
  const carriageNewLine = '\r\n';
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];

  // Helper to escape field names
  const escapeName = (name: string) => {
    return name.replace(
      /[\r\n"]/g,
      (match) =>
        ({
          '\r': '%0D',
          '\n': '%0A',
          '"': '%22',
        })[match] || match,
    );
  };

  // Process each form field
  for (const [name, _value] of formData.entries()) {
    const boundaryBytes = encoder.encode(`--${boundary}\r\n`);
    parts.push(boundaryBytes);

    if (_value instanceof File || (_value as any) instanceof Blob) {
      const value = _value as File | Blob;
      const fileName = value instanceof File ? value.name : 'blob';
      const headerStr =
        `Content-Disposition: form-data; name="${escapeName(name)}"; filename="${escapeName(fileName)}"${carriageNewLine}` +
        `Content-Type: ${value.type || 'application/octet-stream'}${carriageNewLine}${carriageNewLine}`;
      parts.push(encoder.encode(headerStr));

      const arrayBuffer = await value.arrayBuffer();
      parts.push(new Uint8Array(arrayBuffer));
      parts.push(encoder.encode(carriageNewLine));
    } else {
      const headerStr = `Content-Disposition: form-data; name="${escapeName(name)}"${carriageNewLine}${carriageNewLine}`;
      parts.push(encoder.encode(headerStr));
      parts.push(encoder.encode(String(_value)));
      parts.push(encoder.encode(carriageNewLine));
    }
  }

  // Add closing boundary
  parts.push(encoder.encode(`--${boundary}--\r\n`));
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  // Combine all parts
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    combined.set(part, offset);
    offset += part.length;
  }

  return combined;
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

    // Handle FormData
    if (data instanceof FormData) {
      const boundary = `----jetstream-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

      const multipartData = await formDataToMultipart(data, boundary);
      body = multipartData.buffer;

      headers.set('Content-Type', `multipart/form-data; boundary=${boundary}`);
      headers.set('Content-Length', String(multipartData.length));
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
  axiosResponse.headers = AxiosHeaders.from(response.headers as any);

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
