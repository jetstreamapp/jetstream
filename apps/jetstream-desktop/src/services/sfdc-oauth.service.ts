import { ApiConnection, ApiRequestError } from '@jetstream/salesforce-api';
import { ERROR_MESSAGES } from '@jetstream/shared/constants';
import { Maybe, SalesforceOrgUi, SalesforceUserInfo, SObjectOrganization } from '@jetstream/types';
import { safeStorage } from 'electron';
import logger from 'electron-log';
import { AuthorizationParameters, CallbackParamsType, generators, Issuer } from 'openid-client';
import { ENV } from '../config/environment';
import { createOrUpdateSalesforceOrg } from './persistence.service';

function getSalesforceAuthClient(loginUrl: string) {
  const { Client } = new Issuer({
    authorization_endpoint: `${loginUrl}/services/oauth2/authorize`,
    end_session_endpoint: `${loginUrl}/services/oauth2/logout`,
    issuer: loginUrl,
    jwks_uri: `${loginUrl}/id/keys`,
    registration_endpoint: `${loginUrl}/services/oauth2/register`,
    revocation_endpoint: `${loginUrl}/services/oauth2/revoke`,
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic', 'private_key_jwt'],
    token_endpoint: `${loginUrl}/services/oauth2/token`,
    userinfo_endpoint: `${loginUrl}/services/oauth2/userinfo`,
  });

  const authClient = new Client({
    client_id: ENV.DESKTOP_SFDC_CLIENT_ID,
    redirect_uris: [ENV.DESKTOP_SFDC_CALLBACK_URL],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
    token_endpoint_auth_signing_alg: 'RS256',
  });
  return authClient;
}

/**
 * Get redirectUrl and authData for Salesforce OAuth
 */
export function salesforceOauthInit(
  loginUrl: string,
  { loginHint, addLoginParam = false }: { addLoginParam?: boolean; loginHint?: string } = {},
) {
  // https://login.salesforce.com/.well-known/openid-configuration

  const nonce = generators.nonce();
  const code_verifier = generators.codeVerifier();
  const state = generators.state();
  const code_challenge = generators.codeChallenge(code_verifier);

  const authClient = getSalesforceAuthClient(loginUrl);

  const params: AuthorizationParameters = {
    code_challenge_method: 'S256',
    code_challenge,
    login_hint: loginHint,
    nonce,
    prompt: 'login',
    scope: 'api web refresh_token',
    state,
  };

  if (addLoginParam) {
    params['login'] = 'true';
  }

  const authorizationUrl = authClient.authorizationUrl(params);

  return { code_verifier, nonce, state, authorizationUrl };
}

/**
 * Verify OAuth callback and get access_token, refresh_token, and userInfo
 */
export async function salesforceOauthCallback(
  loginUrl: string,
  callbackQueryParams: CallbackParamsType,
  authData: {
    code_verifier: string;
    nonce: string;
    state: string;
  },
) {
  const authClient = getSalesforceAuthClient(loginUrl);

  const tokenSet = await authClient.oauthCallback(ENV.DESKTOP_SFDC_CALLBACK_URL, callbackQueryParams, authData);
  const { access_token, refresh_token } = tokenSet;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const userInfo = await authClient.userinfo<SalesforceUserInfo>(access_token!);

  return {
    access_token,
    refresh_token,
    userInfo,
  };
}

export async function salesforceOauthRefresh(loginUrl: string, refreshToken: string) {
  const authClient = getSalesforceAuthClient(loginUrl);
  const tokenSet = await authClient.refresh(refreshToken);
  const { access_token } = tokenSet;
  return {
    access_token,
  };
}

export async function initConnectionFromOAuthResponse({
  jetstreamConn,
  jetstreamOrganizationId,
}: {
  jetstreamConn: ApiConnection;
  jetstreamOrganizationId?: Maybe<string>;
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

  if (jetstreamOrganizationId) {
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
