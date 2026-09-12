import { logger } from '@jetstream/api-config';
import { StepUpAuthRequiredError } from '@jetstream/auth/server';
import { isPrismaError } from '@jetstream/prisma';
import { ApiRequestError } from '@jetstream/salesforce-api';
import { ERROR_MESSAGES } from '@jetstream/shared/constants';
import z, { ZodError } from 'zod';

// undici surfaces the real reason on `error.cause`. These two mean the request reached Salesforce and
// we gave up waiting for the response, so the work may have been done — the distinction that matters
// to the user. Everything else (UND_ERR_CONNECT_TIMEOUT included) failed before Salesforce saw the
// request, and is reported as unreachable so the user can simply retry.
const UPSTREAM_TIMEOUT_CODES = new Set(['UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT']);

/**
 * Node's fetch collapses every transport failure into an opaque `TypeError: fetch failed`, which we
 * passed straight through to users ("Error saving permissions: fetch failed"). Returns replacement
 * copy, or null when this is not a fetch transport failure.
 *
 * The copy names Salesforce because every raw `fetch failed` that reaches here comes from the
 * Salesforce callout layer: the route wrapper turns any unknown controller error into a
 * UserFacingError, and the other server-side fetch callers (SAML metadata, OIDC discovery, domain
 * verification, geo-IP) either handle their own transport errors or throw a message string, so they
 * never hit this branch. Revisit the wording if a non-Salesforce callout starts bubbling raw.
 */
function getUpstreamFetchFailureMessage(error: Error): string | null {
  if (error.message !== 'fetch failed') {
    return null;
  }
  const { code } = (error.cause ?? {}) as { code?: string };
  return code && UPSTREAM_TIMEOUT_CODES.has(code) ? ERROR_MESSAGES.SFDC_UPSTREAM_TIMEOUT : ERROR_MESSAGES.SFDC_UPSTREAM_UNREACHABLE;
}

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
      const upstreamFailureMessage = getUpstreamFetchFailureMessage(message);
      if (upstreamFailureMessage) {
        logger.warn({ cause: message.cause }, '[UPSTREAM FETCH FAILURE]');
        message.message = upstreamFailureMessage;
      }
      super(message.message);
      this.additionalData = additionalData;
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
