import { ENV, logger } from '@jetstream/api-config';
import { UserProfileServer } from '@jetstream/types';
import * as express from 'express';
import * as jsforce from 'jsforce';
import * as salesforceOrgsDb from '../db/salesforce-org.db';
import { addCompanyInformationAndSaveOrg } from '../services/sf-misc';
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
  const state = new URLSearchParams({ loginUrl, clientUrl }).toString();

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
  const clientUrl = state.get('clientUrl') || new URL(ENV.JETSTREAM_CLIENT_URL!).origin;
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
      logger.info('[OAUTH][ERROR] %s', req.query.error, { ...req.query, requestId: res.locals.requestId });
      return res.redirect(`/oauth-link/?${new URLSearchParams(returnParams as any).toString()}`);
    }

    const conn = new jsforce.Connection({ oauth2: getJsforceOauth2(loginUrl as string) });
    const userInfo = await conn.authorize(req.query.code as string);

    const salesforceOrg = await initConnectionFromOAuthResponse({
      conn,
      userInfo,
      loginUrl: loginUrl as string,
      userId: user.id,
    });

    returnParams.data = JSON.stringify(salesforceOrg);
    return res.redirect(`/oauth-link/?${new URLSearchParams(returnParams as any).toString()}`);
  } catch (ex) {
    const userInfo = req.user ? { username: (req.user as any)?.displayName, userId: (req.user as any)?.user_id } : undefined;
    logger.info('[OAUTH][ERROR] %o', ex.message, { userInfo, requestId: res.locals.requestId });
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
}: {
  conn: jsforce.Connection;
  userInfo: jsforce.UserInfo;
  loginUrl: string;
  userId: string;
}) {
  return addCompanyInformationAndSaveOrg(userId, `${userInfo.organizationId}-${userInfo.id}`, conn, {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    accessToken: salesforceOrgsDb.encryptAccessToken(conn.accessToken, conn.refreshToken!),
    instanceUrl: conn.instanceUrl,
    loginUrl,
  });
}
