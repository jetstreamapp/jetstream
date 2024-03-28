import { SalesforceApiRequest } from '@jetstream/api-types';
import { ApiConnection } from './connection';
import { ApiRequestOutputType } from './types';
import { SalesforceApi } from './utils';

export class ApiRequest extends SalesforceApi {
  constructor(connection: ApiConnection) {
    super(connection);
  }

  async manualRequest<T = unknown>(
    { method, url, body, headers = {}, options }: SalesforceApiRequest,
    outputType: ApiRequestOutputType = 'text',
    ensureRestUrl = false
  ): Promise<T> {
    if (options?.responseType) {
      headers = headers || {};
      headers['Content-Type'] = options.responseType;
      headers['Accept'] = '*';
    }
    if (ensureRestUrl && !url.startsWith('/services')) {
      url = this.getRestApiUrl(url);
    }
    const data = await this.apiRequest<T>({
      sessionInfo: this.sessionInfo,
      url,
      method: method,
      body: body,
      headers: headers || {},
      outputType,
    });

    return data;
  }
}
