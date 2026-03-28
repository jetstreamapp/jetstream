import { z } from 'zod';
import { createRoute, handleErrorResponse, RouteValidator } from './route.utils';

export const routeDefinition = {
  sendUserFeedbackEmail: {
    controllerFn: () => sendUserFeedbackEmail,
    validators: {
      hasSourceOrg: false,
      skipBodyParsing: true,
      body: z.any(),
    } satisfies RouteValidator,
  },
};

const sendUserFeedbackEmail = createRoute(routeDefinition.sendUserFeedbackEmail.validators, async (_, req) => {
  try {
    return handleErrorResponse(new Error('Not implemented'));
    // const { authTokens, extIdentifier } = await getTokens();
    // const body = req.request.body;

    // const contentType = req.request.headers.get('content-type');
    // if (!contentType?.startsWith('multipart/form-data')) {
    //   return handleErrorResponse(new Error('Expected multipart/form-data'));
    // }
    // if (!body) {
    //   return handleErrorResponse(new Error('Missing request body'));
    // }

    // return await fetch(`${environment.serverUrl}/web-extension/feedback`, {
    //   method: 'POST',
    //   // @ts-expect-error Fetch API types are wrong
    //   duplex: 'half',
    //   headers: {
    //     Accept: 'application/json',
    //     'Content-Type': contentType,
    //     Authorization: `Bearer ${authTokens?.accessToken}`,
    //     [HTTP.HEADERS.X_EXT_DEVICE_ID]: extIdentifier.id,
    //   },
    //   body,
    // });
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});
