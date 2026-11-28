import { ENV, getLogger } from '@jetstream/api-config';
import { SCRATCH_ORG_NOT_REACHABLE_MESSAGE, ScratchOrgCreateRequestSchema, ScratchOrgInfoIdParamsSchema } from '@jetstream/api-types';
import { AuditLogAction, AuditLogResource, createTeamAuditLog } from '@jetstream/audit-logs';
import { getApiAddressFromReq } from '@jetstream/auth/server';
import {
  ApiConnection,
  createScratchOrgInfo,
  getApiRequestFactoryFn,
  getScratchOrgAuthRequest,
  getScratchOrgInfoForAuth,
} from '@jetstream/salesforce-api';
import { salesforceOauthExchangeScratchOrgAuthCode, ScratchOrgAuthCodeExchangeError } from '@jetstream/salesforce-oauth';
import { getErrorMessage } from '@jetstream/shared/utils';
import { ScratchOrgCreateResponse } from '@jetstream/types';
import { z } from 'zod';
import * as salesforceOrgsDb from '../db/salesforce-org.db';
import { assertOrgConnectAllowed } from '../utils/access-profile.utils';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';
import { createRoute, RouteValidator } from '../utils/route.utils';
import { initConnectionFromOAuthResponse } from './oauth.controller';

/** The connected app scratch orgs are requested with, the same one used to connect every other org */
const getConnectedApp = () => ({ consumerKey: ENV.SFDC_CONSUMER_KEY, callbackUrl: ENV.SFDC_CALLBACK_URL });

export const routeDefinition = {
  createScratchOrg: {
    controllerFn: () => createScratchOrg,
    responseType: z.object({ id: z.string() }),
    validators: {
      body: ScratchOrgCreateRequestSchema,
    } satisfies RouteValidator,
  },
  connectScratchOrg: {
    controllerFn: () => connectScratchOrg,
    responseType: z.any(),
    validators: {
      params: ScratchOrgInfoIdParamsSchema,
    } satisfies RouteValidator,
  },
};

/**
 * Request a scratch org from the Dev Hub (the org on the request).
 * Salesforce creates it asynchronously, the client polls the ScratchOrgInfo record for the outcome.
 */
const createScratchOrg = createRoute(routeDefinition.createScratchOrg.validators, async ({ body, jetstreamConn }, _, res, next) => {
  try {
    const id = await createScratchOrgInfo(jetstreamConn, body, getConnectedApp());
    sendJson<ScratchOrgCreateResponse>(res, { id });
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

/**
 * Connect a scratch org that was requested through Jetstream by redeeming the authorization code Salesforce stored on
 * its ScratchOrgInfo record. The code never reaches the browser.
 */
const connectScratchOrg = createRoute(
  routeDefinition.connectScratchOrg.validators,
  async ({ params, jetstreamConn, user, org: devHubOrg }, req, res) => {
    const connectedApp = getConnectedApp();
    const scratchOrgInfo = await getScratchOrgInfoForAuth(jetstreamConn, params.scratchOrgInfoId);

    const authRequest = getScratchOrgAuthRequest(scratchOrgInfo, connectedApp);
    if (authRequest.blocker !== null) {
      throw new UserFacingError(authRequest.blocker);
    }

    // The code can only be redeemed once, so anything that would refuse the connection is checked before it is spent
    const existingOrgs = await salesforceOrgsDb.findByUserId(user.id);
    await assertOrgConnectAllowed(user.id, {
      isExistingOrg: existingOrgs.some(({ username }) => !!scratchOrgInfo.SignupUsername && username === scratchOrgInfo.SignupUsername),
    });

    const tokens = await exchangeAuthCode(authRequest.authCode, authRequest.loginUrl);

    const scratchOrgConn = new ApiConnection({
      apiRequestAdapter: getApiRequestFactoryFn(fetch),
      userId: tokens.userId,
      organizationId: tokens.organizationId,
      accessToken: tokens.access_token,
      apiVersion: ENV.SFDC_API_VERSION,
      instanceUrl: tokens.instanceUrl,
      refreshToken: tokens.refresh_token,
      logger: getLogger(),
      enableLogging: ENV.LOG_LEVEL === 'trace',
    });

    const { salesforceOrg, created } = await initConnectionFromOAuthResponse({
      jetstreamConn: scratchOrgConn,
      userId: user.id,
      // Keep the scratch org next to its Dev Hub
      orgGroupId: devHubOrg.jetstreamOrganizationId,
    });

    const teamId = user.teamMembership?.teamId;
    if (teamId) {
      createTeamAuditLog({
        userId: user.id,
        teamId,
        action: created ? AuditLogAction.ORG_ADDED : AuditLogAction.ORG_REACTIVATED,
        resource: AuditLogResource.SALESFORCE_ORG,
        resourceId: salesforceOrg.uniqueId,
        metadata: {
          uniqueId: salesforceOrg.uniqueId,
          username: salesforceOrg.username,
          orgName: salesforceOrg.orgName,
          loginUrl: salesforceOrg.loginUrl,
          instanceUrl: salesforceOrg.instanceUrl,
          isSandbox: salesforceOrg.orgIsSandbox,
          scratchOrgInfoId: scratchOrgInfo.Id,
          devHubUniqueId: devHubOrg.uniqueId,
        },
        ipAddress: res.locals.ipAddress || getApiAddressFromReq(req),
        userAgent: req.get('user-agent'),
      });
    }

    // The stored org never includes its tokens
    sendJson(res, salesforceOrg);
  },
);

/**
 * A refusal from Salesforce is final (the code was not issued to this app, or was already used). Failing to reach the
 * scratch org is not: a new My Domain takes a few minutes to resolve, and the client tries again while it sees
 * SCRATCH_ORG_NOT_REACHABLE_MESSAGE.
 */
async function exchangeAuthCode(authCode: string, loginUrl: string) {
  try {
    return await salesforceOauthExchangeScratchOrgAuthCode({
      clientId: ENV.SFDC_CONSUMER_KEY,
      clientSecret: ENV.SFDC_CONSUMER_SECRET,
      redirectUri: ENV.SFDC_CALLBACK_URL,
      loginUrl,
      authCode,
    });
  } catch (ex) {
    getLogger().warn({ loginUrl, message: getErrorMessage(ex) }, '[SCRATCH ORG] Unable to exchange auth code');
    if (ex instanceof ScratchOrgAuthCodeExchangeError && ex.isUnreachable) {
      throw new UserFacingError(`${SCRATCH_ORG_NOT_REACHABLE_MESSAGE}, new scratch orgs can take a few minutes to become available.`);
    }
    throw new UserFacingError(`Salesforce did not accept the scratch org's authorization code. ${getErrorMessage(ex)}`);
  }
}
