import { STEP_UP_AUTH_REQUIRED_ERROR_TYPE } from '@jetstream/auth/types';

/**
 * Thrown when the server needs the user to re-verify their identity before the request can proceed.
 *
 * Detection lives in the shared response interceptor, but PRESENTATION deliberately does not: this
 * data layer is also used by the desktop client, browser extension and canvas app, none of which
 * have a step-up flow, and background traffic would otherwise surface unexplained prompts. Call
 * sites opt in by wrapping the request in `runWithStepUp`.
 */
export class StepUpRequiredError extends Error {
  readonly errorType = STEP_UP_AUTH_REQUIRED_ERROR_TYPE;

  constructor(message: string) {
    super(message);
    this.name = 'StepUpRequiredError';
  }
}

/**
 * A failed API request, carrying the HTTP status the server responded with (null when the request
 * never completed — connection drop, offline, proxy kill). Call sites that must tell "the server
 * rejected this" from "this never made it to the server" read {@link ApiRequestError.status};
 * everything else keeps treating it as the plain `Error` it replaced.
 *
 * `name` is intentionally left as `Error`: every request failure used to be a plain `Error` and the
 * error tracker groups by name, so overriding it would re-bucket every existing API error.
 */
export class ApiRequestError extends Error {
  /** Marker so {@link isApiRequestError} holds across module instances, the way `isAxiosError` does. */
  readonly isApiRequestError = true;
  readonly status: number | null;
  /**
   * Structured context the server attached to the failure, forwarded verbatim so call sites can key on
   * it (e.g. a seat change reads `code` to tell a declined card from a stale preview). Undefined for
   * responses that carried none, so every reader must treat it as optional.
   */
  readonly additionalData?: Record<string, unknown>;

  constructor(message: string, status: number | null = null, additionalData?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.additionalData = additionalData;
  }
}

/** Reads a string `code` off a failed request's server-supplied context, when there is one. */
export function getApiErrorCode(error: unknown): string | null {
  if (!isApiRequestError(error)) {
    return null;
  }
  const { code } = error.additionalData ?? {};
  return typeof code === 'string' ? code : null;
}

export function isApiRequestError(error: unknown): error is ApiRequestError {
  return error instanceof Error && (error as Partial<ApiRequestError>).isApiRequestError === true;
}

/** Message of a request the caller canceled - the capitalized form the error tracker's ignore list matches */
export const REQUEST_CANCELED_MESSAGE = 'Canceled';

/**
 * True when the request failed for a reason that repeating it may not hit again: no response at all (connection
 * drop, offline) or a 429/5xx, which includes an upstream Salesforce connection failure the server reports as a 502.
 * A 4xx is the server rejecting the request itself, which a repeat would not change.
 */
export function isTransientRequestFailure(error: unknown): boolean {
  if (!isApiRequestError(error)) {
    return false;
  }
  const { status, message } = error;
  if (status === null) {
    return message !== REQUEST_CANCELED_MESSAGE;
  }
  return status === 429 || status >= 500;
}

/**
 * True when the server explicitly rejected the request as unauthenticated or forbidden, as opposed
 * to a network failure or a server error, which say nothing about whether the user is signed in.
 */
export function isAuthenticationFailure(error: unknown): boolean {
  return isApiRequestError(error) && (error.status === 401 || error.status === 403);
}

/**
 * The user dismissed the re-authentication prompt. Not a failure - call sites should swallow this
 * silently rather than surfacing an error toast.
 */
export class StepUpCancelledError extends Error {
  readonly errorType = 'STEP_UP_CANCELLED';

  constructor(message = 'Verification was cancelled') {
    super(message);
    this.name = 'StepUpCancelledError';
  }
}
