import { ENV, logger } from '@jetstream/api-config';
import { HTTP } from '@jetstream/shared/constants';
import { SObjectOrganization, SalesforceOrgUi, UserProfileServer } from '@jetstream/types';
import { NextFunction, Request, Response } from 'express';
import * as jsforce from 'jsforce';
import { Issuer, generators } from 'openid-client';
import * as salesforceOrgsDb from '../db/salesforce-org.db';
import { createOrUpdateUser } from '../db/user.db';
import { getJsforceOauth2 } from '../utils/auth-utils';
import { AuthenticationError } from '../utils/error-handler';
import { OauthLinkParams } from './auth.controller';

const { Client } = new Issuer({
  issuer: ENV.CASDOOR_DOMAIN,
  authorization_endpoint: `${ENV.CASDOOR_DOMAIN}/login/oauth/authorize`,
  registration_endpoint: `${ENV.CASDOOR_DOMAIN}/signup/oauth/authorize`,
  token_endpoint: `${ENV.CASDOOR_DOMAIN}/api/login/oauth/access_token`,
  end_session_endpoint: `${ENV.CASDOOR_DOMAIN}/api/logout`,
  jwks_uri: `${ENV.CASDOOR_DOMAIN}/.well-known/jwks`,
  userinfo_endpoint: `${ENV.CASDOOR_DOMAIN}/api/userinfo`,
  introspection_endpoint: `${ENV.CASDOOR_DOMAIN}/api/login/oauth/introspect`,
  token_endpoint_auth_methods_supported: ['client_secret_basic'],
});

export const authClient = new Client({
  client_id: ENV.CASDOOR_CLIENT_ID,
  client_secret: ENV.CASDOOR_CLIENT_SECRET,
  redirect_uris: [`${ENV.JETSTREAM_SERVER_URL}/oauth/callback`],
});

function getAuthorizationUrl(prompt: 'login' | 'signup') {
  const nonce = generators.nonce();
  const code_verifier = generators.codeVerifier();
  const state = generators.state();
  // store the code_verifier in your framework's session mechanism, if it is a cookie based solution
  // it should be httpOnly (not readable by javascript) and encrypted.

  const code_challenge = generators.codeChallenge(code_verifier);

  let url = authClient.authorizationUrl({
    scope: 'openid email profile',
    // response_mode: 'form_post',
    // resource: 'https://my.api.example.com/resource/32178',
    nonce,
    state,
    code_challenge,
    code_challenge_method: 'S256',
  });

  if (prompt === 'signup') {
    url = url.replace('/login/', '/signup/');
  }

  logger.info('[AUTH][URL]', {
    nonce,
    state,
    code_verifier,
    code_challenge,
  });

  return { code_verifier, nonce, state, url };
}

export function signup(req: Request, res: Response) {
  const { code_verifier, nonce, state, url } = getAuthorizationUrl('signup');

  req.session.auth = { code_verifier, nonce, state };
  res.redirect(url);
}

export function login(req: Request, res: Response) {
  // TODO: check if user is already logged in and has a valid session
  const { code_verifier, nonce, state, url } = getAuthorizationUrl('login');

  req.session.auth = { code_verifier, nonce, state };
  res.redirect(url);
}

export function logout(req: Request, res: Response) {
  const url = authClient.endSessionUrl();
  // TODO: figure out how to logout of casdoor

  req.session.auth = { code_verifier, nonce, state };
  res.redirect(url);
}

