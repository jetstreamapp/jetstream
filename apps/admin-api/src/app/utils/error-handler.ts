import { AdminApiErrorResponse } from '@jetstream/admin/types';
import { getLogger } from '@jetstream/api-config';
import { Prisma } from '@jetstream/prisma';
import { SeatLimitError } from '@jetstream/team-seats';
import type { NextFunction, Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { AdminHttpError } from './route.utils';

function sendError(res: Response, statusCode: number, message: string, details?: unknown) {
  const response: AdminApiErrorResponse = { error: true, message, details };
  res.status(statusCode).json(response);
}

export function notFoundHandler(_: Request, res: Response) {
  sendError(res, 404, 'Not found');
}

/** Errors from Express middleware (serve-static, body-parser) carry an http-errors 4xx `status` */
function getClientErrorStatus(err: unknown): number | null {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === 'number' && status >= 400 && status < 500 ? status : null;
}

/** SeatLimitError's own message is written for a team admin ("purchase more seats"), not for us */
export function describeSeatLimitError({ code, seats }: Pick<SeatLimitError, 'code' | 'seats'>): string {
  if (code === 'PAST_DUE') {
    return 'The team is past due, so nobody who takes a seat can be added until its billing is resolved.';
  }
  const usage = seats ? ` ${seats.used} used and ${seats.reserved} held by open invitations, out of ${seats.effective}.` : '';
  return `The team has no free seat.${usage} Free a seat, or use the Billing role, which does not take one.`;
}

export function errorHandler(err: unknown, _: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    sendError(res, 400, 'Invalid request', z.treeifyError(err));
    return;
  }
  if (err instanceof AdminHttpError) {
    if (err.statusCode >= 500) {
      getLogger().error({ err }, '[ADMIN] Request failed');
    }
    sendError(res, err.statusCode, err.message);
    return;
  }
  if (err instanceof SeatLimitError) {
    sendError(res, 409, describeSeatLimitError(err));
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    sendError(res, 409, 'A record with the same unique value already exists');
    return;
  }

  const clientErrorStatus = getClientErrorStatus(err);
  if (clientErrorStatus) {
    sendError(res, clientErrorStatus, clientErrorStatus === 404 ? 'Not found' : 'Bad request');
    return;
  }

  getLogger().error({ err }, '[ADMIN] Unhandled error');
  // Details such as a Stripe error message help an admin act on a failure but must not reach anyone unauthenticated
  const isAuthenticatedAdmin = !!res.locals.admin;
  sendError(res, 500, isAuthenticatedAdmin && err instanceof Error ? err.message : 'Unexpected error');
}
