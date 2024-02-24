import { ENV, logger } from '@jetstream/api-config';
import { ApiConnection, getApiRequestFactoryFn } from '@jetstream/salesforce-api';
import { SObjectOrganization, SalesforceOrgUi } from '@jetstream/types';
import { CallbackParamsType } from 'openid-client';
import { z } from 'zod';
import * as salesforceOrgsDb from '../db/salesforce-org.db';
import * as oauthService from '../services/oauth.service';
import { createRoute } from '../utils/route.utils';
import { OauthLinkParams } from './auth.controller';

export const routeDefinition = {
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
    controllerFn: () => salesforceOauthCallback,
    validators: {
      query: z.record(z.any()),
      hasSourceOrg: false,
    },
  },
};

/**
 * Prepare SFDC auth and redirect to Salesforce
 * @param req
 * @param res
 */
const salesforceOauthInitAuth = createRoute(routeDefinition.salesforceOauthInitAuth.validators, async ({ query }, req, res, next) => {
  const loginUrl = query.loginUrl;
  const { authorizationUrl, code_verifier, nonce, state } = oauthService.salesforceOauthInit(loginUrl);
  req.session.orgAuth = { code_verifier, nonce, state, loginUrl };
  res.redirect(authorizationUrl);
});

/**
 * Prepare SFDC auth and redirect to Salesforce
 * @param req
 * @param res
 */
const salesforceOauthCallback = createRoute(routeDefinition.salesforceOauthCallback.validators, async ({ query, user }, req, res, next) => {
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
      logger.info('[OAUTH][ERROR] %s', queryParams.error, { ...query, requestId: res.locals.requestId });
      return res.redirect(`/oauth-link/?${new URLSearchParams(returnParams as any).toString().replaceAll('+', '%20')}`);
    } else if (!orgAuth) {
      returnParams.error = 'Authentication Error';
      returnParams.message = queryParams.error_description
        ? (queryParams.error_description as string)
        : 'There was an error authenticating with Salesforce.';
      logger.info('[OAUTH][ERROR] %s', queryParams.error, { ...query, requestId: res.locals.requestId });
      return res.redirect(`/oauth-link/?${new URLSearchParams(returnParams as any).toString().replaceAll('+', '%20')}`);
    }

    const { code_verifier, nonce, state, loginUrl } = orgAuth;

    const { access_token, refresh_token, userInfo } = await oauthService.salesforceOauthCallback(loginUrl, query, {
      code_verifier,
      nonce,
      state,
    });

    const jetstreamConn = new ApiConnection({
      apiRequestAdapter: getApiRequestFactoryFn(fetch),
      userId: userInfo.user_id,
      organizationId: userInfo.organization_id,
      accessToken: access_token!,
      apiVersion: ENV.SFDC_API_VERSION,
      instanceUrl: userInfo.urls.custom_domain || loginUrl,
      refreshToken: refresh_token,
      logging: ENV.ENVIRONMENT === 'development',
    });

    const salesforceOrg = await initConnectionFromOAuthResponse({
      jetstreamConn,
      userId: user.id,
    });

    returnParams.data = JSON.stringify(salesforceOrg);
    return res.redirect(`/oauth-link/?${new URLSearchParams(returnParams as any).toString().replaceAll('+', '%20')}`);
  } catch (ex) {
    const userInfo = req.user ? { username: (req.user as any)?.displayName, userId: (req.user as any)?.user_id } : undefined;
    logger.info('[OAUTH][ERROR] %s', ex.message, { userInfo, requestId: res.locals.requestId });
    returnParams.error = ex.message || 'Unexpected Error';
    returnParams.message = query.error_description
      ? (query.error_description as string)
      : 'There was an error authenticating with Salesforce.';
    return res.redirect(`/oauth-link/?${new URLSearchParams(returnParams as any).toString().replaceAll('+', '%20')}`);
  }
});

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
    logger.warn('Error getting org info %o', ex);
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