export async function callback(req: Request, res: Response, next: NextFunction) {
  try {
    const authData = req.session.auth;
    req.session.auth = undefined;

    logger.info('[AUTH][CALLBACK] %s %s', req.method, req.originalUrl, { requestId: res.locals.requestId });
    // Exchange code for token
    const tokenSet = await authClient.callback(`${ENV.JETSTREAM_SERVER_URL}/oauth/callback`, req.query, {
      response_type: 'code',
      code_verifier: authData?.code_verifier,
      nonce: authData?.nonce,
      state: authData?.state,
    });

    // Exchange code for token
    const { access_token, refresh_token } = tokenSet;

    if (!access_token) {
      return next(new AuthenticationError('Invalid access token'));
    }

    logger.info('[AUTH][EXCHANGE VERIFIED] %s %s', req.method, req.originalUrl, { requestId: res.locals.requestId });

    const introspect = await authClient.introspect(access_token);
    const userInfo = await authClient.userinfo(access_token);

    const { user } = await createOrUpdateUser({
      email: userInfo.email!,
      email_verified: false,
      // Set from environment variable, could be different
      'http://getjetstream.app/app_metadata': {
        featureFlags: {
          flagVersion: '1.0',
          flags: ['all'],
          isDefault: true,
        },
      },
      name: userInfo.name!,
      nickname: userInfo.name!,
      picture: userInfo.picture,
      sub: userInfo.sub!,
      updated_at: '',
    });

    req.session.regenerate((err) => {
      if (err) {
        return next(new AuthenticationError('Unable to initiate session'));
      }
      req.session.accessToken = access_token;
      req.session.refreshToken = refresh_token;
      req.session.user = user;
      req.user = user;

      logger.info('[AUTH][SUCCESS] Logged in %s', user.email, { userId: user.id, requestId: res.locals.requestId });

      req.session.save(function (err) {
        if (err) {
          return next(new AuthenticationError('Unable to save session'));
        }
        const returnTo = (req.session as any).returnTo;
        res.redirect(returnTo || ENV.JETSTREAM_CLIENT_URL);
      });
    });
  } catch (ex) {
    console.log(ex);
    logger.error('[AUTH][UNAUTHORIZED][CODE-VERIFICATION] %s %s', req.method, req.originalUrl, {
      message: ex.message,
      blocked: true,
      method: req.method,
      url: req.originalUrl,
      requestId: res.locals.requestId,
      agent: req.header('User-Agent'),
      ip: req.headers[HTTP.HEADERS.CF_Connecting_IP] || req.headers[HTTP.HEADERS.X_FORWARDED_FOR] || req.connection.remoteAddress,
      country: req.headers[HTTP.HEADERS.CF_IPCountry],
    });
    next(new AuthenticationError('Unauthorized'));
  }
}

/**
 * Prepare SFDC auth and redirect to Salesforce
 * @param req
 * @param res
 */
export function salesforceOauthInitAuth(req: Request, res: Response) {
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
export async function salesforceOauthCallback(req: Request, res: Response) {
  const user = req.user as UserProfileServer;
  const state = new URLSearchParams(req.query.state as string);
  const loginUrl = state.get('loginUrl');
  const clientUrl = state.get('clientUrl') || new URL(ENV.JETSTREAM_CLIENT_URL).origin;
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
  const identity = await conn.identity();
  let companyInfoRecord: SObjectOrganization | undefined;

  try {
    const results = await conn.query<SObjectOrganization>(
      `SELECT Id, Name, Country, OrganizationType, InstanceName, IsSandbox, LanguageLocaleKey, NamespacePrefix, TrialExpirationDate FROM Organization`
    );
    if (results.totalSize > 0) {
      companyInfoRecord = results.records[0];
    }
  } catch (ex) {
    logger.warn('Error getting org info %o', ex);
  }

  const orgName = companyInfoRecord?.Name || 'Unknown Organization';

  const salesforceOrgUi: Partial<SalesforceOrgUi> = {
    uniqueId: `${userInfo.organizationId}-${userInfo.id}`,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    accessToken: salesforceOrgsDb.encryptAccessToken(conn.accessToken, conn.refreshToken!),
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

  const salesforceOrg = await salesforceOrgsDb.createOrUpdateSalesforceOrg(userId, salesforceOrgUi);
  return salesforceOrg;
}
