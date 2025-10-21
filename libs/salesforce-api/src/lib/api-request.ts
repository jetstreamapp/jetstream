// eslint-disable-next-line @nx/enforce-module-boundaries
import type { SalesforceApiRequest } from '@jetstream/api-types';
import { ApiConnection } from './connection';
import { ApiRequestOptions, ApiRequestOutputType } from './types';
import { SalesforceApi } from './utils';

export class ApiRequest extends SalesforceApi {
  constructor(connection: ApiConnection) {
    super(connection);
  }

  async manualRequest<T = unknown>(
    { method, url, body, headers = {}, options, rawBody, duplex }: SalesforceApiRequest & Pick<ApiRequestOptions, 'rawBody' | 'duplex'>,
    outputType: ApiRequestOutputType = 'text',
    ensureRestUrl = false,
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
      rawBody,
      duplex,
    });

    return data;
  }
}
