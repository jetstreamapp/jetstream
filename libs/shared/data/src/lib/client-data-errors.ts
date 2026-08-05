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
