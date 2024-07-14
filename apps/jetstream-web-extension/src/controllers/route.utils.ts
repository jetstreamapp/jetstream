/// <reference types="chrome" />
/// <reference lib="WebWorker" />
import { ApiConnection } from '@jetstream/salesforce-api';
import { getErrorMessage } from '@jetstream/shared/utils';
import { Maybe, SalesforceOrgUi } from '@jetstream/types';
import { z } from 'zod';

export interface RequestOptions {
  event: FetchEvent;
  params: Record<string, string>;
  // user: SalesforceOrgUi;
  jetstreamConn?: ApiConnection;
  targetJetstreamConn?: Maybe<ApiConnection>;
  org?: SalesforceOrgUi;
  targetOrg?: SalesforceOrgUi;
}
// FIXME: when these were used, createRoute did not properly infer types
// export type RouteValidator = Parameters<typeof createRoute>[0];
// export type RouteDefinition = {
//   controllerFn: () => ReturnType<typeof createRoute>;
//   validators: RouteValidator;
// };
// export type RouteDefinitions = Record<string, RouteDefinition>;

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
  req: RequestOptions
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
  controllerFn: ControllerFunction<TParamsSchema, TBodySchema, TQuerySchema>
) {
  return async (req: RequestOptions) => {
    const url = new URL(req.event.request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    // FIXME: this does not work when the body is not JSON
    const parsedBody = req.event.request.body ? await req.event.request.json() : undefined;
    try {
      console.info(`Handling route ${url}`);
      const data = {
        params: params ? params.parse(req.params) : undefined,
        // FIXME: is this always JSON?
        body: body && req.event.request.body ? body.parse(parsedBody) : undefined,
        query: query ? query.parse(queryParams) : undefined,
        jetstreamConn: req.jetstreamConn,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        targetJetstreamConn: req.targetJetstreamConn,
        org: req.org,
        // this will exist if targetJetstreamConn exists, otherwise will throw
        targetOrg: req.targetOrg,
        // user: req.user,
        // requestId: res.locals.requestId,
      };
      if (hasSourceOrg && !data.jetstreamConn) {
        // FIXME: add logger
        console.info('[INIT-ORG][ERROR] A source org did not exist on locals');
        throw new Error('An org is required for this action');
      }
      if (hasTargetOrg && !data.targetJetstreamConn) {
        // FIXME: add logger
        console.info('[INIT-ORG][ERROR] A target org did not exist on locals');
        throw new Error('A source and target org are required for this action');
      }
      return await controllerFn(data, req);
    } catch (ex) {
      // rollbarServer.error('Route Validation Error', req, {
      //   context: `route#createRoute`,
      //   custom: {
      //     ...getErrorMessageAndStackObj(ex),
      //     url: url.toString(),
      //     params: req.params,
      //     query: queryParams,
      //     body: parsedBody,
      //     // FIXME:
      //     // userId: (req.user as UserProfileServer)?.id,
      //     // requestId: res.locals.requestId,
      //   },
      // });
      console.error(ex, '[ROUTE][VALIDATION ERROR]');
      throw ex;
    }
  };
}

export function handleJsonResponse(data?: any, options: ResponseInit = {}) {
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
    { status: 400, statusText: 'Bad Request' }
  );
}
