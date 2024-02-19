import { SalesforceUserIdentity } from '@jetstream/types';
import isString from 'lodash/isString';
import { ApiConnection } from './connection';
import { SalesforceApi } from './utils';

export class ApiOrg extends SalesforceApi {
  constructor(connection: ApiConnection) {
    super(connection);
  }

  getFrontdoorLoginUrl(returnUrl?: string) {
    return `${this.sessionInfo.instanceUrl}/secur/frontdoor.jsp?sid=${this.sessionInfo}${
      isString(returnUrl) && returnUrl ? '&retURL=${returnUrl}' : ''
    }`;
  }

  async streamDownload(url: string) {
    return await this.apiRequest<ReadableStream<Uint8Array>>({
      sessionInfo: this.sessionInfo,
      url,
      basePath: '',
      outputType: 'stream',
    });
  }

  async identity(): Promise<SalesforceUserIdentity> {
    return await this.apiRequest<SalesforceUserIdentity>({
      sessionInfo: this.sessionInfo,
      url: `/id/${this.sessionInfo.organizationId}/${this.sessionInfo.userId}`,
      basePath: '',
    });
  }

  async apiVersions(): Promise<{ label: string; url: string; version: string }[]> {
    return await this.apiRequest<{ label: string; url: string; version: string }[]>({
      sessionInfo: this.sessionInfo,
      url: `/services/data`,
      basePath: '',
    });
  }
}
