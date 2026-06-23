import { getLogger } from '@jetstream/api-config';
import { AuditLogAction, AuditLogResource, createTeamAuditLog } from '@jetstream/audit-logs';
import { getApiAddressFromReq } from '@jetstream/auth/server';
import { ApiRequestError } from '@jetstream/salesforce-api';
import { ERROR_MESSAGES } from '@jetstream/shared/constants';
import { getErrorMessage } from '@jetstream/shared/utils';
import { SObjectOrganization } from '@jetstream/types';
import { z } from 'zod';
import * as salesforceOrgsDb from '../db/salesforce-org.db';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';
import { createRoute, RouteValidator } from '../utils/route.utils';

export const routeDefinition = {
  getOrgs: {
    controllerFn: () => getOrgs,
    responseType: z.any().array(),
    validators: { hasSourceOrg: false } satisfies RouteValidator,
  },
  updateOrg: {
    controllerFn: () => updateOrg,
    responseType: z.any(),
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
    responseType: z.any(),
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
    responseType: z.any(),
    validators: {
      params: z.object({
        uniqueId: z.string().min(1),
      }),
      body: z.object({
        orgGroupId: z.uuid().nullish(),
        // deprecated
        jetstreamOrganizationId: z.uuid().nullish(),
      }),
      hasSourceOrg: false,
    } satisfies RouteValidator,
  },
};

const getOrgs = createRoute(routeDefinition.getOrgs.validators, async ({ user }, _, res, next) => {
  try {
    const orgs = await salesforceOrgsDb.findByUserId(user.id);

    sendJson(res, orgs);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

const updateOrg = createRoute(routeDefinition.updateOrg.validators, async ({ body, params, user }, _, res, next) => {
  try {
    const data = { label: body.label, color: body.color };
    const salesforceOrg = await salesforceOrgsDb.updateSalesforceOrg(user.id, params.uniqueId, data);

    sendJson(res, salesforceOrg, 200);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

const deleteOrg = createRoute(routeDefinition.deleteOrg.validators, async ({ params, user }, req, res, next) => {
  try {
    const deletedOrg = await salesforceOrgsDb.deleteSalesforceOrg(user.id, params.uniqueId);

    sendJson(res, undefined, 204);

    const teamId = user.teamMembership?.teamId;
    if (teamId) {
      createTeamAuditLog({
        userId: user.id,
        teamId,
        action: AuditLogAction.ORG_DELETED,
        resource: AuditLogResource.SALESFORCE_ORG,
        resourceId: deletedOrg.uniqueId,
        metadata: {
          uniqueId: deletedOrg.uniqueId,
          username: deletedOrg.username,
          orgName: deletedOrg.orgName,
          label: deletedOrg.label,
          loginUrl: deletedOrg.loginUrl,
          instanceUrl: deletedOrg.instanceUrl,
          isSandbox: deletedOrg.orgIsSandbox,
        },
        ipAddress: res.locals.ipAddress || getApiAddressFromReq(req),
        userAgent: req.get('user-agent'),
      });
    }
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
      getLogger().debug('[ORG CHECK][VALID ORG][IDENTITY]');
    } catch (ex) {
      connectionError = ERROR_MESSAGES.SFDC_EXPIRED_TOKEN;
      getLogger().debug({ err: ex }, '[ORG CHECK][INVALID ORG] %s', getErrorMessage(ex));
    }

    // Ensure full API access, identity API works even without API access
    if (!connectionError) {
      // ensure api access is enabled
      try {
        await jetstreamConn.query.query<SObjectOrganization>(`SELECT Id, TrialExpirationDate FROM Organization`);
        connectionError = null;
        getLogger().debug('[ORG CHECK][VALID ORG][API ACCESS]');
      } catch (ex) {
        if (ex instanceof ApiRequestError && ERROR_MESSAGES.SFDC_REST_API_NOT_ENABLED.test(getErrorMessage(ex))) {
          connectionError = ERROR_MESSAGES.SFDC_REST_API_NOT_ENABLED_MSG;
          getLogger().debug({ err: ex }, '[ORG CHECK][INVALID ORG] %s', getErrorMessage(ex));
        }
      }
    }

    try {
      if (connectionError !== org.connectionError) {
        await salesforceOrgsDb.updateOrg_UNSAFE(org, { connectionError });
      }
    } catch (ex) {
      getLogger().warn({ orgId: org?.id, err: ex }, '[ERROR UPDATING INVALID ORG] %s', getErrorMessage(ex));
    }

    if (connectionError) {
      throw new UserFacingError('Your org is no longer valid. Reconnect this org to Salesforce.');
    }

    sendJson(res, undefined, 200);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

const moveOrg = createRoute(routeDefinition.moveOrg.validators, async ({ body, params, user }, _, res, next) => {
  try {
    const { uniqueId } = params;
    const salesforceOrg = await salesforceOrgsDb.moveSalesforceOrg(user.id, uniqueId, body);

    sendJson(res, salesforceOrg, 200);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});
