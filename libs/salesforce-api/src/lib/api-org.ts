import { isSObjectBlobFieldUrl } from '@jetstream/shared/utils';
import { Maybe, SalesforceUserIdentity } from '@jetstream/types';
import isString from 'lodash/isString';
import { ApiConnection } from './connection';
import { SalesforceApi } from './utils';

export class ApiOrg extends SalesforceApi {
  constructor(connection: ApiConnection) {
    super(connection);
  }

  getFrontdoorLoginUrl(returnUrl?: Maybe<string>): string {
    const url = new URL(`${this.sessionInfo.instanceUrl}/secur/frontdoor.jsp`);
    url.searchParams.append('sid', this.sessionInfo.accessToken);
    if (isString(returnUrl) && returnUrl) {
      url.searchParams.append('retURL', returnUrl);
    }
    return url.toString();
  }

  /**
   * The download proxies accept this path from the caller and request it with the org's credentials, so
   * only record blob fields (`/sobjects/<SObject>/<id>/<Field>`) are allowed. The proxies validate at
   * their edge as well; this is the backstop for callers that bypass them (e.g. the desktop `app://` handler).
   */
  async streamDownload(url: string) {
    if (!isSObjectBlobFieldUrl(url)) {
      throw new Error('url must be a record blob field path, e.g. /services/data/v62.0/sobjects/ContentVersion/<id>/VersionData');
    }
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
