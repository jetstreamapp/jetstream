import { describe, expect, it } from 'vitest';
import { getPendingSessionRedirectPath, PENDING_SESSION_REDIRECT_PATHS } from '../pending-session.utils';

describe('getPendingSessionRedirectPath', () => {
  it('returns null for an undefined session', () => {
    expect(getPendingSessionRedirectPath(undefined)).toBeNull();
  });

  it('returns null for a fully authenticated session with no pending state', () => {
    expect(getPendingSessionRedirectPath({})).toBeNull();
    expect(getPendingSessionRedirectPath({ pendingVerification: null, pendingMfaEnrollment: null, pendingTosAcceptance: null })).toBeNull();
  });

  it('routes a pending 2FA/email verification to /auth/verify', () => {
    expect(getPendingSessionRedirectPath({ pendingVerification: [{ type: '2fa-otp', exp: Date.now() }] })).toBe(
      PENDING_SESSION_REDIRECT_PATHS.pendingVerification,
    );
  });

  it('treats a corrupted/empty pendingVerification array as still pending', () => {
    // Mirrors checkAuth: any non-nullish pendingVerification blocks rather than silently passing.
    expect(getPendingSessionRedirectPath({ pendingVerification: [] })).toBe(PENDING_SESSION_REDIRECT_PATHS.pendingVerification);
  });

  it('routes pending MFA enrollment to /auth/mfa-enroll', () => {
    expect(getPendingSessionRedirectPath({ pendingMfaEnrollment: { factor: '2fa-otp' } })).toBe(
      PENDING_SESSION_REDIRECT_PATHS.pendingMfaEnrollment,
    );
  });

  it('routes pending ToS acceptance to /auth/accept-terms', () => {
    expect(getPendingSessionRedirectPath({ pendingTosAcceptance: true })).toBe(PENDING_SESSION_REDIRECT_PATHS.pendingTosAcceptance);
  });

  it('prioritizes verification, then MFA enrollment, then ToS (matches the post-login redirect order)', () => {
    expect(
      getPendingSessionRedirectPath({
        pendingVerification: [{ type: '2fa-otp', exp: Date.now() }],
        pendingMfaEnrollment: { factor: '2fa-otp' },
        pendingTosAcceptance: true,
      }),
    ).toBe(PENDING_SESSION_REDIRECT_PATHS.pendingVerification);

    expect(getPendingSessionRedirectPath({ pendingMfaEnrollment: { factor: '2fa-otp' }, pendingTosAcceptance: true })).toBe(
      PENDING_SESSION_REDIRECT_PATHS.pendingMfaEnrollment,
    );
  });
});
