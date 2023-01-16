import { ENV, logger } from '@jetstream/api-config';
import { SalesforceOrgUi, SObjectOrganization, UserProfileServer } from '@jetstream/types';
import * as express from 'express';
import * as jsforce from 'jsforce';
import * as salesforceOrgsDb from '../db/salesforce-org.db';
import { getJsforceOauth2 } from '../utils/auth-utils';
import { OauthLinkParams } from './auth.controller';

/**
 * Prepare SFDC auth and redirect to Salesforce
 * @param req
 * @param res
 */
export function salesforceOauthInitAuth(req: express.Request, res: express.Response) {
  const loginUrl = req.query.loginUrl as string;
  const clientUrl = req.query.clientUrl as string;
  const replaceOrgUniqueId = req.query.replaceOrgUniqueId as string | undefined;
  const state = new URLSearchParams({ loginUrl, clientUrl, replaceOrgUniqueId }).toString();

  let options = {
    scope: 'api web refresh_token',
    state,
    prompt: 'login',
  };

  if (req.query.username) {
    options = Object.assign(options, { login_hint: req.query.username });
  }

  res.redirect(getJsforceOauth2(loginUrl).getAuthorizationUrl(options));
}

/**
 * Prepare SFDC auth and redirect to Salesforce
 * @param req
 * @param res
 */
export async function salesforceOauthCallback(req: express.Request, res: express.Response) {
  const user = req.user as UserProfileServer;
  const state = new URLSearchParams(req.query.state as string);
  const loginUrl = state.get('loginUrl');
  const clientUrl = state.get('clientUrl') || new URL(ENV.JETSTREAM_CLIENT_URL).origin;
  const replaceOrgUniqueId = state.get('replaceOrgUniqueId') || undefined;
  const returnParams: OauthLinkParams = {
    type: 'salesforce',
    clientUrl,
  };

  try {
    // ERROR PATH
    if (req.query.error) {
      returnParams.error = (req.query.error as string) || 'Unexpected Error';
      returnParams.message = req.query.error_description
        ? (req.query.error_description as string)
        : 'There was an error authenticating with Salesforce.';
      logger.info('[OAUTH][ERROR] %s', req.query.error, { ...req.query });
      return res.redirect(`/oauth-link/?${new URLSearchParams(returnParams as any).toString()}`);
    }

    const conn = new jsforce.Connection({ oauth2: getJsforceOauth2(loginUrl as string) });
    const userInfo = await conn.authorize(req.query.code as string);

    const salesforceOrg = await initConnectionFromOAuthResponse({
      conn,
      userInfo,
      loginUrl,
      userId: user.id,
      replaceOrgUniqueId,
    });

    // TODO: figure out what other data we need
    // try {
    // TODO: what about if a user is assigned a permission set that gives PermissionsModifyAllData?
    //   const data = await getExtendedOrgInfo(conn, returnObject);
    //   returnObject = Object.assign({}, returnObject, data);
    // } catch (ex) {
    //   logger.log('Error adding extended org data');
    // }

    returnParams.data = JSON.stringify(salesforceOrg);
    return res.redirect(`/oauth-link/?${new URLSearchParams(returnParams as any).toString()}`);
  } catch (ex) {
    const userInfo = req.user ? { username: (req.user as any)?.displayName, userId: (req.user as any)?.user_id } : undefined;
    logger.info('[OAUTH][ERROR] %o', ex.message, { userInfo });
    returnParams.error = ex.message || 'Unexpected Error';
    returnParams.message = req.query.error_description
      ? (req.query.error_description as string)
      : 'There was an error authenticating with Salesforce.';
    return res.redirect(`/oauth-link/?${new URLSearchParams(returnParams as any).toString()}`);
  }
}

export async function initConnectionFromOAuthResponse({
  conn,
  userInfo,
  loginUrl,
  userId,
  replaceOrgUniqueId,
}: {
  conn: jsforce.Connection;
  userInfo: jsforce.UserInfo;
  loginUrl: string;
  userId: string;
  replaceOrgUniqueId?: string;
}) {
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

  const salesforceOrgUi: Partial<SalesforceOrgUi> = {
    uniqueId: `${userInfo.organizationId}-${userInfo.id}`,
    accessToken: salesforceOrgsDb.encryptAccessToken(conn.accessToken, conn.refreshToken),
    instanceUrl: conn.instanceUrl,
    loginUrl,
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

  const salesforceOrg = await salesforceOrgsDb.createOrUpdateSalesforceOrg(userId, salesforceOrgUi, replaceOrgUniqueId);
  return salesforceOrg;
}
