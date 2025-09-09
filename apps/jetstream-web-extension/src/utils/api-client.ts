import { ApiConnection, getApiRequestFactoryFn } from '@jetstream/salesforce-api';
import { logger } from '@jetstream/shared/client-logger';
import type { SalesforceOrgUi, SObjectOrganization } from '@jetstream/types';
import { OrgAndApiConnection, SessionInfo } from './extension.types';

export function initApiClient({ key: accessToken, hostname }: SessionInfo): ApiConnection {
  const instanceUrl = `https://${hostname}`;
  return new ApiConnection({
    apiRequestAdapter: getApiRequestFactoryFn(fetch),
    userId: 'unknown',
    organizationId: 'unknown',
    accessToken,
    apiVersion: '63.0', // FIXME: this should not be hard-coded
    instanceUrl,
    // refreshToken: refresh_token,
    logger,
    logging: false,
  });
}

export async function initApiClientAndOrg(sessionInfo: SessionInfo): Promise<OrgAndApiConnection> {
  const instanceUrl = `https://${sessionInfo.hostname}`;

  const apiConnection = initApiClient(sessionInfo);

  const versions = await apiConnection.org.apiVersions();
  const apiVersion = versions.reverse()[0].version;

  // https://login.salesforce.com/id/00D6g000008KX1jEAG/0056g000004tCpaAAE
  const [userId, organizationId] = (await apiConnection.org.discovery()).identity.split('/').reverse().slice(0, 2);

  apiConnection.updateSessionInfo({ apiVersion, userId, organizationId });

  const identity = await apiConnection.org.identity();

  let companyInfoRecord: SObjectOrganization | undefined;

  try {
    const { queryResults } = await await apiConnection.query.query<SObjectOrganization>(
      `SELECT Id, Name, Country, OrganizationType, InstanceName, IsSandbox, LanguageLocaleKey, NamespacePrefix, TrialExpirationDate FROM Organization`,
    );
    if (queryResults.totalSize > 0) {
      companyInfoRecord = queryResults.records[0];
    }
  } catch (ex) {
    logger.warn('Error getting org info %o', ex);
  }

  const org: SalesforceOrgUi = {
    uniqueId: `${identity.organization_id}-${identity.user_id}`,
    label: identity.username,
    filterText: identity.username,
    accessToken: sessionInfo.key,
    instanceUrl,
    loginUrl: instanceUrl,
    userId: identity.user_id,
    email: identity.email,
    organizationId: identity.organization_id,
    username: identity.username,
    displayName: identity.display_name,
    thumbnail: identity.photos?.thumbnail,
    orgName: companyInfoRecord?.Name || 'Unknown Organization',
    orgCountry: companyInfoRecord?.Country,
    orgOrganizationType: companyInfoRecord?.OrganizationType,
    orgInstanceName: companyInfoRecord?.InstanceName,
    orgIsSandbox: companyInfoRecord?.IsSandbox,
    orgLanguageLocaleKey: companyInfoRecord?.LanguageLocaleKey,
    orgNamespacePrefix: companyInfoRecord?.NamespacePrefix,
    orgTrialExpirationDate: companyInfoRecord?.TrialExpirationDate,
  };

  // return new ApiClient(sessionInfo, apiVersion, org);
  return { org, apiConnection };
}
