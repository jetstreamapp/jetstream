import { AdminApiSuccessResponse, AdminSessionUser } from '@jetstream/admin/types';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

export class AdminHttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AdminHttpError';
  }
}

export class NotFoundError extends AdminHttpError {
  constructor(message: string) {
    super(404, message);
  }
}

export class ConflictError extends AdminHttpError {
  constructor(message: string) {
    super(409, message);
  }
}

export interface RequestMetadata {
  ipAddress: string | undefined;
  userAgent: string | undefined;
}

interface RouteContext<TParams, TBody, TQuery> {
  params: TParams;
  body: TBody;
  query: TQuery;
  admin: AdminSessionUser;
  requestMetadata: RequestMetadata;
  req: Request;
  res: Response;
}

/** Set by `requireAdminSession`; every route created here sits behind it */
export function getAdminUser(res: Response): AdminSessionUser {
  const admin = res.locals.admin as AdminSessionUser | undefined;
  if (!admin) {
    throw new AdminHttpError(401, 'Unauthorized');
  }
  return admin;
}

/**
 * Validates params, body and query with zod, runs the handler and sends its return value in the
 * `{ data }` envelope. Validation and handler errors go to the app's error handler.
 */
export function createRoute<
  TParamsSchema extends z.ZodType = z.ZodUnknown,
  TBodySchema extends z.ZodType = z.ZodUnknown,
  TQuerySchema extends z.ZodType = z.ZodUnknown,
  TResult = unknown,
>(
  { params, body, query, status = 200 }: { params?: TParamsSchema; body?: TBodySchema; query?: TQuerySchema; status?: number },
  handler: (context: RouteContext<z.infer<TParamsSchema>, z.infer<TBodySchema>, z.infer<TQuerySchema>>) => Promise<TResult>,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await handler({
        params: (params ? params.parse(req.params) : req.params) as z.infer<TParamsSchema>,
        body: (body ? body.parse(req.body) : req.body) as z.infer<TBodySchema>,
        query: (query ? query.parse(req.query) : req.query) as z.infer<TQuerySchema>,
        admin: getAdminUser(res),
        requestMetadata: { ipAddress: req.ip, userAgent: req.get('user-agent') },
        req,
        res,
      });
      const response: AdminApiSuccessResponse<TResult> = { data: result };
      res.status(status).json(response);
    } catch (ex) {
      next(ex);
    }
  };
}
