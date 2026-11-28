import { SCRATCH_ORG_NOT_REACHABLE_MESSAGE, ScratchOrgCreateRequestSchema, ScratchOrgInfoIdParamsSchema } from '@jetstream/api-types';
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
import logger from 'electron-log';
import { ENV } from '../config/environment';
import { initConnectionFromOAuthResponse } from '../services/sfdc-oauth.service';
import { createRoute, handleErrorResponse, handleJsonResponse, RouteValidator } from '../utils/route.utils';

/** The connected app scratch orgs are requested with, the same one the desktop app uses to connect every other org */
const getConnectedApp = () => ({ consumerKey: ENV.DESKTOP_SFDC_CLIENT_ID, callbackUrl: ENV.DESKTOP_SFDC_CALLBACK_URL });

export const routeDefinition = {
  createScratchOrg: {
    controllerFn: () => createScratchOrg,
    validators: {
      body: ScratchOrgCreateRequestSchema,
    } satisfies RouteValidator,
  },
  connectScratchOrg: {
    controllerFn: () => connectScratchOrg,
    validators: {
      params: ScratchOrgInfoIdParamsSchema,
    } satisfies RouteValidator,
  },
};

const createScratchOrg = createRoute(routeDefinition.createScratchOrg.validators, async ({ body, jetstreamConn }) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const id = await createScratchOrgInfo(jetstreamConn!, ScratchOrgCreateRequestSchema.parse(body ?? {}), getConnectedApp());
    return handleJsonResponse({ id } satisfies ScratchOrgCreateResponse);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

/**
 * Connect a scratch org that was requested through Jetstream by redeeming the authorization code Salesforce stored on
 * its ScratchOrgInfo record. The desktop app is a public client, so the exchange is made without a client secret.
 */
const connectScratchOrg = createRoute(routeDefinition.connectScratchOrg.validators, async ({ params, jetstreamConn, org: devHubOrg }) => {
  try {
    const connectedApp = getConnectedApp();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const scratchOrgInfo = await getScratchOrgInfoForAuth(jetstreamConn!, params.scratchOrgInfoId);

    const authRequest = getScratchOrgAuthRequest(scratchOrgInfo, connectedApp);
    if (authRequest.blocker !== null) {
      throw new Error(authRequest.blocker);
    }

    const tokens = await exchangeAuthCode(authRequest.authCode, authRequest.loginUrl);

    const scratchOrgConn = new ApiConnection({
      apiRequestAdapter: getApiRequestFactoryFn(fetch),
      userId: tokens.userId,
      organizationId: tokens.organizationId,
      accessToken: tokens.access_token,
      apiVersion: ENV.SFDC_API_VERSION,
      instanceUrl: tokens.instanceUrl,
      refreshToken: tokens.refresh_token,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      logger: logger as any,
      enableLogging: false,
    });

    const salesforceOrg = await initConnectionFromOAuthResponse({
      jetstreamConn: scratchOrgConn,
      // Keep the scratch org next to its Dev Hub
      orgGroupId: devHubOrg?.jetstreamOrganizationId,
    });
    return handleJsonResponse({ ...salesforceOrg, accessToken: undefined });
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

/**
 * A refusal from Salesforce is final (the code was not issued to this app, or was already used). Failing to reach the
 * scratch org is not: a new My Domain takes a few minutes to resolve, and the client tries again while it sees
 * SCRATCH_ORG_NOT_REACHABLE_MESSAGE.
 */
async function exchangeAuthCode(authCode: string, loginUrl: string) {
  try {
    return await salesforceOauthExchangeScratchOrgAuthCode({
      clientId: ENV.DESKTOP_SFDC_CLIENT_ID,
      redirectUri: ENV.DESKTOP_SFDC_CALLBACK_URL,
      loginUrl,
      authCode,
    });
  } catch (ex) {
    logger.warn('[SCRATCH ORG] Unable to exchange auth code', { loginUrl, message: getErrorMessage(ex) });
    if (ex instanceof ScratchOrgAuthCodeExchangeError && ex.isUnreachable) {
      throw new Error(`${SCRATCH_ORG_NOT_REACHABLE_MESSAGE}, new scratch orgs can take a few minutes to become available.`);
    }
    throw new Error(`Salesforce did not accept the scratch org's authorization code. ${getErrorMessage(ex)}`);
  }
}
