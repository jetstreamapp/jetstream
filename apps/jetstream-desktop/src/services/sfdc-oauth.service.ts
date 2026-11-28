import { ApiConnection, ApiRequestError } from '@jetstream/salesforce-api';
import { ERROR_MESSAGES } from '@jetstream/shared/constants';
import { Maybe, SalesforceOrgUi, SObjectOrganization } from '@jetstream/types';
import logger from 'electron-log';
import { createOrUpdateSalesforceOrg, encryptTokenPortable, getOrgGroups } from './persistence.service';

export async function initConnectionFromOAuthResponse({
  jetstreamConn,
  orgGroupId,
}: {
  jetstreamConn: ApiConnection;
  /** The org group to place the org in, which is the one the user was in when they connected it */
  orgGroupId?: Maybe<string>;
}) {
  const identity = await jetstreamConn.org.identity();
  let companyInfoRecord: SObjectOrganization | undefined;

  try {
    const { queryResults: results } = await jetstreamConn.query.query<SObjectOrganization>(
      `SELECT Id, Name, Country, OrganizationType, InstanceName, IsSandbox, LanguageLocaleKey, NamespacePrefix, TrialExpirationDate FROM Organization`,
    );
    if (results.totalSize > 0) {
      companyInfoRecord = results.records[0];
    }
  } catch (ex) {
    logger.warn({ ex }, 'Error getting org info %o', ex);
    if (ex instanceof ApiRequestError && ERROR_MESSAGES.SFDC_REST_API_NOT_ENABLED.test(ex.message)) {
      throw new Error(ERROR_MESSAGES.SFDC_REST_API_NOT_ENABLED_MSG);
    }
  }

  const orgName = companyInfoRecord?.Name || 'Unknown Organization';

  const salesforceOrgUi: Partial<SalesforceOrgUi> = {
    uniqueId: `${jetstreamConn.sessionInfo.organizationId}-${jetstreamConn.sessionInfo.userId}`,
    accessToken: encryptTokenPortable(`${jetstreamConn.sessionInfo.accessToken} ${jetstreamConn.sessionInfo.refreshToken}`),
    instanceUrl: jetstreamConn.sessionInfo.instanceUrl,
    loginUrl: jetstreamConn.sessionInfo.instanceUrl,
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
  };

  // A group that no longer exists is ignored. An org that is reconnected without a group stays in the one it is in.
  if (orgGroupId && getOrgGroups().some(({ id }) => id === orgGroupId)) {
    salesforceOrgUi.jetstreamOrganizationId = orgGroupId;
  }

  const salesforceOrg = await createOrUpdateSalesforceOrg(salesforceOrgUi);
  return salesforceOrg;
}
