import { ApiRequestError } from '@jetstream/salesforce-api';
import { ERROR_MESSAGES, HTTP } from '@jetstream/shared/constants';
import { OrgsWithGroupResponse, SObjectOrganization } from '@jetstream/types';
import { app } from 'electron';
import logger from 'electron-log';
import { z } from 'zod';
import { ENV } from '../config/environment';
import * as dataService from '../services/persistence.service';
import { createRoute, getTokens, handleErrorResponse, handleJsonResponse, RouteValidator } from '../utils/route.utils';

export const routeDefinition = {
  getOrgs: {
    controllerFn: () => getOrgs,
    validators: { hasSourceOrg: false } satisfies RouteValidator,
  },
  updateOrg: {
    controllerFn: () => updateOrg,
    validators: {
      params: z.object({
        uniqueId: z.string().min(1),
      }),
      body: z.object({
        label: z.string(),
        color: z.string().nullish(),
      }),
      hasSourceOrg: false,
    } satisfies RouteValidator,
  },
  deleteOrg: {
    controllerFn: () => deleteOrg,
    validators: {
      params: z.object({
        uniqueId: z.string().min(1),
      }),
      hasSourceOrg: false,
    } satisfies RouteValidator,
  },
  checkOrgHealth: {
    controllerFn: () => checkOrgHealth,
    validators: {} satisfies RouteValidator,
  },
  moveOrg: {
    controllerFn: () => moveOrg,
    validators: {
      params: z.object({
        uniqueId: z.string().min(1),
      }),
      body: z.object({
        orgGroupId: z.uuid().nullish(),
      }),
      hasSourceOrg: false,
    } satisfies RouteValidator,
  },
};

const getOrgs = createRoute(routeDefinition.getOrgs.validators, async ({}) => {
  try {
    const { authTokens, extIdentifier } = getTokens();

    const webAppOrgs = await fetch(`${ENV.SERVER_URL}/desktop-app/orgs`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${authTokens?.accessToken}`,
        [HTTP.HEADERS.X_EXT_DEVICE_ID]: extIdentifier.id,
        [HTTP.HEADERS.X_APP_VERSION]: app.getVersion(),
      },
    })
      .then(async (res) => {
        if (!res.ok) {
          logger.warn('Failed to fetch orgs from web app', { error: await res.text().catch(() => 'Unable to read response body') });
          return null;
        }
        return (res.json() as Promise<{ data: OrgsWithGroupResponse }>).then(({ data }) => data);
      })
      .catch((ex) => {
        logger.warn('Failed to fetch orgs from web app', { error: ex });
        return null;
      });

    const orgs = dataService.mergeWebAppOrgsWithDesktopOrgs(webAppOrgs).map((org) => ({ ...org, accessToken: undefined }));

    return handleJsonResponse(orgs);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

const updateOrg = createRoute(routeDefinition.updateOrg.validators, async ({ body, params }) => {
  try {
    const { uniqueId } = params;
    const orgs = dataService.updateSalesforceOrg(uniqueId, body).map((org) => ({ ...org, accessToken: undefined }));

    return handleJsonResponse(orgs);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

const deleteOrg = createRoute(routeDefinition.deleteOrg.validators, async ({ params }) => {
  try {
    const { uniqueId } = params;
    const orgs = dataService.removeSalesforceOrg(uniqueId).map((org) => ({ ...org, accessToken: undefined }));

    return handleJsonResponse(orgs);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

/**
 * Check if the org is still valid
 * This can be used to retry an org that has been marked as invalid
 */
const checkOrgHealth = createRoute(routeDefinition.checkOrgHealth.validators, async ({ jetstreamConn, org }) => {
  try {
    if (!org || !jetstreamConn) {
      return handleErrorResponse(new Error('Invalid org or connection'));
    }
    let connectionError = org?.connectionError;

    try {
      await jetstreamConn?.org.identity();
      connectionError = null;
    } catch {
      connectionError = ERROR_MESSAGES.SFDC_EXPIRED_TOKEN;
    }

    // Ensure full API access, identity API works even without API access
    if (!connectionError) {
      // ensure api access is enabled
      try {
        await jetstreamConn.query.query<SObjectOrganization>(`SELECT Id, TrialExpirationDate FROM Organization`);
        connectionError = null;
      } catch (ex) {
        if (ex instanceof ApiRequestError && ERROR_MESSAGES.SFDC_REST_API_NOT_ENABLED.test(ex.message)) {
          connectionError = ERROR_MESSAGES.SFDC_REST_API_NOT_ENABLED_MSG;
        }
      }
    }

    if (connectionError !== org.connectionError) {
      dataService.updateSalesforceOrg_UNSAFE(org.uniqueId, { connectionError });
    }

    if (connectionError) {
      return handleErrorResponse(new Error(connectionError));
    }

    return handleJsonResponse();
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

const moveOrg = createRoute(routeDefinition.moveOrg.validators, async ({ body, params }) => {
  try {
    const { uniqueId } = params;
    const { salesforceOrgs } = dataService.moveSalesforceOrgToJetstreamOrg({
      uniqueId,
      orgGroupId: body.orgGroupId ?? null,
    });
    return handleJsonResponse(salesforceOrgs.find((org) => org.uniqueId === uniqueId));
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});
