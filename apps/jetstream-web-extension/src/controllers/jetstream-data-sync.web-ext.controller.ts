import { HTTP } from '@jetstream/shared/constants';
import browser from 'webextension-polyfill';
import { z } from 'zod';
import { environment } from '../environments/environment';
import { ChromeStorageState } from '../utils/extension.types';
import { createRoute, handleErrorResponse } from './route.utils';

export const MIN_PULL = 25;
export const MAX_PULL = 100;

export const MAX_SYNC = 50;

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

async function getTokens() {
  const { authTokens, extIdentifier } = (await browser.storage.sync.get(['extIdentifier', 'authTokens'])) as Pick<
    ChromeStorageState['sync'],
    'authTokens' | 'extIdentifier'
  >;
  if (!authTokens || !extIdentifier) {
    throw new Error('Unauthorized');
  }
  return { authTokens, extIdentifier };
}

const pull = createRoute(routeDefinition.pull.validators, async ({ query }, req) => {
  try {
    const { authTokens, extIdentifier } = await getTokens();

    return await fetch(`${environment.serverUrl}/web-extension/data-sync/pull?${new URLSearchParams(query).toString()}`, {
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
    const { authTokens, extIdentifier } = await getTokens();

    return await fetch(`${environment.serverUrl}/web-extension/data-sync/push?${new URLSearchParams(query).toString()}`, {
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
