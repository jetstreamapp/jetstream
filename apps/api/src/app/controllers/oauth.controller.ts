import { ENV, getExceptionLog, logger } from '@jetstream/api-config';
import { ApiConnection, getApiRequestFactoryFn } from '@jetstream/salesforce-api';
import { LogToUserProfile, SObjectOrganization, SalesforceOrgUi, UserProfileServer } from '@jetstream/types';
import { CallbackParamsType, generators } from 'openid-client';
import { z } from 'zod';
import * as salesforceOrgsDb from '../db/salesforce-org.db';
import { createOrUpdateUser } from '../db/user.db';
import * as authM2MService from '../services/auth-m2m.service';
import {
  JETSTREAM_CALLBACK_URL,
  handleOauthCallback,
  initOauthAuthorization,
  jetstreamAuthClient,
  salesforceOauthCallback,
  salesforceOauthInit,
} from '../services/oauth.service';
import { AuthenticationError } from '../utils/error-handler';
import { createRoute } from '../utils/route.utils';
import { OauthLinkParams } from './auth.controller';

export const routeDefinition = {
  signup: {
    controllerFn: () => signup,
    validators: {
      hasSourceOrg: false,
      query: z.record(z.any()), // TODO: add validators
      // FIXME: add validators
    },
  },
  login: {
    controllerFn: () => login,
    validators: {
      hasSourceOrg: false,
      query: z.record(z.any()), // TODO: add validators
      // FIXME: add validators
    },
  },
  logout: {
    controllerFn: () => logout,
    validators: {
      hasSourceOrg: false,
      query: z.record(z.any()), // TODO: add validators
      // FIXME: add validators
    },
  },
  oauthCallback: {
    controllerFn: () => oauthCallback,
    validators: {
      hasSourceOrg: false,
      query: z.record(z.any()), // TODO: add validators
      // FIXME: add validators
    },
  },
  linkIdentity: {
    controllerFn: () => linkIdentity,
    validators: {
      hasSourceOrg: false,
      query: z.object({
        connection: z.union([z.literal('google'), z.literal('salesforce'), z.literal('github')]),
      }), // TODO: add validators
      // FIXME: add validators
    },
  },
  linkIdentityOauthCallback: {
    controllerFn: () => linkIdentityOauthCallback,
    validators: {
      hasSourceOrg: false,
      query: z.record(z.any()), // TODO: add validators
      // FIXME: add validators
    },
  },
  salesforceOauthInitAuth: {
    controllerFn: () => salesforceOauthInitAuth,
    validators: {
      query: z.object({
        loginUrl: z.string().min(1),
      }),
      hasSourceOrg: false,
    },
  },
  salesforceOauthCallback: {
    controllerFn: () => salesforceOauthCallbackFn,
    validators: {
      query: z.record(z.any()),
      hasSourceOrg: false,
    },
  },
};

const signup = createRoute(routeDefinition.signup.validators, async ({ query }, req, res, next) => {
  // TODO: if valid session shouold we skip redirect?
  // TODO: what about example user flow?
  const { authorizationUrl, code_verifier, nonce, state } = initOauthAuthorization(jetstreamAuthClient);
  req.session.authState = { code_verifier, nonce, state };
  res.redirect(`${authorizationUrl}&first_screen=register`);
});

const login = createRoute(routeDefinition.login.validators, async ({ query }, req, res, next) => {
  // TODO: if valid session shouold we skip redirect?
  // TODO: what about example user flow?
  const { authorizationUrl, code_verifier, nonce, state } = initOauthAuthorization(jetstreamAuthClient, {
    scope: 'openid email profile identities',
  });
  req.session.authState = { code_verifier, nonce, state };
  res.redirect(`${authorizationUrl}&first_screen=signIn`);
});

const logout = createRoute(routeDefinition.logout.validators, async ({ query }, req, res, next) => {
  try {
    req.session.destroy(() => {
      res.redirect(
        jetstreamAuthClient.endSessionUrl({
          post_logout_redirect_uri: ENV.JETSTREAM_SERVER_URL,
        })
      );
    });
  } catch (ex) {
    req.log.error({ ...getExceptionLog(ex) }, '[AUTH][ERROR] Error logging out');
    return next(new AuthenticationError(ex));
  }
});

