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
 * Creates a multipart/form-data body from a FormData object.
 *
 */
async function createMultipartFromFormData(formData: FormData): Promise<{ body: ArrayBuffer; boundary: string }> {
  const boundary = '----electronBoundary' + Math.random().toString(16).slice(2);
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];

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

  function pushString(str: string) {
    chunks.push(encoder.encode(str));
  }

  for (const [name, value] of formData.entries()) {
    pushString(`--${boundary}\r\n`);

    if (typeof value === 'string') {
      // Plain string field
      pushString(`Content-Disposition: form-data; name="${escapeName(name)}"\r\n\r\n`);
      pushString(value + '\r\n');
    } else {
      // File/Blob field
      const filename = value.type === 'application/json' ? '' : ` filename="${escapeName(value.name || 'blob')}"`;
      const type = value.type || 'application/octet-stream';

      pushString(`Content-Disposition: form-data; name="${escapeName(name)}";${filename}\r\n`);
      pushString(`Content-Type: ${type}\r\n\r\n`);
      chunks.push(new Uint8Array(await value.arrayBuffer()));
      pushString('\r\n');
    }
  }

  // Closing boundary
  pushString(`--${boundary}--\r\n`);

  // Concatenate into buffer
  const size = chunks.reduce((s, c) => s + c.byteLength, 0);
  const byteArray = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    byteArray.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { body: byteArray.buffer, boundary };
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
