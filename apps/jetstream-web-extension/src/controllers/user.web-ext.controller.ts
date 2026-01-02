import { HTTP } from '@jetstream/shared/constants';
import browser from 'webextension-polyfill';
import { z } from 'zod';
import { environment } from '../environments/environment';
import { ChromeStorageState } from '../utils/extension.types';
import { createRoute, handleErrorResponse } from './route.utils';

export const routeDefinition = {
  sendUserFeedbackEmail: {
    controllerFn: () => sendUserFeedbackEmail,
    validators: {
      hasSourceOrg: false,
      skipBodyParsing: true,
      body: z.any(),
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

const sendUserFeedbackEmail = createRoute(routeDefinition.sendUserFeedbackEmail.validators, async (_, req) => {
  try {
    const { authTokens, extIdentifier } = await getTokens();
    const body = req.request.body;

    const contentType = req.request.headers.get('content-type');
    if (!contentType?.startsWith('multipart/form-data')) {
      return handleErrorResponse(new Error('Expected multipart/form-data'));
    }
    if (!body) {
      return handleErrorResponse(new Error('Missing request body'));
    }

    return await fetch(`${environment.serverUrl}/web-extension/feedback`, {
      method: 'POST',
      // @ts-expect-error Fetch API types are wrong
      duplex: 'half',
      headers: {
        Accept: 'application/json',
        'Content-Type': contentType,
        Authorization: `Bearer ${authTokens?.accessToken}`,
        [HTTP.HEADERS.X_EXT_DEVICE_ID]: extIdentifier.id,
        [HTTP.HEADERS.X_APP_VERSION]: browser.runtime.getManifest().version,
      },
      body,
    });
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});