const oauthCallback = createRoute(routeDefinition.oauthCallback.validators, async ({ query }, req, res, next) => {
  try {
    if (!req.session.authState) {
      req.log.error({ query }, '[AUTH][ERROR] Callback missing authState from session');
      throw new Error('Missing authState from session, cannot verify callback');
    }
    req.log.error({ query }, '[AUTH] Validating authentication callback');
    const { tokenSet, userInfo } = await handleOauthCallback<LogToUserProfile>(
      jetstreamAuthClient,
      JETSTREAM_CALLBACK_URL,
      query,
      req.session.authState
    );

    const user: UserProfileServer = {
      provider: 'logto',
      id: userInfo.sub,
      displayName: userInfo.name || userInfo.email,
      emails: [{ value: userInfo.email }],
      name: userInfo.name,
      nickname: userInfo.sub || userInfo.email,
      picture: userInfo.picture,
      user_id: userInfo.sub,
      _json: {
        sub: userInfo.sub,
        nickname: userInfo.sub || userInfo.email,
        name: userInfo.name || userInfo.email,
        picture: userInfo.picture,
        updated_at: userInfo.updated_at ? new Date(userInfo.updated_at).toISOString() : new Date().toISOString(),
        email: userInfo.email,
        email_verified: !!userInfo.email_verified,
        // TODO: we should deprecate this in favor of some other featureFlag implementation
        'http://getjetstream.app/app_metadata': {
          featureFlags: { flagVersion: 'V1.4', flags: ['all'], isDefault: false },
        },
      },
      _raw: JSON.stringify(userInfo),
    };

    delete req.session.orgAuth;
    // req.session.tokenSet = tokenSet; // TODO: store tokens so that we can do refresh flow to ensure auth is always valid
    req.log.info('[AUTH][SUCCESS] Logged in %s', userInfo.email);

    await createOrUpdateUser(user);

    req.session.regenerate((err) => {
      if (err) {
        req.log.error({ ...getExceptionLog(err) }, '[AUTH][ERROR] Error regenerating session');
        res.redirect(`/`);
        // return next(new AuthenticationError(err)); // TODO: should we do this?
        return;
      }
      req.session.save((err) => {
        if (err) {
          req.log.error({ ...getExceptionLog(err) }, '[AUTH][ERROR] Error saving session');
          res.redirect(`/`);
          // return next(new AuthenticationError(err)); // TODO: should we do this?
          return;
        }
        req.log.info('[AUTH][SUCCESS] Logged in %s', userInfo.email);
        // TODO: implement returnTo in case user was somewhere else when session expired
        res.redirect(ENV.JETSTREAM_CLIENT_URL!);
        req.session.user = user;
        req.user = user;
      });
    });
  } catch (ex) {
    req.session.destroy(() => {
      req.log.error({ ...getExceptionLog(ex) }, '[AUTH][ERROR] Error validating authentication callback');
      res.redirect(`/?${new URLSearchParams({ error: ex.message }).toString()}`);
      // return next(new AuthenticationError(ex)); // TODO: would this work? need to check out path
    });
  }
});

const linkIdentity = createRoute(routeDefinition.linkIdentity.validators, async ({ query }, req, res, next) => {
  const connection = query.connection;
  if (!connection) {
    throw new Error('Connection not provided');
  }
  const state = generators.state();
  const { redirectTo } = await authM2MService.getConnectorAuthorizationUrl(
    req.user as UserProfileServer,
    connection,
    state,
    `${ENV.JETSTREAM_SERVER_URL}/oauth/identity/link/callback`
  );

  // TODO: add link to session
  req.session.identityLink = {
    expiration: new Date().getTime() + 1000 * 60 * 5, // 5 minutes
    state,
  };

  res.redirect(redirectTo);
});

const linkIdentityOauthCallback = createRoute(routeDefinition.linkIdentityOauthCallback.validators, async ({ query }, req, res, next) => {
  try {
    if (!req.session.identityLink) {
      req.log.error({ query }, '[AUTH][ERROR] Callback missing authState from session');
      throw new Error('Missing authorization state from session, cannot verify callback');
    }
    if (req.session.identityLink.expiration < new Date().getTime()) {
      req.log.error({ query }, '[AUTH][LINK][ERROR] Linking identity session expired');
    }
    console.log('query', query);
    throw new Error('Not implemented');
  } catch (ex) {
    req.log.error({ ...getExceptionLog(ex) }, '[AUTH][LINK][ERROR] Error linking identity');
    res.redirect(`/oauth-link/?${new URLSearchParams({ error: ex.message }).toString()}`);
  }
});

/**
 * Prepare SFDC auth and redirect to Salesforce
 * @param req
 * @param res
 */
const salesforceOauthInitAuth = createRoute(routeDefinition.salesforceOauthInitAuth.validators, async ({ query }, req, res, next) => {
  const loginUrl = query.loginUrl;
  const { authorizationUrl, code_verifier, nonce, state } = salesforceOauthInit(loginUrl);
  req.session.orgAuth = { code_verifier, nonce, state, loginUrl };
  res.redirect(authorizationUrl);
});

