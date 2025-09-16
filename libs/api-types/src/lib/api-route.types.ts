import type { ResponseLocalsCookies } from '@jetstream/auth/types';
import type { SalesforceOrg } from '@jetstream/prisma';
import type { ApiConnection } from '@jetstream/salesforce-api';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import type pino from 'pino';

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
    requestId: string;
    jetstreamConn: ApiConnection;
    targetJetstreamConn?: ApiConnection;
  }
> & { log: pino.Logger };

export type Response<ResBody = unknown> = ExpressResponse<
  ResBody,
  {
    requestId: string;
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
    ipAddress: string;
  }
> & { log: pino.Logger };
