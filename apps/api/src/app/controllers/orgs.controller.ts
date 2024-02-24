import { logger } from '@jetstream/api-config';
import { ERROR_MESSAGES } from '@jetstream/shared/constants';
import { z } from 'zod';
import * as salesforceOrgsDb from '../db/salesforce-org.db';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';
import { RoutDefinitions, createRoute } from '../utils/route.utils';

export const routeDefinition: RoutDefinitions = {
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
        color: z.string().optional(),
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
    next(new UserFacingError(ex.message));
  }
});

const updateOrg = createRoute(routeDefinition.updateOrg.validators, async ({ body, params, user }, req, res, next) => {
  try {
    const data = { label: body.label, color: body.color };
    const salesforceOrg = await salesforceOrgsDb.updateSalesforceOrg(user.id, params.uniqueId, data);

    sendJson(res, salesforceOrg, 201);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
});

const deleteOrg = createRoute(routeDefinition.deleteOrg.validators, async ({ params, user }, req, res, next) => {
  try {
    salesforceOrgsDb.deleteSalesforceOrg(user.id, params.uniqueId);

    sendJson(res, undefined, 204);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
});

/**
 * Check if the org is still valid
 * This can be used to retry an org that has been marked as invalid
 */
const checkOrgHealth = createRoute(
  routeDefinition.checkOrgHealth.validators,
  async ({ jetstreamConn, org, user, requestId }, req, res, next) => {
    try {
      const userInfo = user ? { username: (user as any)?.displayName, userId: (user as any)?.user_id } : undefined;

      let connectionError = org.connectionError;

      try {
        await jetstreamConn.org.identity();
        connectionError = null;
        logger.warn('[ORG CHECK][VALID ORG]', { requestId });
      } catch (ex) {
        connectionError = ERROR_MESSAGES.SFDC_EXPIRED_TOKEN;
        logger.warn('[ORG CHECK][INVALID ORG] %s', ex.message, { requestId });
      }

      try {
        if (connectionError !== org.connectionError) {
          await salesforceOrgsDb.updateOrg_UNSAFE(org, { connectionError });
        }
      } catch (ex) {
        logger.warn('[ERROR UPDATING INVALID ORG] %s', ex.message, { error: ex.message, userInfo, requestId });
      }

      if (connectionError) {
        throw new UserFacingError('Your org is no longer valid. Reconnect this org to Salesforce.');
      }

      sendJson(res, undefined, 200);
    } catch (ex) {
      next(new UserFacingError(ex.message));
    }
  }
);
