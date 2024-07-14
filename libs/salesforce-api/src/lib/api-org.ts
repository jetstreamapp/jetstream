import { SalesforceUserIdentity } from '@jetstream/types';
import isString from 'lodash/isString';
import { ApiConnection } from './connection';
import { SalesforceApi } from './utils';

export class ApiOrg extends SalesforceApi {
  constructor(connection: ApiConnection) {
    super(connection);
  }

  getFrontdoorLoginUrl(returnUrl?: string): string {
    const url = new URL(`${this.sessionInfo.instanceUrl}/secur/frontdoor.jsp`);
    url.searchParams.append('sid', this.sessionInfo.accessToken);
    if (isString(returnUrl) && returnUrl) {
      url.searchParams.append('retURL', returnUrl);
    }
    return url.toString();
  }

  async streamDownload(url: string) {
    return await this.apiRequest<ReadableStream<Uint8Array>>({
      sessionInfo: this.sessionInfo,
      url,
      outputType: 'stream',
    });
  }

  async identity(): Promise<SalesforceUserIdentity> {
    return await this.apiRequest<SalesforceUserIdentity>({
      sessionInfo: this.sessionInfo,
      url: `/id/${this.sessionInfo.organizationId}/${this.sessionInfo.userId}`,
    });
  }

  async discovery(): Promise<Record<string, string>> {
    return await this.apiRequest<Record<string, string>>({
      sessionInfo: this.sessionInfo,
      url: this.getRestApiUrl(),
    });
  }

  async apiVersions(): Promise<{ label: string; url: string; version: string }[]> {
    return await this.apiRequest<{ label: string; url: string; version: string }[]>({
      sessionInfo: this.sessionInfo,
      url: `/services/data`,
    });
  }
}
