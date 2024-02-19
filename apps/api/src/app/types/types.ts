import { ApiConnection } from '@jetstream/salesforce-api';
import { SalesforceOrg } from '@prisma/client';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';

export type Request<Params = Record<string, string>, ReqBody = any, Query = Record<string, string | undefined>> = ExpressRequest<
  Params,
  unknown,
  ReqBody,
  Query,
  {
    requestId: string;
    jetstreamConn: ApiConnection;
    targetJetstreamConn?: ApiConnection;
  }
>;

export type Response<ResBody = unknown> = ExpressResponse<
  ResBody,
  {
    requestId: string;
    jetstreamConn: ApiConnection;
    org: SalesforceOrg;
    targetJetstreamConn?: ApiConnection;
    targetOrg?: SalesforceOrg;
  }
>;
