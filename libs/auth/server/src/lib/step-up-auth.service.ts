import { prisma } from '@jetstream/api-config';
import type { Request } from '@jetstream/api-types';
import type { StepUpAvailableMethods, StepUpMethod, StepUpPurpose } from '@jetstream/auth/types';
import { STEP_UP_AUTH_REQUIRED_ERROR_TYPE } from '@jetstream/auth/types';
import { addMinutes } from 'date-fns';
import { MAX_VERIFICATION_ATTEMPTS, STEP_UP_AUTH_TTL_MINUTES, STEP_UP_LOCKOUT_MINUTES, TOKEN_DURATION_MINUTES } from './auth.constants';
import { verifyPasswordForUserId } from './auth.db.service';
import { InvalidAction, InvalidCredentials, InvalidVerificationToken, TooManyVerificationAttempts } from './auth.errors';
import { generateRandomCode, generateRandomString, verifyTotpCodeOnceOrThrow } from './auth.service';
import { timingSafeStringCompare } from './auth.utils';

/**
 * Step-up (re)authentication: proving identity again from an already-authenticated session, before
 * an action that would let an attacker holding only a stolen session cookie take over the account.
 *
 * The grant lives on the session (see SessionData.stepUpAuth) rather than in the database, because
 * the session is already the trust boundary checkAuth enforces. That makes the grant inherently
 * device-scoped and means it dies with the session on revokeAllUserSessions, with no extra cleanup.
 */

/**
 * Only the parts of the request these functions actually read. Narrower than Request so callers with
 * differently-parameterized generics (e.g. createRoute's Request<unknown, unknown, unknown>) can pass
 * theirs directly.
 */
type StepUpRequest = Pick<Request, 'session' | 'externalAuth'>;

/**
 * Methods the user can actually complete, derived from what they have enrolled. The emailed-code
 * fallback is always present, which guarantees a non-empty list even for an oauth-only account with
 * no password and no authenticator - and it is a genuine second factor, since an attacker with a
 * stolen session cookie does not also control the mailbox.
 */
export async function getAvailableStepUpMethods(userId: string): Promise<StepUpAvailableMethods> {
  const user = await prisma.user.findUniqueOrThrow({
    select: {
      email: true,
      hasPasswordSet: true,
      authFactors: { select: { type: true, enabled: true, secret: true } },
    },
    where: { id: userId },
  });

  const methods: StepUpMethod[] = [];
  if (user.hasPasswordSet) {
    methods.push('password');
  }
  // Same predicate getTotpAuthenticationFactor filters on, so we never offer a method that would
  // then fail to resolve a usable secret.
  if (user.authFactors.some(({ type, enabled, secret }) => type === '2fa-otp' && enabled && !!secret)) {
    methods.push('2fa-otp');
  }
  methods.push('email');

  return { methods, email: user.email };
}

function assertNotLockedOut(req: StepUpRequest) {
  const lockedUntil = req.session.stepUpAuthLockedUntil;
  if (lockedUntil && lockedUntil > Date.now()) {
    throw new TooManyVerificationAttempts('Too many failed attempts. Please try again later.');
  }
}

/**
 * Generates and stores an emailed step-up code. Returns the plaintext code so the caller can send
 * it - this library never sends email itself.
 */
export async function createEmailStepUpChallenge(req: StepUpRequest, userId: string) {
  assertNotLockedOut(req);

  const { email } = await prisma.user.findUniqueOrThrow({ select: { email: true }, where: { id: userId } });
  const token = generateRandomCode(6);
  const expiresAt = addMinutes(new Date(), TOKEN_DURATION_MINUTES);

  req.session.stepUpChallenge = { type: 'email', token, exp: expiresAt.getTime() };
  // A fresh challenge resets the budget - the previous code is now unusable anyway.
  req.session.stepUpAuthAttempts = 0;

  return { code: token, email, expiresAt, expMinutes: TOKEN_DURATION_MINUTES };
}

/**
 * Registers a failed attempt and, once the budget is exhausted, clears all step-up state and starts
 * a cool-down.
 *
 * Unlike the login-time /auth/verify flow this deliberately does NOT destroy the session: the user
 * is already authenticated, and tearing down a working session over a few mistyped passwords would
 * be a self-inflicted denial of service with a real support cost.
 */
function recordFailedStepUpAttempt(req: StepUpRequest) {
  const attempts = (req.session.stepUpAuthAttempts ?? 0) + 1;
  req.session.stepUpAuthAttempts = attempts;

  if (attempts >= MAX_VERIFICATION_ATTEMPTS) {
    req.session.stepUpAuth = null;
    req.session.stepUpChallenge = null;
    req.session.stepUpAuthAttempts = 0;
    req.session.stepUpAuthLockedUntil = addMinutes(new Date(), STEP_UP_LOCKOUT_MINUTES).getTime();
    throw new TooManyVerificationAttempts('Too many failed attempts. Please try again later.');
  }
}

