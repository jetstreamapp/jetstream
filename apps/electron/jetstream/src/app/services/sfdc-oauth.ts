import { SalesforceOrgUi, SObjectOrganization } from '@jetstream/types';
import * as jsforce from 'jsforce';
import { environment } from '../../environments/environment';
import logger from './logger';

export function getRedirectUrl(windowId: number, protocol: 'jetstream' | 'http', loginUrl: string) {
  // TODO: we might need to determine if packaged or not and use a different url (e.x. jetstream://)
  const state = new URLSearchParams({ loginUrl, windowId: `${windowId}` }).toString();
  const options = {
    scope: 'api web refresh_token',
    state,
    prompt: 'login',
  };

  return new jsforce.OAuth2({
    loginUrl,
    // TODO: Get these from env vars
    clientId: environment.SFDC_CLIENT_ID,
    redirectUri: `${protocol}://localhost/oauth/sfdc/callback`,
  }).getAuthorizationUrl(options);
}

export async function exchangeCodeForToken(protocol: 'jetstream' | 'http', params: URLSearchParams) {
  const code = params.get('code');
  // TODO: handle error
  const error = params.get('error');
  const errorDescription = params.get('error_description');

  const state = new URLSearchParams(params.get('state'));
  const loginUrl = state.get('loginUrl');

  const conn = new jsforce.Connection({
    oauth2: new jsforce.OAuth2({
      loginUrl,
      // TODO: Get these from env vars
      clientId: environment.SFDC_CLIENT_ID,
      redirectUri: `${protocol}://localhost/oauth/sfdc/callback`,
    }),
  });
  const userInfo = await conn.authorize(code);
  const identity = await conn.identity();

  let companyInfoRecord: SObjectOrganization;

  try {
    const results = await conn.query<SObjectOrganization>(
      `SELECT Id, Name, Country, OrganizationType, InstanceName, IsSandbox, LanguageLocaleKey, NamespacePrefix, TrialExpirationDate FROM Organization`
    );
    if (results.totalSize > 0) {
      companyInfoRecord = results.records[0];
    }
  } catch (ex) {
    logger.warn(ex);
  }

  const orgName = companyInfoRecord?.Name || 'Unknown Organization';

  const org: SalesforceOrgUi & { accessToken: string; refreshToken: string } = {
    uniqueId: `${userInfo.organizationId}-${userInfo.id}`,
    accessToken: conn.accessToken,
    refreshToken: conn.refreshToken,
    instanceUrl: conn.instanceUrl,
    loginUrl: state.get('loginUrl'),
    userId: identity.user_id,
    email: identity.email,
    organizationId: identity.organization_id,
    username: identity.username,
    displayName: identity.display_name,
    thumbnail: identity.photos?.thumbnail,
    orgName,
    orgCountry: companyInfoRecord?.Country,
    orgOrganizationType: companyInfoRecord?.OrganizationType,
    orgInstanceName: companyInfoRecord?.InstanceName,
    orgIsSandbox: companyInfoRecord?.IsSandbox,
    orgLanguageLocaleKey: companyInfoRecord?.LanguageLocaleKey,
    orgNamespacePrefix: companyInfoRecord?.NamespacePrefix,
    orgTrialExpirationDate: companyInfoRecord?.TrialExpirationDate,
    // TODO:  front-end needs to check this to see if it already has a value here
    label: identity.username,
    filterText: `${identity.username}${orgName}`,
  };

  return org;
}
