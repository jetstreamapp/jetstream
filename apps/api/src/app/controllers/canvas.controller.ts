import { ENV } from '@jetstream/api-config';
import { timingSafeStringCompare } from '@jetstream/auth/server';
import { salesforceCanvasOauthCallback, SalesforceCanvasOauthInit } from '@jetstream/salesforce-oauth';
import { getErrorMessage, urlSearchParamsToJson } from '@jetstream/shared/utils';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import z from 'zod';
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
 * Escapes a JSON string for safe embedding inside an HTML <script> tag.
 * Prevents script breakout via </script> and <!-- sequences.
 */
function escapeJsonForScript(json: string): string {
  return json.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/\//g, '\\u002f');
}

/**
 * Splits the signed request into signature and envelope parts
 */
function getParts(signedRequest: string): [string, string] {
  const parts = signedRequest.split('.', 2);
  if (parts.length !== 2) {
    throw new Error('Invalid signed request format. Expected format: signature.envelope');
  }
  return [parts[0], parts[1]];
}

/**
 * Verifies the signature using HMAC-SHA256
 */
function verify(secret: string, algorithm: string, encodedEnvelope: string, encodedSig: string): void {
  // Only support HMAC-SHA256
  if (algorithm !== 'HMACSHA256') {
    throw new Error(`Unsupported algorithm: ${algorithm}. Only HMACSHA256 is supported.`);
  }

  // Create HMAC signature of the encoded envelope
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(encodedEnvelope);
  const expectedSig = hmac.digest('base64');

  // Normalize both to standard Base64 for comparison, since Salesforce Canvas
  // may use URL-safe Base64 (- and _ instead of + and /) in the signed request
  const normalizeBase64 = (s: string) => s.replace(/-/g, '+').replace(/_/g, '/');
  if (!timingSafeStringCompare(normalizeBase64(expectedSig), normalizeBase64(encodedSig))) {
    throw new Error('Signature verification failed. The signed request was not signed with the correct consumer secret.');
  }
}

/**
 * Verifies and decodes a Salesforce Canvas signed request
 * Returns the decoded JSON context if verification succeeds
 */
function verifyAndDecodeAsJson(signedRequest: string, secret: string): Record<string, unknown> {
  // Split into signature and envelope
  const [encodedSig, encodedEnvelope] = getParts(signedRequest);

  // Base64 decode the envelope to get JSON
  // Note: Canvas uses URL-safe Base64, so we need to handle that
  const jsonEnvelope = Buffer.from(encodedEnvelope, 'base64').toString('utf-8');

  // Parse the JSON to extract algorithm and context
  let envelope: Record<string, unknown>;
  let algorithm: string;

  try {
    envelope = JSON.parse(jsonEnvelope);
    algorithm = envelope.algorithm as string;

    if (!algorithm) {
      throw new Error('Algorithm not found in envelope');
    }
  } catch (error) {
    throw new Error(`Error deserializing JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Verify the signature
  verify(secret, algorithm, encodedEnvelope, encodedSig);

  // If we got this far, the request was not tampered with
  // Return the context
  return envelope;
}

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
    let context: Record<string, unknown> = {};

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

      context.loginParams = urlSearchParamsToJson(authorizationUrl.searchParams);
    } else if (signed_request) {
      // Verify and decode the signed request
      context = verifyAndDecodeAsJson(signed_request, clientSecret);
    }

    // we could also use login.salesforce.com
    const fileContents = await getIndexFile().then((file) =>
      file
        .replace(
          '<%=canvasImportScriptUrl%>',
          `${(context as any)?.client?.instanceUrl || loginUrl}/canvas/sdk/js/${ENV.SFDC_API_VERSION}/canvas-all.js`,
        )
        .replace('<%=signedRequestJson%>', escapeJsonForScript(JSON.stringify(context))),
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

async function getIndexFile(): Promise<string> {
  const filePath = join(__dirname, '../jetstream-canvas/index.html');
  return await readFile(filePath, 'utf-8');
}
