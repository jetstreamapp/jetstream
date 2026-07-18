import { CreateSalesforceCanvasOrgRequestSchema, UpdateSalesforceCanvasOrgRequestSchema } from '@jetstream/types';
import { z } from 'zod';
import * as canvasOrgDb from '../db/canvas-entitlement.db';
import { resolveActiveTeamIdForUser } from '../db/feature-flags.db';
import { NotAllowedError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';
import { createRoute, RouteValidator } from '../utils/route.utils';

const TEAM_MANAGED_MESSAGE = 'Your team manages authorized Canvas orgs. Ask a team admin to update them from the Team Dashboard.';

export const routeDefinition = {
  getCanvasOrgs: {
    controllerFn: () => getCanvasOrgs,
    validators: {
      hasSourceOrg: false,
    } satisfies RouteValidator,
  },
  createCanvasOrg: {
    controllerFn: () => createCanvasOrg,
    validators: {
      hasSourceOrg: false,
      body: CreateSalesforceCanvasOrgRequestSchema,
    } satisfies RouteValidator,
  },
  updateCanvasOrg: {
    controllerFn: () => updateCanvasOrg,
    validators: {
      hasSourceOrg: false,
      params: z.object({ id: z.uuid() }),
      body: UpdateSalesforceCanvasOrgRequestSchema,
    } satisfies RouteValidator,
  },
  deleteCanvasOrg: {
    controllerFn: () => deleteCanvasOrg,
    validators: {
      hasSourceOrg: false,
      params: z.object({ id: z.uuid() }),
    } satisfies RouteValidator,
  },
};

/**
 * Team members must manage authorized orgs at the team level (the team entitlement — not the personal
 * one — gates Canvas access for them), so these personal endpoints refuse when the caller is on an
 * active team and point them to the team UI.
 */
async function assertNotOnTeam(userId: string) {
  const teamId = await resolveActiveTeamIdForUser(userId);
  if (teamId) {
    throw new NotAllowedError(TEAM_MANAGED_MESSAGE);
  }
}

const getCanvasOrgs = createRoute(routeDefinition.getCanvasOrgs.validators, async ({ user }, _req, res, next) => {
  try {
    await assertNotOnTeam(user.id);
    const orgs = await canvasOrgDb.listCanvasOrgsForOwner({ type: 'user', userId: user.id });
    sendJson(res, orgs);
  } catch (ex) {
    next(ex);
  }
});

const createCanvasOrg = createRoute(routeDefinition.createCanvasOrg.validators, async ({ user, body }, _req, res, next) => {
  try {
    await assertNotOnTeam(user.id);
    const org = await canvasOrgDb.createCanvasOrg({
      owner: { type: 'user', userId: user.id },
      authorizedByUserId: user.id,
      organizationId: body.organizationId,
      myDomainBase: body.myDomainBase,
      orgName: body.orgName,
    });
    sendJson(res, org);
  } catch (ex) {
    next(ex);
  }
});

const updateCanvasOrg = createRoute(routeDefinition.updateCanvasOrg.validators, async ({ user, params, body }, _req, res, next) => {
  try {
    await assertNotOnTeam(user.id);
    const org = await canvasOrgDb.updateCanvasOrg({ owner: { type: 'user', userId: user.id }, id: params.id, data: body });
    sendJson(res, org, 200);
  } catch (ex) {
    next(ex);
  }
});

const deleteCanvasOrg = createRoute(routeDefinition.deleteCanvasOrg.validators, async ({ user, params }, _req, res, next) => {
  try {
    await assertNotOnTeam(user.id);
    await canvasOrgDb.deleteCanvasOrg({ owner: { type: 'user', userId: user.id }, id: params.id });
    sendJson(res, undefined, 204);
  } catch (ex) {
    next(ex);
  }
});
