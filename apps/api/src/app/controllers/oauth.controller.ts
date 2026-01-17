import { ENV, getExceptionLog, logger } from '@jetstream/api-config';
import { ApiConnection, ApiRequestError, getApiRequestFactoryFn } from '@jetstream/salesforce-api';
import * as oauthService from '@jetstream/salesforce-oauth';
import { ERROR_MESSAGES } from '@jetstream/shared/constants';
import { getErrorMessage } from '@jetstream/shared/utils';
import { Maybe, SObjectOrganization, SalesforceOrgUi } from '@jetstream/types';
import { ResponseBodyError } from 'oauth4webapi';
import { z } from 'zod';
import * as jetstreamOrganizationsDb from '../db/organization.db';
import * as salesforceOrgsDb from '../db/salesforce-org.db';
import * as sfdcEncService from '../services/salesforce-org-encryption.service';
import { createRoute } from '../utils/route.utils';

export interface OauthLinkParams {
  type: 'auth' | 'salesforce';
  error?: string;
  message?: string;
  clientUrl: string;
  data?: string;
}

export const routeDefinition = {
  salesforceOauthInitAuth: {
    controllerFn: () => salesforceOauthInitAuth,
    validators: {
      query: z.object({
        loginUrl: z.union([
          z.literal('https://login.salesforce.com'),
          z.literal('https://test.salesforce.com'),
          z.literal('https://welcome.salesforce.com'),
          z.literal('https://prerellogin.pre.salesforce.com'),
          z.string().regex(/^https:\/\/[a-zA-Z0-9.-]+\.my\.salesforce\.com$/),
        ]),
        addLoginParam: z
          .enum(['true', 'false'])
          .optional()
          .transform((val) => val === 'true'),
        loginHint: z.string().optional(),
        orgGroupId: z.string().optional(),
        // @deprecated - remove in near future once clients have switched to orgGroupId
        jetstreamOrganizationId: z.string().optional(),
      }),
      hasSourceOrg: false,
    },
  },
  salesforceOauthCallback: {
    controllerFn: () => salesforceOauthCallback,
    validators: {
      query: z.record(z.string(), z.string()),
      hasSourceOrg: false,
    },
  },
};

/**
 * Prepare SFDC auth and redirect to Salesforce
 * @param req
 * @param res
 */
const salesforceOauthInitAuth = createRoute(routeDefinition.salesforceOauthInitAuth.validators, async ({ query }, req, res) => {
  const { loginUrl, addLoginParam, loginHint, jetstreamOrganizationId, orgGroupId } = query;
  const { authorizationUrl, code_verifier, nonce, state } = await oauthService.salesforceOauthInit({
    clientId: ENV.SFDC_CONSUMER_KEY,
    clientSecret: ENV.SFDC_CONSUMER_SECRET,
    redirectUri: ENV.SFDC_CALLBACK_URL,
    loginUrl,
    addLoginParam,
    loginHint,
  });
  req.session.orgAuth = { code_verifier, nonce, state, loginUrl, orgGroupId: orgGroupId || jetstreamOrganizationId };
  res.redirect(authorizationUrl.toString());
});

/**
 * Prepare SFDC auth and redirect to Salesforce
 * @param req
 * @param res
 */