/**
 * Prepare SFDC auth and redirect to Salesforce
 * @param req
 * @param res
 */
const salesforceOauthCallbackFn = createRoute(
  routeDefinition.salesforceOauthCallback.validators,
  async ({ query, user }, req, res, next) => {
    const queryParams = query as CallbackParamsType;
    const clientUrl = new URL(ENV.JETSTREAM_CLIENT_URL!).origin;
    const returnParams: OauthLinkParams = {
      type: 'salesforce',
      clientUrl,
    };

    try {
      const orgAuth = req.session.orgAuth;
      req.session.orgAuth = undefined;

      // ERROR PATH
      if (queryParams.error) {
        returnParams.error = (queryParams.error as string) || 'Unexpected Error';
        returnParams.message = queryParams.error_description
          ? (queryParams.error_description as string)
          : 'There was an error authenticating with Salesforce.';
        req.log.info({ ...query, requestId: res.locals.requestId, queryParams }, '[OAUTH][ERROR] %s', queryParams.error);
        return res.redirect(`/oauth-link/?${new URLSearchParams(returnParams as any).toString().replaceAll('+', '%20')}`);
      } else if (!orgAuth) {
        returnParams.error = 'Authentication Error';
        returnParams.message = queryParams.error_description
          ? (queryParams.error_description as string)
          : 'There was an error authenticating with Salesforce.';
        req.log.info({ ...query, requestId: res.locals.requestId, queryParams }, '[OAUTH][ERROR] Missing orgAuth from session');
        return res.redirect(`/oauth-link/?${new URLSearchParams(returnParams as any).toString().replaceAll('+', '%20')}`);
      }

      const { code_verifier, nonce, state, loginUrl } = orgAuth;

      const { tokenSet, userInfo } = await salesforceOauthCallback(loginUrl, query, {
        code_verifier,
        nonce,
        state,
      });
      const { access_token, refresh_token } = tokenSet;

      const jetstreamConn = new ApiConnection({
        apiRequestAdapter: getApiRequestFactoryFn(fetch),
        userId: userInfo.user_id,
        organizationId: userInfo.organization_id,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        accessToken: access_token!,
        apiVersion: ENV.SFDC_API_VERSION,
        instanceUrl: userInfo.urls.custom_domain || loginUrl,
        refreshToken: refresh_token,
        logging: ENV.LOG_LEVEL === 'trace',
      });

      const salesforceOrg = await initConnectionFromOAuthResponse({
        jetstreamConn,
        userId: user.id,
      });

      returnParams.data = JSON.stringify(salesforceOrg);
      return res.redirect(`/oauth-link/?${new URLSearchParams(returnParams as any).toString().replaceAll('+', '%20')}`);
    } catch (ex) {
      req.log.info({ ...getExceptionLog(ex) }, '[OAUTH][ERROR]');
      returnParams.error = ex.message || 'Unexpected Error';
      returnParams.message = query.error_description
        ? (query.error_description as string)
        : 'There was an error authenticating with Salesforce.';
      return res.redirect(`/oauth-link/?${new URLSearchParams(returnParams as any).toString().replaceAll('+', '%20')}`);
    }
  }
);

export async function initConnectionFromOAuthResponse({ jetstreamConn, userId }: { jetstreamConn: ApiConnection; userId: string }) {
  const identity = await jetstreamConn.org.identity();
  let companyInfoRecord: SObjectOrganization | undefined;

  try {
    const { queryResults: results } = await jetstreamConn.query.query<SObjectOrganization>(
      `SELECT Id, Name, Country, OrganizationType, InstanceName, IsSandbox, LanguageLocaleKey, NamespacePrefix, TrialExpirationDate FROM Organization`
    );
    if (results.totalSize > 0) {
      companyInfoRecord = results.records[0];
    }
  } catch (ex) {
    logger.warn({ userId, ...getExceptionLog(ex) }, 'Error getting org info %o', ex);
  }

  const orgName = companyInfoRecord?.Name || 'Unknown Organization';

  const salesforceOrgUi: Partial<SalesforceOrgUi> = {
    uniqueId: `${jetstreamConn.sessionInfo.organizationId}-${jetstreamConn.sessionInfo.userId}`,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    accessToken: salesforceOrgsDb.encryptAccessToken(jetstreamConn.sessionInfo.accessToken, jetstreamConn.sessionInfo.refreshToken!),
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

  const salesforceOrg = await salesforceOrgsDb.createOrUpdateSalesforceOrg(userId, salesforceOrgUi);
  return salesforceOrg;
}
