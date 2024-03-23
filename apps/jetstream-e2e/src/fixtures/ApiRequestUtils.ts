import { HTTP } from '@jetstream/shared/constants';
import { HttpMethod } from '@jetstream/types';
import { APIRequestContext, APIResponse } from '@playwright/test';

export class ApiRequestUtils {
  readonly BASE_URL: string;
  readonly selectedOrgId: string;
  readonly request: APIRequestContext;

  constructor(selectedOrgId: string, request: APIRequestContext) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.BASE_URL = process.env.JETSTREAM_SERVER_URL!;
    this.selectedOrgId = selectedOrgId;
    this.request = request;
  }

  async makeRequest<T>(method: HttpMethod, path: string, data?: unknown, headers?: Record<string, string>): Promise<T> {
    const response = await this.makeRequestRaw(method, path, data, headers);
    const results = await response.json();
    if (!response.ok()) {
      console.warn('\n\nREQUEST ERROR');
      console.log(results);
      throw new Error('Request failed\n\n');
    }
    return results.data;
  }

  async makeRequestRaw(method: HttpMethod, path: string, data?: unknown, headers?: Record<string, string>): Promise<APIResponse> {
    const url = `${this.BASE_URL}${path}`;
    const options = {
      data,
      headers: {
        [HTTP.HEADERS.ACCEPT]: HTTP.CONTENT_TYPE.JSON,
        [HTTP.HEADERS.X_SFDC_ID]: this.selectedOrgId,
        ...headers,
      },
    };
    let response: APIResponse;
    switch (method) {
      case 'GET':
        response = await this.request.get(url, options);
        break;
      case 'POST':
        response = await this.request.post(url, options);
        break;
      case 'PATCH':
        response = await this.request.patch(url, options);
        break;
      case 'PUT':
        response = await this.request.put(url, options);
        break;
      case 'DELETE':
        response = await this.request.delete(url, options);
        break;
      default:
        throw new Error('Invalid method');
    }
    return response;
  }
}
