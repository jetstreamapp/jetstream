/// <reference lib="WebWorker" />
import { ApiConnection } from '@jetstream/salesforce-api';
import { logger } from '@jetstream/shared/client-logger';
import { getErrorMessage } from '@jetstream/shared/utils';
import { Maybe, SalesforceOrgUi } from '@jetstream/types';
import { z } from 'zod';

export interface RequestOptions {
  request: Request;
  params: Record<string, string>;
  // user: SalesforceOrgUi;
  jetstreamConn?: ApiConnection;
  targetJetstreamConn?: Maybe<ApiConnection>;
  org?: SalesforceOrgUi;
  targetOrg?: SalesforceOrgUi;
  /**
   * Override the URL for the request
   * This is used for streaming file downloads
   */
  urlOverride?: URL;
}

export type ControllerFunction<TParamsSchema extends z.ZodTypeAny, TBodySchema extends z.ZodTypeAny, TQuerySchema extends z.ZodTypeAny> = (
  data: {
    params: z.infer<TParamsSchema>;
    body: z.infer<TBodySchema>;
    query: z.infer<TQuerySchema>;
    jetstreamConn?: ApiConnection;
    targetJetstreamConn?: Maybe<ApiConnection>;
    // user: SalesforceOrgUi;// TODO:
    // requestId: string;
    org?: SalesforceOrgUi;
    targetOrg?: SalesforceOrgUi;
  },
  req: RequestOptions,
) => Promise<Response> | Response;

export function createRoute<TParamsSchema extends z.ZodTypeAny, TBodySchema extends z.ZodTypeAny, TQuerySchema extends z.ZodTypeAny>(
  {
    params,
    body,
    query,
    hasSourceOrg = true,
    hasTargetOrg = false,
  }: {
    params?: TParamsSchema;
    body?: TBodySchema;
    query?: TQuerySchema;
    /**
     * Set to false to skip validating that an org exists on the request
     * @default true
     */
    hasSourceOrg?: boolean;
    hasTargetOrg?: boolean;
  },
  controllerFn: ControllerFunction<TParamsSchema, TBodySchema, TQuerySchema>,
) {
  return async (req: RequestOptions) => {
    const url = req.urlOverride || new URL(req.request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    let parsedBody: unknown = undefined;

    if (req.request.method !== 'GET') {
      if (req.request.headers.get('content-type') === 'application/json') {
        try {
          parsedBody = await req.request.json();
        } catch {
          // headers may not have been correct, just ignore and continue
        }
      } else if (req.request.headers.get('content-type') === 'application/zip') {
        parsedBody = await req.request.arrayBuffer();
      } else {
        parsedBody = await req.request.text();
      }
    }

    try {
      const data = {
        params: params ? params.parse(req.params) : undefined,
        body: body && parsedBody ? body.parse(parsedBody) : undefined,
        query: query ? query.parse(queryParams) : undefined,
        jetstreamConn: req.jetstreamConn,
        targetJetstreamConn: req.targetJetstreamConn,
        org: req.org,
        // this will exist if targetJetstreamConn exists, otherwise will throw
        targetOrg: req.targetOrg,
      };
      if (hasSourceOrg && !data.jetstreamConn) {
        logger.info('[INIT-ORG][ERROR] A source org did not exist on locals');
        throw new Error('An org is required for this action');
      }
      if (hasTargetOrg && !data.targetJetstreamConn) {
        logger.info('[INIT-ORG][ERROR] A target org did not exist on locals');
        throw new Error('A source and target org are required for this action');
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await controllerFn(data as any, req);
    } catch (ex) {
      logger.error(ex, '[ROUTE][VALIDATION ERROR]');
      throw ex;
    }
  };
}

export function handleJsonResponse(data?: unknown, options: ResponseInit = {}) {
  return new Response(JSON.stringify({ data: data || {} }), {
    headers: {
      'Content-Type': 'application/json',
    },
    status: 200,
    statusText: 'OK',
    ...options,
  });
}

export function handleErrorResponse(error: Error) {
  // TODO: handle other content types
  return new Response(
    JSON.stringify({
      error: true,
      message: getErrorMessage(error),
    }),
    { status: 400, statusText: 'Bad Request' },
  );
}
