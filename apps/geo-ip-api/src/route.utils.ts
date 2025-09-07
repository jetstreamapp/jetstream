import { getExceptionLog } from '@jetstream/api-config';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { NextFunction } from 'express';
import type pino from 'pino';
import { z } from 'zod';

export type Request<
  Params extends Record<string, string> | unknown = Record<string, string>,
  ReqBody = unknown,
  Query extends Record<string, string | undefined> | unknown = Record<string, string | undefined>,
> = ExpressRequest<Params, unknown, ReqBody, Query> & { log: pino.Logger };

export type Response<ResBody = unknown> = ExpressResponse<ResBody> & { log: pino.Logger };

export type ControllerFunction<TParamsSchema extends z.ZodTypeAny, TBodySchema extends z.ZodTypeAny, TQuerySchema extends z.ZodTypeAny> = (
  data: {
    params: z.infer<TParamsSchema>;
    body: z.infer<TBodySchema>;
    query: z.infer<TQuerySchema>;
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
  }: {
    params?: TParamsSchema;
    body?: TBodySchema;
    query?: TQuerySchema;
  },
  controllerFn: ControllerFunction<TParamsSchema, TBodySchema, TQuerySchema>
) {
  return async (req: Request<unknown, unknown, unknown>, res: Response, next: NextFunction) => {
    try {
      const data = {
        params: params ? params.parse(req.params) : undefined,
        body: body ? body.parse(req.body) : undefined,
        query: query ? query.parse(req.query) : undefined,
      };
      try {
        await controllerFn(data, req, res, next);
      } catch (ex) {
        next(ex);
      }
    } catch (ex) {
      req.log.error(getExceptionLog(ex), '[ROUTE][VALIDATION ERROR]');
      res.status(400);
      next(ex);
    }
  };
}
