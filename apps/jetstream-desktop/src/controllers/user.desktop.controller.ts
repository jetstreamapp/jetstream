import { DesktopUserPreferencesSchema } from '@jetstream/desktop/types';
import { z } from 'zod';
import * as dataService from '../services/persistence.service';
import { createRoute, handleErrorResponse, handleJsonResponse } from '../utils/route.utils';

export const routeDefinition = {
  getUserProfile: {
    controllerFn: () => getUserProfile,
    validators: {
      hasSourceOrg: false,
    },
  },
  getFullUserProfile: {
    controllerFn: () => getUserProfile,
    validators: {
      hasSourceOrg: false,
    },
  },
  updateProfile: {
    controllerFn: () => updateProfile,
    validators: {
      hasSourceOrg: false,
      body: z.object({
        preferences: DesktopUserPreferencesSchema,
      }),
    },
  },
};

const getUserProfile = createRoute(routeDefinition.getUserProfile.validators, async ({}) => {
  try {
    const userProfile = dataService.getFullUserProfile();

    return handleJsonResponse(userProfile);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

const updateProfile = createRoute(routeDefinition.updateProfile.validators, async ({ body }) => {
  try {
    dataService.updateUserPreferences(body.preferences);
    const userProfile = dataService.getFullUserProfile();

    return handleJsonResponse(userProfile);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});
