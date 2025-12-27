import { ApiConnection, ApiRequestError } from '@jetstream/salesforce-api';
import { ERROR_MESSAGES } from '@jetstream/shared/constants';
import { Maybe, SalesforceOrgUi, SObjectOrganization } from '@jetstream/types';
import { safeStorage } from 'electron';
import logger from 'electron-log';
import { createOrUpdateSalesforceOrg } from './persistence.service';

export async function initConnectionFromOAuthResponse({
  jetstreamConn,
  orgGroupId,
}: {
  jetstreamConn: ApiConnection;
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
    // TODO: we also need to store the refresh token - we can encrypt, but we don't have a way to securely store the key
    accessToken: safeStorage
      .encryptString(`${jetstreamConn.sessionInfo.accessToken} ${jetstreamConn.sessionInfo.refreshToken}`)
      .toString('base64'),
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

  if (orgGroupId) {
    // TODO: figure out org storage and organizations
    // try {
    //   salesforceOrgUi.jetstreamOrganizationId = (await jetstreamOrganizationsDb.findById({ id: jetstreamOrganizationId, userId })).id;
    // } catch (ex) {
    //   logger.warn(
    //     { userId, jetstreamOrganizationId, ...getExceptionLog(ex) },
    //     'Error getting jetstream org with provided id %s',
    //     getErrorMessage(ex)
    //   );
    // }
  }

  const salesforceOrg = await createOrUpdateSalesforceOrg(salesforceOrgUi);
  return salesforceOrg;
}