/**
 * Verifies one step-up factor and, on success, records a short-lived single-use grant on the session.
 */
export async function verifyStepUpOrThrow(
  req: StepUpRequest,
  { method, purpose, code, password }: { method: StepUpMethod; purpose: StepUpPurpose; code?: string; password?: string },
): Promise<{ method: StepUpMethod; stepUpNonce: string; expiresAt: Date }> {
  const user = req.session.user;
  if (!user) {
    throw new InvalidCredentials('Not authenticated');
  }
  assertNotLockedOut(req);

  try {
    switch (method) {
      case 'password': {
        if (!password) {
          throw new InvalidCredentials('Password is required');
        }
        // userId-scoped on purpose - see verifyPasswordForUserId for why the email-based login
        // lookup must not be reused here.
        const { error } = await verifyPasswordForUserId(user.id, password);
        if (error) {
          throw error;
        }
        break;
      }
      case '2fa-otp': {
        if (!code) {
          throw new InvalidVerificationToken('Code is required');
        }
        await verifyTotpCodeOnceOrThrow(user.id, code);
        break;
      }
      case 'email': {
        const challenge = req.session.stepUpChallenge;
        if (!code) {
          throw new InvalidVerificationToken('Code is required');
        }
        if (!challenge || challenge.exp < Date.now()) {
          throw new InvalidVerificationToken('Your code has expired, request a new one');
        }
        if (!timingSafeStringCompare(challenge.token, code)) {
          throw new InvalidVerificationToken('Provided code does not match');
        }
        req.session.stepUpChallenge = null;
        break;
      }
      default: {
        throw new InvalidAction(method);
      }
    }
  } catch (ex) {
    // An expired or malformed submission still burns budget - otherwise the attempt ceiling could
    // be sidestepped. AccountLocked / PasswordResetRequired are surfaced as-is.
    if (ex instanceof InvalidCredentials || ex instanceof InvalidVerificationToken) {
      recordFailedStepUpAttempt(req);
    }
    throw ex;
  }

  const expiresAt = addMinutes(new Date(), STEP_UP_AUTH_TTL_MINUTES);
  const stepUpNonce = generateRandomString(32);

  req.session.stepUpAuth = {
    method,
    purpose,
    verifiedAt: Date.now(),
    expiresAt: expiresAt.getTime(),
    nonce: stepUpNonce,
  };
  req.session.stepUpAuthAttempts = 0;
  req.session.stepUpAuthLockedUntil = undefined;

  return { method, stepUpNonce, expiresAt };
}

/**
 * Consumes the step-up grant required by a protected route, or throws.
 *
 * Consumption is destructive: a grant authorizes exactly one action. The purpose check stops a grant
 * obtained for one sensitive route being silently reused by another, and the nonce - which only ever
 * lives in the requesting tab's memory - stops script in a different tab riding a grant it never
 * earned.
 */
export function consumeStepUpAuthOrThrow(req: StepUpRequest, purpose: StepUpPurpose, nonce?: string): StepUpMethod {
  // Desktop and browser-extension callers authenticate with a bearer token and have no express
  // session, so there is nowhere for a grant to live. Deny rather than silently skip the check.
  if (req.externalAuth) {
    throw new StepUpAuthRequiredError('This action must be performed in a browser.');
  }

  const stepUpAuth = req.session.stepUpAuth;

  // The nonce must match exactly - an absent one is a mismatch, not a waiver. Treating "no nonce
  // supplied" as acceptable would let script in another tab consume a grant it never earned simply
  // by omitting the field.
  if (!stepUpAuth || stepUpAuth.purpose !== purpose || stepUpAuth.expiresAt < Date.now() || stepUpAuth.nonce !== nonce) {
    req.session.stepUpAuth = null;
    throw new StepUpAuthRequiredError('Please verify your identity to continue');
  }

  req.session.stepUpAuth = null;
  return stepUpAuth.method;
}

/**
 * Signals that the caller must re-verify their identity before the action can proceed.
 *
 * Deliberately extends Error and NOT AuthError: the AuthError branch of the response handler
 * redirects non-JSON requests to the login page and the deferred-response path marks them for
 * logout, and AuthenticationError sets the X-AUTH-LOGOUT header the client honours unconditionally.
 * Either would sign the user out at exactly the moment we want to prompt them to re-authenticate.
 *
 * Carries no payload beyond the message: the prompt fetches the factor list from
 * GET /api/me/profile/step-up/methods, which keeps this error path free of database work and leaves
 * exactly one source of truth for which factors a user can complete.
 */
export class StepUpAuthRequiredError extends Error {
  readonly status = 403;
  readonly errorType = STEP_UP_AUTH_REQUIRED_ERROR_TYPE;

  constructor(message: string) {
    super(message);
    this.name = 'StepUpAuthRequiredError';
  }
}
