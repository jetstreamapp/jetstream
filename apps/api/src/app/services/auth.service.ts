import { createClerkClient } from '@clerk/backend';
import { createClerkRequest } from '@clerk/backend/internal';
import { ENV } from '@jetstream/api-config';
import type { IncomingMessage } from 'http';

export const clerkClient = createClerkClient({
  secretKey: ENV.CLERK_SECRET_KEY,
  publishableKey: ENV.CLERK_PUBLISHABLE_KEY,
  jwtKey: ENV.CLERK_JWT_KEY,
  sdkMetadata: {
    name: 'Jetstream',
    version: ENV.GIT_VERSION || 'unknown',
    environment: ENV.ENVIRONMENT,
  },
  telemetry: {
    disabled: true,
  },
});

/**
 * For some reason the express library hun, so we are integrating with the API directly
 * This means we need to be compatible with the Clerk Request object
 * This code was take from Clerk's SDK
 * https://github.com/clerk/javascript/blob/main/packages/sdk-node/src/authenticateRequest.ts
 */
export const incomingMessageToClerkRequest = (req: IncomingMessage, extraHeaders: Record<string, string> = {}): Request => {
  const headers = {
    ...Object.keys(req.headers).reduce((acc, key) => Object.assign(acc, { [key]: req?.headers[key] }), {}),
    ...extraHeaders,
  };
  // @ts-expect-error Optimistic attempt to get the protocol in case
  // req extends IncomingMessage in a useful way.
  const protocol = req.connection?.encrypted ? 'https' : 'http';
  const dummyOriginReqUrl = new URL(req.url || '', `${protocol}://clerk-dummy`);
  return createClerkRequest(
    new Request(dummyOriginReqUrl, {
      method: req.method,
      headers: new Headers(headers),
    })
  );
};
