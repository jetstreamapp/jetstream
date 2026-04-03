import { ApiConnection, getApiRequestFactoryFn } from '@jetstream/salesforce-api';
import { logger } from '@jetstream/shared/client-logger';
import type { SalesforceOrgUi, SObjectOrganization } from '@jetstream/types';
import { isObjectLike } from 'lodash';
import { OrgAndApiConnection } from './canvas.types';

export const fetchFn: Parameters<typeof getApiRequestFactoryFn>[0] = (url, options) => {
  return new Promise<Response>((resolve, reject) => {
    const headers = (options.headers as Record<string, string>) || {};
    const contentType = Object.entries(headers).find(([key]) => key.toLowerCase() === 'content-type')?.[1] || 'application/json';
    window.Sfdc.canvas.client.ajax(url, {
      client: sr.client,
      method: options.method,
      async: true,
      contentType,
      headers,
      data: options.body,
      // targetOrigin
      success: ({ payload, status, statusText }) => {
        payload = isObjectLike(payload) ? JSON.stringify(payload) : payload;
        // Headers are intentionally omitted — callout-adapter.ts parses the response
        // based on the caller-specified `outputType`, not content-type headers.
        resolve(new Response(payload, { status, statusText }));
      },
      failure: (responseText, xhr) => {
        reject(new Error(`Canvas AJAX failed: ${xhr.status} ${responseText}`));
      },
    });
  });
};

export function initApiClient(): ApiConnection {
  return new ApiConnection({
    apiRequestAdapter: getApiRequestFactoryFn(fetchFn),
    userId: 'unknown',
    organizationId: 'unknown',
    accessToken: window.sr.client.oauthToken,
    apiVersion: window.sr.context.environment.version.api,
    instanceUrl: window.sr.client.instanceUrl,
    // refreshToken: window.sr.client.refreshToken, // TODO: do we need/want to use this?
    logger,
    logging: false,
  });
}

export async function initApiClientAndOrg(): Promise<OrgAndApiConnection> {
  const apiConnection = initApiClient();
  const apiVersion = window.sr.context.environment.version.api;

  // https://login.salesforce.com/id/00D6g000008KX1jEAG/0056g000004tCpaAAE
  const [userId, organizationId] = (await apiConnection.org.discovery()).identity.split('/').reverse().slice(0, 2);

  apiConnection.updateSessionInfo({ apiVersion, userId, organizationId });

  const identity = await apiConnection.org.identity();

  let companyInfoRecord: SObjectOrganization | undefined;

  try {
    const { queryResults } = await apiConnection.query.query<SObjectOrganization>(
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
    accessToken: window.sr.client.oauthToken,
    instanceUrl: window.sr.client.instanceUrl,
    loginUrl: window.sr.client.instanceUrl,
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
