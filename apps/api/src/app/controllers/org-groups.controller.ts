import { z } from 'zod';
import * as orgGroupsDb from '../db/organization.db';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';
import { createRoute } from '../utils/route.utils';

export const routeDefinition = {
  getOrganizations: {
    controllerFn: () => getOrgGroups,
    responseType: z.any().array(),
    validators: {
      hasSourceOrg: false,
    },
  },
  createOrganization: {
    controllerFn: () => createOrgGroup,
    responseType: z.any(),
    validators: {
      body: z.object({
        name: z.string(),
        description: z.string().optional(),
      }),
      hasSourceOrg: false,
    },
  },
  updateOrganization: {
    controllerFn: () => updateOrgGroup,
    responseType: z.any(),
    validators: {
      params: z.object({
        id: z.uuid(),
      }),
      body: z.object({
        name: z.string(),
        description: z.string().optional(),
      }),
      hasSourceOrg: false,
    },
  },
  deleteOrganization: {
    controllerFn: () => deleteOrgGroup,
    responseType: z.any(),
    validators: {
      params: z.object({
        id: z.uuid(),
      }),
      hasSourceOrg: false,
    },
  },
  deleteOrganizationWithOrgs: {
    controllerFn: () => deleteOrgGroupAndAllOrgs,
    responseType: z.any(),
    validators: {
      params: z.object({
        id: z.uuid(),
      }),
      hasSourceOrg: false,
    },
  },
};

const getOrgGroups = createRoute(routeDefinition.getOrganizations.validators, async ({ user }, req, res, next) => {
  try {
    const organizations = await orgGroupsDb.findByUserId({ userId: user.id });

    sendJson(res, organizations);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

const createOrgGroup = createRoute(routeDefinition.createOrganization.validators, async ({ user, body }, req, res, next) => {
  try {
    const organization = await orgGroupsDb.create(user.id, body);

    sendJson(res, organization);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

const updateOrgGroup = createRoute(routeDefinition.updateOrganization.validators, async ({ body, params, user }, req, res, next) => {
  try {
    const organization = await orgGroupsDb.update(user.id, params.id, body);

    sendJson(res, organization, 200);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

const deleteOrgGroup = createRoute(routeDefinition.deleteOrganization.validators, async ({ params, user }, req, res, next) => {
  try {
    await orgGroupsDb.deleteOrgGroup(user.id, params.id);

    sendJson(res, undefined, 204);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

const deleteOrgGroupAndAllOrgs = createRoute(
  routeDefinition.deleteOrganizationWithOrgs.validators,
  async ({ params, user }, req, res, next) => {
    try {
      await orgGroupsDb.deleteOrgGroupAndAllOrgs(user.id, params.id);

      sendJson(res, undefined, 204);
    } catch (ex) {
      next(new UserFacingError(ex));
    }
  },
);
