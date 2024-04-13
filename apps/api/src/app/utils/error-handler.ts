import { logger } from '@jetstream/api-config';
import { ApiRequestError } from '@jetstream/salesforce-api';
import { ZodError } from 'zod';

/* eslint-disable @typescript-eslint/no-explicit-any */
export class UserFacingError extends Error {
  /**
   * This data is propagated so that response can include the http status code
   */
  apiRequestError?: ApiRequestError;
  /**
   * additionalData will be included in http response
   */
  additionalData?: any;
  constructor(message: string | Error | ZodError, additionalData?: any) {
    if (message instanceof ZodError) {
      const errorDetails = Object.values(
        message.flatten((issue) => ({
          message: `Invalid request: '${issue.path.join('.')}' is ${issue.message}`,
          errorCode: issue.code,
        })).fieldErrors
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

    if (message instanceof ApiRequestError) {
      this.apiRequestError = message;
    }
  }
}

export class AuthenticationError extends Error {
  additionalData?: any;
  constructor(message: string | Error, additionalData?: any) {
    if (message instanceof Error) {
      super(message.message);
      this.name = message.name;
      this.stack = message.stack;
    } else {
      super(message);
    }
    this.additionalData = additionalData;
  }
}

export class NotFoundError extends Error {
  additionalData?: any;
  constructor(message: string | Error, additionalData?: any) {
    if (message instanceof Error) {
      super(message.message);
      this.name = message.name;
      this.stack = message.stack;
    } else {
      super(message);
    }
    this.additionalData = additionalData;
  }
}

export class NotAllowedError extends Error {
  additionalData?: any;
  constructor(message: string | Error, additionalData?: any) {
    logger.warn({ message, additionalData }, '[ROUTE NOT ALLOWED]');
    if (message instanceof Error) {
      super(message.message);
      this.name = message.name;
      this.stack = message.stack;
    } else {
      super(message);
    }
    this.additionalData = additionalData;
  }
}
