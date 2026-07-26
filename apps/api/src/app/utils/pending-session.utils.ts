import type { SessionData } from '@jetstream/auth/types';

/**
 * Auth-flow destinations for a session that has passed the first factor but still has an unmet
 * requirement. These mirror the pending-state gates in route.middleware.ts and the post-login
 * redirects in auth.controller.ts.
 */
export const PENDING_SESSION_REDIRECT_PATHS = {
  pendingVerification: '/auth/verify',
  pendingMfaEnrollment: '/auth/mfa-enroll',
  pendingTosAcceptance: '/auth/accept-terms',
} as const;

type PendingSessionState = Pick<SessionData, 'pendingVerification' | 'pendingMfaEnrollment' | 'pendingTosAcceptance'>;

/**
 * If the session is mid-authentication — the first factor passed (`req.session.user` is set) but
 * 2FA verification, MFA enrollment, or ToS acceptance is still outstanding — return the auth-flow
 * path the browser should be routed to. Returns `null` when the session has no outstanding
 * requirement (i.e. it is fully authenticated).
 *
 * External-token endpoints (desktop app, web extension) MUST consult this before issuing a token so
 * a half-authenticated session cannot be exchanged for a full-access token, which would bypass the
 * second factor. The ordering matches the post-login redirects in auth.controller.ts.
 */
export function getPendingSessionRedirectPath(session: Partial<PendingSessionState> | undefined): string | null {
  if (!session) {
    return null;
  }
  // Match checkAuth: treat any non-nullish pendingVerification as "still pending" so a corrupted or
  // unexpectedly-empty array blocks rather than silently passing.
  if (session.pendingVerification) {
    return PENDING_SESSION_REDIRECT_PATHS.pendingVerification;
  }
  if (session.pendingMfaEnrollment) {
    return PENDING_SESSION_REDIRECT_PATHS.pendingMfaEnrollment;
  }
  if (session.pendingTosAcceptance) {
    return PENDING_SESSION_REDIRECT_PATHS.pendingTosAcceptance;
  }
  return null;
}
