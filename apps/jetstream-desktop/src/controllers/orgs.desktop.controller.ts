import { ApiRequestError } from '@jetstream/salesforce-api';
import { ERROR_MESSAGES } from '@jetstream/shared/constants';
import { SObjectOrganization } from '@jetstream/types';
import { z } from 'zod';
import * as dataService from '../services/persistence.service';
import { createRoute, handleErrorResponse, handleJsonResponse } from '../utils/route.utils';

export const routeDefinition = {
  getOrgs: {
    controllerFn: () => getOrgs,
    validators: { hasSourceOrg: false },
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
    },
  },
  deleteOrg: {
    controllerFn: () => deleteOrg,
    validators: {
      params: z.object({
        uniqueId: z.string().min(1),
      }),
      hasSourceOrg: false,
    },
  },
  checkOrgHealth: {
    controllerFn: () => checkOrgHealth,
    validators: {},
  },
  moveOrg: {
    controllerFn: () => moveOrg,
    validators: {
      params: z.object({
        uniqueId: z.string().min(1),
      }),
      body: z.object({
        jetstreamOrganizationId: z.uuid().nullish().default(null),
      }),
      hasSourceOrg: false,
    },
  },
};

const getOrgs = createRoute(routeDefinition.getOrgs.validators, async ({}, req) => {
  try {
    const orgs = dataService.getSalesforceOrgs().map((org) => ({ ...org, accessToken: undefined }));

    return handleJsonResponse(orgs);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

const updateOrg = createRoute(routeDefinition.updateOrg.validators, async ({ body, params }, req) => {
  try {
    const { uniqueId } = params;
    const orgs = dataService.updateSalesforceOrg(uniqueId, body).map((org) => ({ ...org, accessToken: undefined }));

    return handleJsonResponse(orgs);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

const deleteOrg = createRoute(routeDefinition.deleteOrg.validators, async ({ params }, req) => {
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
const checkOrgHealth = createRoute(routeDefinition.checkOrgHealth.validators, async ({ jetstreamConn, org }, req) => {
  try {
    if (!org || !jetstreamConn) {
      return handleErrorResponse(new Error('Invalid org or connection'));
    }
    let connectionError = org?.connectionError;

    try {
      await jetstreamConn?.org.identity();
      connectionError = null;
    } catch (ex) {
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

const moveOrg = createRoute(routeDefinition.moveOrg.validators, async ({ body, params }, req) => {
  try {
    const { uniqueId } = params;
    const { salesforceOrgs } = dataService.moveSalesforceOrgToJetstreamOrg({
      uniqueId,
      jetstreamOrganizationId: body.jetstreamOrganizationId,
    });
    return handleJsonResponse(salesforceOrgs.find((org) => org.uniqueId === uniqueId));
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});
