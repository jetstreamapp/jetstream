import { DesktopUserPreferencesSchema } from '@jetstream/desktop/types';
import { HTTP } from '@jetstream/shared/constants';
import { z } from 'zod';
import { ENV } from '../config/environment';
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
  sendUserFeedbackEmail: {
    controllerFn: () => sendUserFeedbackEmail,
    validators: {
      hasSourceOrg: false,
      skipBodyParsing: true,
      body: z.any(),
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

function getTokens() {
  const { accessToken, deviceId } = dataService.getAppData();

  if (!accessToken || !deviceId) {
    throw new Error('Unauthorized');
  }

  return { authTokens: { accessToken }, extIdentifier: { id: deviceId } };
}

const sendUserFeedbackEmail = createRoute(routeDefinition.sendUserFeedbackEmail.validators, async ({}, req) => {
  try {
    const { authTokens, extIdentifier } = getTokens();
    const body = req.request.body;

    const contentType = req.request.headers.get('content-type');
    if (!contentType?.startsWith('multipart/form-data')) {
      return handleErrorResponse(new Error('Expected multipart/form-data'));
    }
    if (!body) {
      return handleErrorResponse(new Error('Missing request body'));
    }

    return await fetch(`${ENV.SERVER_URL}/desktop-app/feedback`, {
      method: 'POST',
      // @ts-expect-error Fetch API types are wrong
      duplex: 'half',
      headers: {
        Accept: 'application/json',
        // ensure we keep the same boundary that the client used
        'Content-Type': req.request.headers.get('content-type')!,
        Authorization: `Bearer ${authTokens?.accessToken}`,
        [HTTP.HEADERS.X_EXT_DEVICE_ID]: extIdentifier.id,
      },
      body,
    });
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});
