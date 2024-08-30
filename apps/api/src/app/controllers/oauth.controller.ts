import { ENV, getExceptionLog, logger } from '@jetstream/api-config';
import { ApiConnection, ApiRequestError, getApiRequestFactoryFn } from '@jetstream/salesforce-api';
import { ERROR_MESSAGES, HTTP } from '@jetstream/shared/constants';
import { SObjectOrganization, SalesforceOrgUi } from '@jetstream/types';
import cookie from 'cookie';
import { CallbackParamsType } from 'openid-client';
import { z } from 'zod';
import { environment } from '../../environments/environment';
import * as salesforceOrgsDb from '../db/salesforce-org.db';
import * as oauthService from '../services/oauth.service';
import { createRoute } from '../utils/route.utils';

export interface OauthLinkParams {
  type: 'salesforce';
  error?: string;
  message?: string;
  clientUrl: string;
  data?: string;
}

type PkceData = { code_verifier: string; nonce: string; state: string; loginUrl: string };

export const routeDefinition = {
  salesforceOauthInitAuth: {
    controllerFn: () => salesforceOauthInitAuth,
    validators: {
      query: z.object({
        loginUrl: z.string().min(1),
        addLoginParam: z
          .enum(['true', 'false'])
          .nullish()
          .transform((val) => val === 'true'),
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
  const { loginUrl, addLoginParam } = query;
  const { authorizationUrl, code_verifier, nonce, state } = oauthService.salesforceOauthInit(loginUrl, { addLoginParam });
  const pkceData: PkceData = { code_verifier, nonce, state, loginUrl };

  // Set the HTTP-only cookie
  res.setHeader('Set-Cookie', [
    cookie.serialize(HTTP.COOKIE.PKCE, JSON.stringify(pkceData), {
      httpOnly: true,
      secure: !ENV.IS_LOCAL_DOCKER && environment.production,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 1, // 1 hour
    }),
    cookie.serialize(HTTP.COOKIE.PKCE_CLERK_UAT, req.cookies['__client_uat'], {
      httpOnly: true,
      secure: !ENV.IS_LOCAL_DOCKER && environment.production,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 1, // 1 hour
    }),
  ]);

  res.redirect(authorizationUrl);
});

/**
 * Prepare SFDC auth and redirect to Salesforce
 * @param req
 * @param res
 */
const salesforceOauthCallback = createRoute(
  routeDefinition.salesforceOauthCallback.validators,
  async ({ query, userId }, req, res, next) => {
    const queryParams = query as CallbackParamsType;
    const clientUrl = new URL(ENV.JETSTREAM_CLIENT_URL!).origin;
    const returnParams: OauthLinkParams = {
      type: 'salesforce',
      clientUrl,
    };

    try {
      if (!req.cookies[HTTP.COOKIE.PKCE]) {
        returnParams.error = 'Authentication Error';
        returnParams.message = 'You are not authorized to access this page. Please try again.';
        return res.redirect(`/oauth-link/?${new URLSearchParams(returnParams as any).toString().replaceAll('+', '%20')}`);
      }

      // ERROR PATH
      if (queryParams.error) {
        returnParams.error = (queryParams.error as string) || 'Unexpected Error';
        returnParams.message = queryParams.error_description
          ? (queryParams.error_description as string)
          : 'There was an error authenticating with Salesforce.';
        req.log.info({ ...query, requestId: res.locals.requestId, queryParams }, '[OAUTH][ERROR] %s', queryParams.error);
        return res.redirect(`/oauth-link/?${new URLSearchParams(returnParams as any).toString().replaceAll('+', '%20')}`);
      }

      const { code_verifier, loginUrl, nonce, state } = JSON.parse(req.cookies[HTTP.COOKIE.PKCE] || '{}') as PkceData;
      const { access_token, refresh_token, userInfo } = await oauthService.salesforceOauthCallback(loginUrl, query, {
        code_verifier,
        nonce,
        state,
      });

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
        userId,
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
    if (ex instanceof ApiRequestError && ERROR_MESSAGES.SFDC_REST_API_NOT_ENABLED.test(ex.message)) {
      throw new Error(ERROR_MESSAGES.SFDC_REST_API_NOT_ENABLED_MSG);
    }
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
