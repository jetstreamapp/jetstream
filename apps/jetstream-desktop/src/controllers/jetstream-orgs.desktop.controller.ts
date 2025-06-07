import { z } from 'zod';
import * as dataService from '../services/persistence.service';
import { createRoute, handleErrorResponse, handleJsonResponse } from '../utils/route.utils';

export const routeDefinition = {
  getOrganizations: {
    controllerFn: () => getOrganizations,
    validators: {
      hasSourceOrg: false,
    },
  },
  createOrganization: {
    controllerFn: () => createOrganization,
    validators: {
      body: z.object({
        name: z.string(),
        description: z.string().optional().nullable().default(null),
      }),
      hasSourceOrg: false,
    },
  },
  updateOrganization: {
    controllerFn: () => updateOrganization,
    validators: {
      params: z.object({
        id: z.string().uuid(),
      }),
      body: z.object({
        name: z.string(),
        description: z.string().optional().nullable().default(null),
      }),
      hasSourceOrg: false,
    },
  },
  deleteOrganization: {
    controllerFn: () => deleteOrganization,
    validators: {
      params: z.object({
        id: z.string().uuid(),
      }),
      hasSourceOrg: false,
    },
  },
};

const getOrganizations = createRoute(routeDefinition.getOrganizations.validators, async ({}, req) => {
  try {
    const organizations = dataService.getJetstreamOrgs();

    return handleJsonResponse(organizations);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

const createOrganization = createRoute(routeDefinition.createOrganization.validators, async ({ body }, req) => {
  try {
    const organization = dataService.createJetstreamOrg(body);

    return handleJsonResponse(organization);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

const updateOrganization = createRoute(routeDefinition.updateOrganization.validators, async ({ body, params }, req) => {
  try {
    const organization = dataService.updateJetstreamOrg(params.id, body);

    return handleJsonResponse(organization, { status: 200 });
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

const deleteOrganization = createRoute(routeDefinition.deleteOrganization.validators, async ({ params }, req) => {
  try {
    dataService.deleteJetstreamOrg(params.id);

    return handleJsonResponse(undefined);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});
