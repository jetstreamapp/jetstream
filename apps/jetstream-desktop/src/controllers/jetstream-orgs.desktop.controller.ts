import { z } from 'zod';
import * as dataService from '../services/persistence.service';
import { createRoute, handleErrorResponse, handleJsonResponse } from '../utils/route.utils';

export const routeDefinition = {
  getOrganizations: {
    controllerFn: () => getOrgGroups,
    validators: {
      hasSourceOrg: false,
    },
  },
  createOrganization: {
    controllerFn: () => createOrgGroup,
    validators: {
      body: z.object({
        name: z.string(),
        description: z.string().optional().nullable().default(null),
      }),
      hasSourceOrg: false,
    },
  },
  updateOrganization: {
    controllerFn: () => updateOrgGroup,
    validators: {
      params: z.object({
        id: z.uuid(),
      }),
      body: z.object({
        name: z.string(),
        description: z.string().optional().nullable().default(null),
      }),
      hasSourceOrg: false,
    },
  },
  deleteOrganization: {
    controllerFn: () => deleteOrgGroup,
    validators: {
      params: z.object({
        id: z.uuid(),
      }),
      hasSourceOrg: false,
    },
  },
  deleteOrganizationWithOrgs: {
    controllerFn: () => deleteOrganizationWithOrgs,
    validators: {
      params: z.object({
        id: z.uuid(),
      }),
      hasSourceOrg: false,
    },
  },
};

const getOrgGroups = createRoute(routeDefinition.getOrganizations.validators, async ({}, req) => {
  try {
    const organizations = dataService.getOrgGroups();

    return handleJsonResponse(organizations);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

const createOrgGroup = createRoute(routeDefinition.createOrganization.validators, async ({ body }, req) => {
  try {
    const organization = dataService.createOrgGroup(body);

    return handleJsonResponse(organization);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

const updateOrgGroup = createRoute(routeDefinition.updateOrganization.validators, async ({ body, params }, req) => {
  try {
    const organization = dataService.updateOrgGroup(params.id, body);

    return handleJsonResponse(organization, { status: 200 });
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

const deleteOrgGroup = createRoute(routeDefinition.deleteOrganization.validators, async ({ params }, req) => {
  try {
    dataService.deleteOrgGroup(params.id);

    return handleJsonResponse(undefined);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

const deleteOrganizationWithOrgs = createRoute(routeDefinition.deleteOrganization.validators, async ({ params }, req) => {
  try {
    dataService.deleteOrgGroupAndAllOrgs(params.id);

    return handleJsonResponse(undefined);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});