const salesforceOauthCallback = createRoute(
  routeDefinition.salesforceOauthCallback.validators,
  async ({ query: queryParams, user }, req, res) => {
    const clientUrl = new URL(ENV.JETSTREAM_CLIENT_URL).origin;
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
        req.log.info({ ...queryParams, requestId: res.locals.requestId, queryParams }, '[OAUTH][ERROR] %s', queryParams.error);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return res.redirect(`/oauth-link/?${new URLSearchParams(returnParams as any).toString().replaceAll('+', '%20')}`);
      } else if (!orgAuth) {
        returnParams.error = 'Authentication Error';
        returnParams.message = queryParams.error_description
          ? (queryParams.error_description as string)
          : 'There was an error authenticating with Salesforce.';
        req.log.info({ ...queryParams, requestId: res.locals.requestId, queryParams }, '[OAUTH][ERROR] Missing orgAuth from session');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return res.redirect(`/oauth-link/?${new URLSearchParams(returnParams as any).toString().replaceAll('+', '%20')}`);
      }

      const { code_verifier, nonce, state, loginUrl, orgGroupId } = orgAuth;

      const { access_token, refresh_token, userInfo } = await oauthService.salesforceOauthCallback(
        {
          clientId: ENV.SFDC_CONSUMER_KEY,
          clientSecret: ENV.SFDC_CONSUMER_SECRET,
          redirectUri: ENV.SFDC_CALLBACK_URL,
          loginUrl,
        },
        new URLSearchParams(queryParams),
        {
          code_verifier,
          nonce,
          state,
        },
      );

      const jetstreamConn = new ApiConnection({
        apiRequestAdapter: getApiRequestFactoryFn(fetch),
        userId: userInfo.user_id as string,
        organizationId: userInfo.organization_id as string,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        accessToken: access_token!,
        apiVersion: ENV.SFDC_API_VERSION,
        instanceUrl: (userInfo.urls?.custom_domain as string) || loginUrl,
        refreshToken: refresh_token,
        logger: res.log || req.log || logger,
        logging: ENV.LOG_LEVEL === 'trace',
      });

      const salesforceOrg = await initConnectionFromOAuthResponse({
        jetstreamConn,
        userId: user.id,
        orgGroupId,
      });

      returnParams.data = JSON.stringify(salesforceOrg);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return res.redirect(`/oauth-link/?${new URLSearchParams(returnParams as any).toString().replaceAll('+', '%20')}`);
    } catch (ex) {
      let errorLogObj = getExceptionLog(ex) as any;

      returnParams.error = ex.message || 'Unexpected Error';
      returnParams.message = queryParams.error_description
        ? (queryParams.error_description as string)
        : 'There was an error authenticating with Salesforce.';

      if (ex instanceof ResponseBodyError) {
        returnParams.error = ex.error;
        returnParams.message = `There was an error authenticating with Salesforce. ${ex.error_description || ''}`.trim();
        errorLogObj = {
          ...errorLogObj,
          responseError: {
            error: ex.error,
            error_description: ex.error_description,
          },
        };
      }

      req.log.info({ ...errorLogObj }, '[OAUTH][ERROR]');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return res.redirect(`/oauth-link/?${new URLSearchParams(returnParams as any).toString().replaceAll('+', '%20')}`);
    }
  },
);

export async function initConnectionFromOAuthResponse({
  jetstreamConn,
  userId,
  orgGroupId,
}: {
  jetstreamConn: ApiConnection;
  userId: string;
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
    logger.warn({ userId, ...getExceptionLog(ex) }, 'Error getting org info %o', ex);
    if (ex instanceof ApiRequestError && ERROR_MESSAGES.SFDC_REST_API_NOT_ENABLED.test(ex.message)) {
      throw new Error(ERROR_MESSAGES.SFDC_REST_API_NOT_ENABLED_MSG);
    }
  }

  const orgName = companyInfoRecord?.Name || 'Unknown Organization';

  const encryptedTokens = await sfdcEncService.encryptAccessToken({
    accessToken: jetstreamConn.sessionInfo.accessToken,
    refreshToken: jetstreamConn.sessionInfo.refreshToken || '',
    userId,
  });

  const salesforceOrgUi: Partial<SalesforceOrgUi> = {
    uniqueId: `${jetstreamConn.sessionInfo.organizationId}-${jetstreamConn.sessionInfo.userId}`,
    accessToken: encryptedTokens,
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
    try {
      salesforceOrgUi.jetstreamOrganizationId = (await jetstreamOrganizationsDb.findById({ id: orgGroupId, userId })).id;
    } catch (ex) {
      logger.warn(
        { userId, jetstreamOrganizationId: orgGroupId, ...getExceptionLog(ex) },
        'Error getting jetstream org with provided id %s',
        getErrorMessage(ex),
      );
    }
  }

  const salesforceOrg = await salesforceOrgsDb.createOrUpdateSalesforceOrg(userId, salesforceOrgUi);
  return salesforceOrg;
}
