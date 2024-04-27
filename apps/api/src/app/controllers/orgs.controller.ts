import { getExceptionLog } from '@jetstream/api-config';
import { ApiRequestError } from '@jetstream/salesforce-api';
import { ERROR_MESSAGES } from '@jetstream/shared/constants';
import { SObjectOrganization } from '@jetstream/types';
import { z } from 'zod';
import * as salesforceOrgsDb from '../db/salesforce-org.db';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';
import { createRoute } from '../utils/route.utils';

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
};

const getOrgs = createRoute(routeDefinition.getOrgs.validators, async ({ user }, req, res, next) => {
  try {
    const orgs = await salesforceOrgsDb.findByUserId(user.id);

    sendJson(res, orgs);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

const updateOrg = createRoute(routeDefinition.updateOrg.validators, async ({ body, params, user }, req, res, next) => {
  try {
    const data = { label: body.label, color: body.color };
    const salesforceOrg = await salesforceOrgsDb.updateSalesforceOrg(user.id, params.uniqueId, data);

    sendJson(res, salesforceOrg, 201);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

const deleteOrg = createRoute(routeDefinition.deleteOrg.validators, async ({ params, user }, req, res, next) => {
  try {
    salesforceOrgsDb.deleteSalesforceOrg(user.id, params.uniqueId);

    sendJson(res, undefined, 204);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

/**
 * Check if the org is still valid
 * This can be used to retry an org that has been marked as invalid
 */
const checkOrgHealth = createRoute(routeDefinition.checkOrgHealth.validators, async ({ jetstreamConn, org }, req, res, next) => {
  try {
    let connectionError = org.connectionError;

    try {
      await jetstreamConn.org.identity();
      connectionError = null;
      req.log.warn('[ORG CHECK][VALID ORG][IDENTITY]');
    } catch (ex) {
      connectionError = ERROR_MESSAGES.SFDC_EXPIRED_TOKEN;
      req.log.warn(getExceptionLog(ex), '[ORG CHECK][INVALID ORG] %s', ex.message);
    }

    // Ensure full API access, identity API works even without API access
    if (!connectionError) {
      // ensure api access is enabled
      try {
        await jetstreamConn.query.query<SObjectOrganization>(`SELECT Id, TrialExpirationDate FROM Organization`);
        connectionError = null;
        req.log.warn('[ORG CHECK][VALID ORG][API ACCESS]');
      } catch (ex) {
        if (ex instanceof ApiRequestError && ERROR_MESSAGES.SFDC_REST_API_NOT_ENABLED.test(ex.message)) {
          connectionError = ERROR_MESSAGES.SFDC_REST_API_NOT_ENABLED_MSG;
          req.log.warn(getExceptionLog(ex), '[ORG CHECK][INVALID ORG] %s', ex.message);
        }
      }
    }

    try {
      if (connectionError !== org.connectionError) {
        await salesforceOrgsDb.updateOrg_UNSAFE(org, { connectionError });
      }
    } catch (ex) {
      req.log.warn({ orgId: org?.id, ...getExceptionLog(ex) }, '[ERROR UPDATING INVALID ORG] %s', ex.message);
    }

    if (connectionError) {
      throw new UserFacingError('Your org is no longer valid. Reconnect this org to Salesforce.');
    }

    sendJson(res, undefined, 200);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});
