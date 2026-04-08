import { z } from 'zod';
import { createRoute, handleErrorResponse, RouteValidator } from './route.utils';

export const routeDefinition = {
  pull: {
    controllerFn: () => pull,
    validators: {
      query: z.any(),
      hasSourceOrg: false,
    } satisfies RouteValidator,
  },
  push: {
    controllerFn: () => push,
    validators: {
      query: z.any(),
      body: z.any(),
      hasSourceOrg: false,
    } satisfies RouteValidator,
  },
};

const pull = createRoute(routeDefinition.pull.validators, async ({ query }, req) => {
  try {
    // const { authTokens, extIdentifier } = await getTokens();
    // return await fetch(`${environment.serverUrl}/web-extension/data-sync/pull?${new URLSearchParams(query).toString()}`, {
    //   method: 'GET',
    //   headers: {
    //     Accept: 'application/json',
    //     Authorization: `Bearer ${authTokens?.accessToken}`,
    //     [HTTP.HEADERS.X_EXT_DEVICE_ID]: extIdentifier.id,
    //   },
    // });
    return handleErrorResponse(new Error('Not implemented'));
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

const push = createRoute(routeDefinition.push.validators, async ({ query, body }, req) => {
  try {
    // const { authTokens, extIdentifier } = await getTokens();
    // return await fetch(`${environment.serverUrl}/web-extension/data-sync/push?${new URLSearchParams(query).toString()}`, {
    //   method: 'POST',
    //   headers: {
    //     Accept: 'application/json',
    //     'Content-Type': 'application/json',
    //     Authorization: `Bearer ${authTokens?.accessToken}`,
    //     [HTTP.HEADERS.X_EXT_DEVICE_ID]: extIdentifier.id,
    //   },
    //   body: JSON.stringify(body),
    // });
    return handleErrorResponse(new Error('Not implemented'));
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});
