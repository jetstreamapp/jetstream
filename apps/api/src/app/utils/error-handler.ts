import { logger } from '../config/logger.config';

/* eslint-disable @typescript-eslint/no-explicit-any */
export class UserFacingError extends Error {
  additionalData?: any;
  constructor(message: string | Error, additionalData?: any) {
    if (message instanceof Error) {
      if (message.message.startsWith('<?xml')) {
        logger.warn('[XML ERROR]', { message: message.message });
        message.message = 'An unexpected error has occurred';
      }
      super(message.message);
      this.name = message.name;
      this.stack = message.stack;
    } else {
      if (message.startsWith('<?xml')) {
        logger.warn('[XML ERROR]', { message });
        message = 'An unexpected error has occurred';
      }
      super(message);
    }
    this.additionalData = additionalData;
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
