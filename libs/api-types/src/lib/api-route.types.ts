import type { ResponseLocalsCookies } from '@jetstream/auth/types';
import type { SalesforceOrg } from '@jetstream/prisma';
// eslint-disable-next-line @nx/enforce-module-boundaries
import type { ApiConnection } from '@jetstream/salesforce-api';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import type pino from 'pino';

// Only declare route-specific locals here. Globally populated fields (requestId, cspNonce)
// live on the Express.Locals augmentation in custom-express-typings/index.d.ts and are
// merged in via intersection — do not duplicate them here.

export type Request<
  Params extends Record<string, string> | unknown = Record<string, string>,
  ReqBody = unknown,
  Query extends Record<string, string | undefined> | unknown = Record<string, string | undefined>,
> = ExpressRequest<
  Params,
  unknown,
  ReqBody,
  Query,
  {
    jetstreamConn: ApiConnection;
    targetJetstreamConn?: ApiConnection;
  }
> & { log: pino.Logger };

/**
 * Deferred response state for Cloudflare timeout prevention.
 * Set by deferredResponseMiddleware on SF API routes.
 */
export interface DeferredResponseState {
  active: boolean;
  timer: NodeJS.Timeout | null;
  keepaliveInterval: NodeJS.Timeout | null;
  startTime: number;
  keepaliveCount: number;
}

export type Response<ResBody = unknown> = ExpressResponse<
  ResBody,
  {
    jetstreamConn: ApiConnection;
    org: SalesforceOrg;
    targetJetstreamConn?: ApiConnection;
    targetOrg?: SalesforceOrg;
    /**
     * Cookie configuration
     * This is used to store all the cookies that need to be set or cleared
     * This ensures that if we want to clear and set the same cookie, we can just set it without worrying about clearing it first
     * which simplifies having the same header specified twice
     */
    cookies?: ResponseLocalsCookies;
    /**
     * Used for desktop and web-extension requests to track the device ID
     */
    deviceId?: string;
    _deferred?: DeferredResponseState;
  }
> & { log: pino.Logger };
