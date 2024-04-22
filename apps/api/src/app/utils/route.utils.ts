import { getExceptionLog, rollbarServer } from '@jetstream/api-config';
import { ApiConnection } from '@jetstream/salesforce-api';
import { UserProfileServer } from '@jetstream/types';
import { NextFunction } from 'express';
import { z } from 'zod';
import { findByUniqueId_UNSAFE } from '../db/salesforce-org.db';
import { Request, Response } from '../types/types';
import { UserFacingError } from './error-handler';

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
    jetstreamConn: ApiConnection;
    targetJetstreamConn: ApiConnection;
    user: UserProfileServer;
    requestId: string;
    org: NonNullable<Awaited<ReturnType<typeof findByUniqueId_UNSAFE>>>;
    targetOrg: NonNullable<Awaited<ReturnType<typeof findByUniqueId_UNSAFE>>>;
  },
  req: Request<unknown, unknown, unknown>,
  res: Response,
  next: NextFunction
) => Promise<void> | void;

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
  return async (req: Request<unknown, unknown, unknown>, res: Response, next: NextFunction) => {
    try {
      const data = {
        params: params ? params.parse(req.params) : undefined,
        body: body ? body.parse(req.body) : undefined,
        query: query ? query.parse(req.query) : undefined,
        jetstreamConn: res.locals.jetstreamConn,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        targetJetstreamConn: res.locals.targetJetstreamConn!,
        org: res.locals.org as NonNullable<Awaited<ReturnType<typeof findByUniqueId_UNSAFE>>>,
        // this will exist if targetJetstreamConn exists, otherwise will throw
        targetOrg: res.locals.targetOrg as NonNullable<Awaited<ReturnType<typeof findByUniqueId_UNSAFE>>>,
        user: req.user as UserProfileServer,
        requestId: res.locals.requestId,
      };
      if (hasSourceOrg && !data.jetstreamConn) {
        req.log.info('[INIT-ORG][ERROR] A source org did not exist on locals');
        return next(new UserFacingError('An org is required for this action'));
      }
      if (hasTargetOrg && !data.targetJetstreamConn) {
        req.log.info('[INIT-ORG][ERROR] A target org did not exist on locals');
        return next(new UserFacingError('A source and target org are required for this action'));
      }
      await controllerFn(data, req, res, next);
    } catch (ex) {
      rollbarServer.error('Route Validation Error', req, {
        context: `route#createRoute`,
        custom: {
          ...getExceptionLog(ex, true),
          message: ex.message,
          stack: ex.stack,
          url: req.url,
          params: req.params,
          query: req.query,
          body: req.body,
          userId: (req.user as UserProfileServer)?.id,
          requestId: res.locals.requestId,
        },
      });
      req.log.error(getExceptionLog(ex), '[ROUTE][VALIDATION ERROR]');
      next(new UserFacingError(ex));
    }
  };
}
