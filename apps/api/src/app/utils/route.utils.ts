import { getExceptionLog, logger } from '@jetstream/api-config';
import { CookieOptions, UserProfileSession } from '@jetstream/auth/types';
import { ApiConnection } from '@jetstream/salesforce-api';
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
    setCookie: (name: string, value: string, options: CookieOptions) => void;
    clearCookie: (name: string, options: CookieOptions) => void;
    jetstreamConn: ApiConnection;
    targetJetstreamConn: ApiConnection;
    user: UserProfileSession;
    requestId: string;
    org: NonNullable<Awaited<ReturnType<typeof findByUniqueId_UNSAFE>>>;
    targetOrg: NonNullable<Awaited<ReturnType<typeof findByUniqueId_UNSAFE>>>;
  },
  req: Request<unknown, unknown, unknown>,
  res: Response,
  next: NextFunction,
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
  controllerFn: ControllerFunction<TParamsSchema, TBodySchema, TQuerySchema>,
) {
  return async (req: Request<unknown, unknown, unknown>, res: Response, next: NextFunction) => {
    try {
      res.locals.ipAddress = getApiAddressFromReq(req);
      res.locals.cookies = res.locals.cookies || {};
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
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        user: req.externalAuth?.user || req.session.user!, // It is possible this is null, but middleware asserts it exists so this is easier to work with
        requestId: res.locals.requestId,
        setCookie: (name: string, value: string, options: CookieOptions) => {
          res.locals.cookies = res.locals.cookies || {};
          res.locals.cookies[name] = { name, value, options };
        },
        clearCookie: (name: string, options: CookieOptions) => {
          res.locals.cookies = res.locals.cookies || {};
          res.locals.cookies[name] = {
            clear: true,
            name,
            options,
          };
        },
      };
      if (hasSourceOrg && !data.jetstreamConn) {
        req.log.info('[INIT-ORG][ERROR] A source org did not exist on locals');
        return next(new UserFacingError('An org is required for this action'));
      }
      if (hasTargetOrg && !data.targetJetstreamConn) {
        req.log.info('[INIT-ORG][ERROR] A target org did not exist on locals');
        return next(new UserFacingError('A source and target org are required for this action'));
      }
      try {
        await controllerFn(data, req, res, next);
      } catch (ex) {
        next(new UserFacingError(ex));
      }
    } catch (ex) {
      req.log.error(getExceptionLog(ex), '[ROUTE][VALIDATION ERROR]');
      next(new UserFacingError(ex));
    }
  };
}

export function getApiAddressFromReq(req: Request<unknown, unknown, unknown>) {
  try {
    const ipAddress = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
    if (Array.isArray(ipAddress)) {
      return ipAddress[ipAddress.length - 1];
    }
    return ipAddress;
  } catch (ex) {
    logger.error('Error fetching IP address', ex);
    return `unknown-${new Date().getTime()}`;
  }
}
