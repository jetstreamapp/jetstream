import { GenericRequestPayload } from '@jetstream/types';
import { ApiConnection } from './connection';
import { ApiRequestOutputType } from './types';
import { SalesforceApi } from './utils';

export class ApiRequest extends SalesforceApi {
  constructor(connection: ApiConnection) {
    super(connection);
  }

  // { url, method, isTooling, body, headers, options }

  async manualRequest<T = unknown>(
    { method, url, body, headers = {}, options }: GenericRequestPayload,
    outputType: ApiRequestOutputType = 'text'
  ): Promise<T> {
    if (options?.responseType) {
      headers = headers || {};
      headers['Content-Type'] = options.responseType;
      headers['Accept'] = '*';
    }
    const data = await this.apiRequest<T>({
      sessionInfo: this.sessionInfo,
      url,
      basePath: '',
      method: method,
      body: body,
      headers: headers,
      outputType,
    });

    // TODO: server sends this for request-manual
    // {
    //   error: response.status < 200 || response.status > 300,
    //   status: response.status,
    //   statusText: response.statusText,
    //   headers: JSON.stringify(response.headers || {}, null, 2),
    //   body: response.data,
    // }

    return data;
  }

  FetchResponse;
}
