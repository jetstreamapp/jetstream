import { z } from 'zod';
import * as jetstreamOrganizationsDb from '../db/organization.db';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';
import { createRoute } from '../utils/route.utils';

export const routeDefinition = {
  getOrganizations: {
    controllerFn: () => getOrganizations,
    responseType: z.any().array(),
    validators: {
      hasSourceOrg: false,
    },
  },
  createOrganization: {
    controllerFn: () => createOrganization,
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
    controllerFn: () => updateOrganization,
    responseType: z.any(),
    validators: {
      params: z.object({
        id: z.string().uuid(),
      }),
      body: z.object({
        name: z.string(),
        description: z.string().optional(),
      }),
      hasSourceOrg: false,
    },
  },
  deleteOrganization: {
    controllerFn: () => deleteOrganization,
    responseType: z.any(),
    validators: {
      params: z.object({
        id: z.string().uuid(),
      }),
      hasSourceOrg: false,
    },
  },
};

const getOrganizations = createRoute(routeDefinition.getOrganizations.validators, async ({ user }, req, res, next) => {
  try {
    const organizations = await jetstreamOrganizationsDb.findByUserId({ userId: user.id });

    sendJson(res, organizations);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

const createOrganization = createRoute(routeDefinition.createOrganization.validators, async ({ user, body }, req, res, next) => {
  try {
    const organization = await jetstreamOrganizationsDb.create(user.id, body);

    sendJson(res, organization);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

const updateOrganization = createRoute(routeDefinition.updateOrganization.validators, async ({ body, params, user }, req, res, next) => {
  try {
    const organization = await jetstreamOrganizationsDb.update(user.id, params.id, body);

    sendJson(res, organization, 200);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});

const deleteOrganization = createRoute(routeDefinition.deleteOrganization.validators, async ({ params, user }, req, res, next) => {
  try {
    await jetstreamOrganizationsDb.deleteOrganization(user.id, params.id);

    sendJson(res, undefined, 204);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});
