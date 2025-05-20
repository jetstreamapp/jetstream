import { HTTP } from '@jetstream/shared/constants';
import { z } from 'zod';
import { ENV } from '../config/environment';
import { getAppData } from '../services/persistence.service';
import { createRoute, handleErrorResponse } from '../utils/route.utils';

export const MIN_PULL = 25;
export const MAX_PULL = 100;

export const MAX_SYNC = 50;

/**
 * FIXME: this file needs to be worked on
 */

export const routeDefinition = {
  pull: {
    controllerFn: () => pull,
    validators: {
      query: z.any(),
      hasSourceOrg: false,
    },
  },
  push: {
    controllerFn: () => push,
    validators: {
      query: z.any(),
      body: z.any(),
      hasSourceOrg: false,
    },
  },
};

function getTokens() {
  const { accessToken, deviceId } = getAppData();
  const { authTokens, extIdentifier } = { authTokens: { accessToken }, extIdentifier: { id: deviceId } };
  if (!authTokens || !extIdentifier) {
    throw new Error('Unauthorized');
  }
  return { authTokens, extIdentifier };
}

const pull = createRoute(routeDefinition.pull.validators, async ({ query }, req) => {
  try {
    const { authTokens, extIdentifier } = getTokens();

    return await fetch(`${ENV.SERVER_URL}/desktop-app/data-sync/pull?${new URLSearchParams(query).toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${authTokens?.accessToken}`,
        [HTTP.HEADERS.X_EXT_DEVICE_ID]: extIdentifier.id,
      },
    });
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

const push = createRoute(routeDefinition.push.validators, async ({ query, body }, req) => {
  try {
    const { authTokens, extIdentifier } = getTokens();

    return await fetch(`${ENV.SERVER_URL}/desktop-app/data-sync/push?${new URLSearchParams(query).toString()}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authTokens?.accessToken}`,
        [HTTP.HEADERS.X_EXT_DEVICE_ID]: extIdentifier.id,
      },
      body: JSON.stringify(body),
    });
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});
