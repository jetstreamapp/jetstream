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

  constructor(message: string, status: number | null = null) {
    super(message);
    this.status = status;
  }
}

export function isApiRequestError(error: unknown): error is ApiRequestError {
  return error instanceof Error && (error as Partial<ApiRequestError>).isApiRequestError === true;
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
