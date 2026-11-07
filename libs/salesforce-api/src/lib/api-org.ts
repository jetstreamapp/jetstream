import { getErrorMessage, isHostRelativeUrlPath, isSObjectBlobFieldUrl } from '@jetstream/shared/utils';
import { Maybe, SalesforceUserIdentity } from '@jetstream/types';
import isString from 'lodash/isString';
import { ApiConnection } from './connection';
import { SalesforceApi } from './utils';

export class ApiOrg extends SalesforceApi {
  constructor(connection: ApiConnection) {
    super(connection);
  }

  /**
   * A one-time frontdoor URL from the Single Access UI Bridge (`/services/oauth2/singleaccess`). The URL carries a
   * single-use `otp` that expires after a minute instead of the access token, so the session never lands in browser
   * history, referrers or redirect logs.
   *
   * When no one-time URL can be issued (a revoked connection, an instance url that is not a My Domain host, an API Only
   * user, a token without the `web` scope) this returns a plain link to the org instead. The session is never put in
   * a URL: a user who is not already logged in to Salesforce goes through Salesforce's own login.
   *
   * `redirect_uri` is where Salesforce sends the user after login, so only a host-relative path on the org's own
   * instance is forwarded. Anything else is dropped and Salesforce lands on its default page. Callers validate at
   * their edge as well; this is the backstop for the ones that bypass them (e.g. the desktop window-open handler).
   */
  async getFrontdoorLoginUrl(returnUrl?: Maybe<string>): Promise<string> {
    const redirectPath = isHostRelativeUrlPath(returnUrl) ? returnUrl : null;
    try {
      const url = new URL('/services/oauth2/singleaccess', this.sessionInfo.instanceUrl);
      if (redirectPath) {
        url.searchParams.set('redirect_uri', redirectPath);
      }
      const { frontdoor_uri } = await this.apiRequest<{ frontdoor_uri: string }>({
        sessionInfo: this.sessionInfo,
        url: url.toString(),
      });
      // Only hand back a link to the org's own instance; anything else is treated like a refusal
      if (isString(frontdoor_uri) && new URL(frontdoor_uri).origin === new URL(this.sessionInfo.instanceUrl).origin) {
        return frontdoor_uri;
      }
      throw new Error('Single access response did not contain a frontdoor url for the org instance');
    } catch (ex) {
      this.logger.warn(
        { message: getErrorMessage(ex), instanceUrl: this.sessionInfo.instanceUrl },
        '[FRONTDOOR] Single access url unavailable, opening the org without a session',
      );
      return new URL(redirectPath ?? '/', this.sessionInfo.instanceUrl).toString();
    }
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
