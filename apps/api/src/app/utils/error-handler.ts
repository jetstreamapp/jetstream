import { logger } from '@jetstream/api-config';
import { isPrismaError } from '@jetstream/prisma';
import { ApiRequestError } from '@jetstream/salesforce-api';
import { ZodError } from 'zod';

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
    isPrismaError(error)
  );
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
      const errorDetails = Object.values(
        message.flatten((issue) => ({
          message: `Data Validation error: '${issue.path.join('.')}' is invalid, ${issue.message}`,
          errorCode: issue.code,
        })).fieldErrors,
      );

      const formattedMessage = errorDetails
        .flatMap((item) => item)
        .map((item) => item?.message)
        .filter(Boolean)
        .join(', ');

      super(formattedMessage);
      this.additionalData = message.errors;
      this.name = 'Validation Error';
      this.stack = message.stack;
    } else if (message instanceof Error) {
      if (message.message.startsWith('<?xml')) {
        console.warn('[XML ERROR]', { message: message.message });
        message.message = 'An unexpected error has occurred';
      }
      super(message.message);
      this.additionalData = additionalData;
      this.name = message.name;
      this.stack = message.stack;
    } else {
      if (message.startsWith('<?xml')) {
        console.warn('[XML ERROR]', { message });
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
