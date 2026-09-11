import { logger } from '@jetstream/api-config';
import { StepUpAuthRequiredError } from '@jetstream/auth/server';
import { isPrismaError } from '@jetstream/prisma';
import { ApiRequestError } from '@jetstream/salesforce-api';
import { SeatLimitError } from '@jetstream/team-seats';
import z, { ZodError } from 'zod';

function initStatus(data: unknown, fallback: number) {
  if (data && typeof data === 'object' && 'status' in data && typeof data.status === 'number') {
    return data.status;
  }
  return fallback;
}

export function isKnownError(error: unknown) {
  return (
    error instanceof UserFacingError ||
    error instanceof AuthenticationError ||
    error instanceof NotFoundError ||
    error instanceof NotAllowedError ||
    // Forwarded as-is so the response handler can emit the 403 step-up prompt rather than having it
    // rewrapped as a generic UserFacingError, which would lose the errorType the client keys on.
    error instanceof StepUpAuthRequiredError ||
    isPrismaError(error)
  );
}

/**
 * Structured context carried by errors thrown from shared libraries. Surfaced as `additionalData`
 * so the client can key on it (e.g. a seat-limit rejection is a 400 with `{ code, kind, seats }`).
 */
function getAdditionalDataFromError(error: Error): Record<string, unknown> | undefined {
  if (error instanceof SeatLimitError) {
    return { code: error.code, kind: error.kind, seats: error.seats };
  }
  return undefined;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export class UserFacingError extends Error {
  readonly status: number;
  /**
   * This data is propagated so that response can include the http status code
   */
  readonly apiRequestError?: ApiRequestError;
  /**
   * additionalData will be included in http response
   */
  readonly additionalData?: any;
  constructor(message: string | Error | ZodError, additionalData?: any) {
    if (message instanceof ZodError) {
      const formattedMessage = `Data validation error: ${Object.entries(z.flattenError(message).fieldErrors)
        .map(([field, issue]) => `'${field}' ${issue}.`)
        .join(' ')}`;
      super(formattedMessage);

      this.additionalData = z.treeifyError(message);
      this.name = 'Validation Error';
      this.stack = message.stack;
    } else if (message instanceof Error) {
      if (message.message.startsWith('<?xml')) {
        logger.warn({ message: message.message }, '[XML ERROR]');
        message.message = 'An unexpected error has occurred';
      }
      super(message.message);
      this.additionalData = additionalData ?? getAdditionalDataFromError(message);
      this.name = message.name;
      this.stack = message.stack;
    } else {
      if (message.startsWith('<?xml')) {
        logger.warn({ message }, '[XML ERROR]');
        message = 'An unexpected error has occurred';
      }
      super(message);
      this.additionalData = additionalData;
    }

    // FIXME: handle prisma errors here, we don't want to expose them to the user

    this.status = initStatus(message, 400);

    if (message instanceof ApiRequestError) {
      this.apiRequestError = message;
    }
  }
}

export class AuthenticationError extends Error {
  readonly status: number;
  readonly additionalData?: any;
  skipLogout: boolean;
  constructor(message: string | Error, additionalData?: any) {
    if (message instanceof Error) {
      super(message.message);
      this.name = message.name;
      this.stack = message.stack;
    } else {
      super(message);
    }
    this.status = initStatus(message, 401);
    this.additionalData = additionalData;
    this.skipLogout = Boolean(additionalData?.skipLogout ?? false);
  }
}

export class NotFoundError extends Error {
  readonly status: number;
  readonly additionalData?: any;
  constructor(message: string | Error, additionalData?: any) {
    if (message instanceof Error) {
      super(message.message);
      this.name = message.name;
      this.stack = message.stack;
    } else {
      super(message);
    }
    this.status = initStatus(message, 404);
    this.additionalData = additionalData;
  }
}

export class NotAllowedError extends Error {
  readonly status: number;
  readonly additionalData?: any;
  constructor(message: string | Error, additionalData?: any) {
    logger.warn({ message, additionalData }, '[ROUTE NOT ALLOWED]');
    if (message instanceof Error) {
      super(message.message);
      this.name = message.name;
      this.stack = message.stack;
    } else {
      super(message);
    }
    this.status = initStatus(message, 403);
    this.additionalData = additionalData;
  }
}
