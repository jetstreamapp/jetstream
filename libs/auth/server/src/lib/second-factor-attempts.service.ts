import { DbCacheProvider } from '@jetstream/api-config';
import { MAX_SECOND_FACTOR_ATTEMPTS_PER_ACCOUNT, SECOND_FACTOR_ATTEMPT_WINDOW_MINUTES } from './auth.constants';
import { TooManyVerificationAttempts } from './auth.errors';

/**
 * Account-wide budget for second-factor code submissions at /auth/verify.
 *
 * The per-session counter (pendingVerificationAttempts) and the session/IP rate limiters still apply,
 * but all of them are reset by completing the first factor again from a new session or address. This
 * counter is keyed on the user instead and lives in the shared database cache, so it is the same number
 * no matter how many sessions, instances or source addresses the submissions arrive through.
 *
 * An attempt is reserved BEFORE the code is checked rather than recorded after a failure: a burst of
 * parallel submissions would otherwise all pass a "still under the limit" check before any of them had
 * been counted. A successful verification clears the budget, so a correct code is never charged.
 */

// Lazily constructed for the same reason as the TOTP replay cache in auth.service.ts
let attemptsCache: DbCacheProvider | undefined;
function getAttemptsCache() {
  attemptsCache = attemptsCache ?? new DbCacheProvider('auth:2fa-attempts', SECOND_FACTOR_ATTEMPT_WINDOW_MINUTES * 60 * 1000);
  return attemptsCache;
}

/**
 * Counts one submission against the account and throws once the window's budget is spent. The count
 * keeps climbing past the limit while locked, but the window never extends, so the lock lifts
 * SECOND_FACTOR_ATTEMPT_WINDOW_MINUTES after the first submission of the window at the latest.
 */
export async function reserveSecondFactorAttemptOrThrow(userId: string): Promise<void> {
  const attempts = await getAttemptsCache().incrementAsync(userId);
  if (attempts > MAX_SECOND_FACTOR_ATTEMPTS_PER_ACCOUNT) {
    throw new TooManyVerificationAttempts('Too many failed verification attempts for this account. Please try again later.', {
      userId,
    });
  }
}

/** Clears the account's budget after a successful verification. */
export async function clearSecondFactorAttempts(userId: string): Promise<void> {
  await getAttemptsCache().removeAsync(userId);
}
