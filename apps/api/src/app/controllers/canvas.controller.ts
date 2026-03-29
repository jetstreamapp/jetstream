import { ENV } from '@jetstream/api-config';
import { salesforceCanvasOauthCallback, SalesforceCanvasOauthInit } from '@jetstream/salesforce-oauth';
import { getErrorMessage, urlSearchParamsToJson } from '@jetstream/shared/utils';
import { Canvas } from '@jetstream/types';
import z from 'zod';
import { escapeJsonForScript, getCanvasIndexFile, verifyAndDecodeAsJson } from '../utils/canvas.utils';
import { createRoute } from '../utils/route.utils';

const INVALID_ACCESS = 'invalid';
const callbackUrl = process.env.SFDC_CANVAS_CALLBACK_URL || INVALID_ACCESS;
const clientId = process.env.SFDC_CANVAS_CLIENT_ID || INVALID_ACCESS;
const clientSecret = process.env.SFDC_CANVAS_CLIENT_SECRET || INVALID_ACCESS;

function throwIfEnvNotConfigured() {
  if (clientId === INVALID_ACCESS || clientSecret === INVALID_ACCESS || callbackUrl === INVALID_ACCESS) {
    throw new Error('Salesforce Canvas OAuth environment variables are not properly configured.');
  }
}

export const routeDefinition = {
  callbackHandler: {
    controllerFn: () => callbackHandler,
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
      query: z.looseObject({
        code: z.string().optional(),
        state: z.string().optional(),
        error: z.string().optional(),
        error_description: z.string().optional(),
      }),
    },
  },
  appHandler: {
    controllerFn: () => appHandler,
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
      query: z.looseObject({
        _sfdc_canvas_auth: z.union([z.enum(['user_approval_required']), z.string()]).optional(),
        loginUrl: z.string().optional(),
      }),
      body: z
        .looseObject({
          signed_request: z.string().optional(),
        })
        .optional(),
    },
  },
};

/**
 * This flow is only required if the user is not pre-authorized
 * But we recommend that admins pre-authorize users so this step can be skipped
 */
const callbackHandler = createRoute(routeDefinition.callbackHandler.validators, async ({ query }, _req, res) => {
  const returnParams: {
    error?: string;
    message?: string;
    success: 'true' | 'false';
  } = { success: 'false' };
  try {
    throwIfEnvNotConfigured();
    const queryParams = query;

    if (queryParams.error) {
      returnParams.error = queryParams.error;
      returnParams.message = queryParams.error_description || 'There was an error authenticating with Salesforce.';
      res.log.warn(queryParams, `Canvas OAuth Error: ${(queryParams.error as string) || 'Unexpected Error'}`);
      throw new Error(returnParams.message);
    }

    if (!queryParams.state) {
      returnParams.error = 'invalid_request';
      returnParams.message = 'Missing state parameter in callback.';
      throw new Error(returnParams.message);
    }

    // We do not need to store the access token at all
    await salesforceCanvasOauthCallback(
      { clientId, clientSecret, redirectUri: callbackUrl },
      new URLSearchParams(queryParams as Record<string, string>),
      queryParams.state,
    );
    returnParams.success = 'true';
  } catch (error) {
    res.log.warn({ ...returnParams, error: getErrorMessage(error) }, '[CANVAS][AUTH_ERROR]');
    returnParams.error = 'unknown_error';
    returnParams.message = returnParams.message || getErrorMessage(error) || 'unknown_error';
  }
  if (returnParams.error) {
    res.status(401);
  }
  res.redirect(`/canvas-auth/?${new URLSearchParams(returnParams).toString().replaceAll('+', '%20')}`);
});

const appHandler = createRoute(routeDefinition.appHandler.validators, async ({ body = {}, query }, _req, res) => {
  try {
    const { signed_request } = body;
    // eslint-disable-next-line prefer-const
    let { _sfdc_canvas_auth, loginUrl } = query;
    let envelope: Partial<Canvas.SfdcCanvasSignedRequest> = {};

    /**
     * This path happens if user is not pre-authorized by their admin.
     * The user will login using OAuth
     */
    if (_sfdc_canvas_auth === 'user_approval_required') {
      throwIfEnvNotConfigured();
      loginUrl = `${decodeURIComponent(loginUrl || 'https://login.salesforce.com')}`;

      // ensure valid host
      const url = new URL(loginUrl);
      if (!url.hostname.endsWith('.salesforce.com')) {
        throw new Error('Invalid Salesforce login URL');
      }

      const { authorizationUrl } = await SalesforceCanvasOauthInit({
        clientId,
        clientSecret,
        loginUrl,
        redirectUri: callbackUrl,
      });

      envelope.loginParams = urlSearchParamsToJson(authorizationUrl.searchParams);
    } else if (signed_request) {
      // Verify and decode the signed request
      envelope = verifyAndDecodeAsJson(signed_request, clientSecret);
      res.log.info(
        {
          authType: envelope?.context?.application?.authType,
          appName: envelope?.context?.application?.name,
          version: envelope?.context?.application?.version,
          organizationId: envelope?.context?.organization?.organizationId,
          loginUrl: envelope?.client?.instanceUrl,
          userId: envelope?.context?.user?.userId,
          userName: envelope?.context?.user?.userName,
          email: envelope?.context?.user?.email,
        },
        '[CANVAS][SIGNED_REQUEST_VERIFIED]',
      );
    }

    // we could also use login.salesforce.com
    const fileContents = await getCanvasIndexFile().then((file) =>
      file
        .replace(
          '<%=canvasImportScriptUrl%>',
          `${(envelope as any)?.client?.instanceUrl || loginUrl}/canvas/sdk/js/${ENV.SFDC_API_VERSION}/canvas-all.js`,
        )
        .replace('<%=signedRequestJson%>', escapeJsonForScript(JSON.stringify(envelope))),
    );

    res.status(200).send(fileContents);
  } catch (error) {
    res.log.error({ error: getErrorMessage(error) }, '[CANVAS][VERIFICATION_ERROR]');
    res.status(401).send({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to verify signed request',
    });
  }
});
