import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_VERIFICATION_ATTEMPTS } from '../auth.constants';
import { InvalidCredentials, InvalidVerificationToken, TooManyVerificationAttempts } from '../auth.errors';
import {
  consumeStepUpAuthOrThrow,
  createEmailStepUpChallenge,
  getAvailableStepUpMethods,
  StepUpAuthRequiredError,
  verifyStepUpOrThrow,
} from '../step-up-auth.service';

const prismaMock = vi.hoisted(() => ({
  user: {
    findUniqueOrThrow: vi.fn(),
  },
}));

const authDbMock = vi.hoisted(() => ({
  verifyPasswordForUserId: vi.fn(),
}));

const authServiceMock = vi.hoisted(() => ({
  generateRandomCode: vi.fn(() => '123456'),
  generateRandomString: vi.fn(() => 'nonce-value'),
  verifyTotpCodeOnceOrThrow: vi.fn(),
}));

vi.mock('@jetstream/api-config', () => ({
  prisma: prismaMock,
}));

vi.mock('../auth.db.service', () => authDbMock);
vi.mock('../auth.service', () => authServiceMock);

const USER_ID = 'aaaaaaaa-0000-0000-0000-aaaaaaaaaaaa';

// Only the shape the service reads - see StepUpRequest.
function createRequest(overrides: Record<string, unknown> = {}) {
  return {
    session: {
      id: 'session-id',
      user: { id: USER_ID, email: 'user@example.com' },
      ...((overrides.session as Record<string, unknown>) ?? {}),
    },
    externalAuth: overrides.externalAuth,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  authServiceMock.generateRandomString.mockReturnValue('nonce-value');
  authServiceMock.generateRandomCode.mockReturnValue('123456');
});

describe('getAvailableStepUpMethods', () => {
  it('should offer password and authenticator when both are set up', async () => {
    prismaMock.user.findUniqueOrThrow.mockResolvedValue({
      email: 'user@example.com',
      hasPasswordSet: true,
      authFactors: [{ type: '2fa-otp', enabled: true, secret: 'encrypted' }],
    });

    const { methods, email } = await getAvailableStepUpMethods(USER_ID);

    expect(methods).toEqual(['password', '2fa-otp', 'email']);
    // Step-up only runs inside an authenticated session, where the caller can already read their own
    // address off the profile page - masking it here would hide nothing and obscure which inbox to check.
    expect(email).toEqual('user@example.com');
  });

  it('should always include the emailed-code fallback so an oauth-only account can still step up', async () => {
    prismaMock.user.findUniqueOrThrow.mockResolvedValue({
      email: 'user@example.com',
      hasPasswordSet: false,
      authFactors: [],
    });

    const { methods } = await getAvailableStepUpMethods(USER_ID);

    expect(methods).toEqual(['email']);
  });

  it('should not offer an authenticator factor that is disabled or has no secret', async () => {
    prismaMock.user.findUniqueOrThrow.mockResolvedValue({
      email: 'user@example.com',
      hasPasswordSet: false,
      authFactors: [
        { type: '2fa-otp', enabled: false, secret: 'encrypted' },
        { type: '2fa-otp', enabled: true, secret: null },
      ],
    });

    const { methods } = await getAvailableStepUpMethods(USER_ID);

    expect(methods).toEqual(['email']);
  });
});

describe('verifyStepUpOrThrow', () => {
  it('should verify the password against the SESSION USER ID, never an email', async () => {
    // The regression this locks in: User.email is not unique, so resolving by email could
    // authenticate - and lock out - an entirely different account.
    authDbMock.verifyPasswordForUserId.mockResolvedValue({ error: null });
    const req = createRequest();

    await verifyStepUpOrThrow(req, { method: 'password', purpose: 'CHANGE_EMAIL', password: 'correct-horse' });

    expect(authDbMock.verifyPasswordForUserId).toHaveBeenCalledWith(USER_ID, 'correct-horse');
    expect(req.session.stepUpAuth).toMatchObject({ method: 'password', purpose: 'CHANGE_EMAIL', nonce: 'nonce-value' });
  });

  it('should burn an attempt on a wrong password', async () => {
    authDbMock.verifyPasswordForUserId.mockResolvedValue({ error: new InvalidCredentials('Incorrect password') });
    const req = createRequest();

    await expect(verifyStepUpOrThrow(req, { method: 'password', purpose: 'CHANGE_EMAIL', password: 'nope' })).rejects.toThrow(
      InvalidCredentials,
    );

    expect(req.session.stepUpAuthAttempts).toBe(1);
    expect(req.session.stepUpAuth).toBeUndefined();
  });

  it('should lock out after the attempt budget WITHOUT destroying the session', async () => {
    // Deliberate difference from login-time verification: the user is already authenticated, so
    // tearing down a working session over mistyped passwords would be a self-inflicted outage.
    authDbMock.verifyPasswordForUserId.mockResolvedValue({ error: new InvalidCredentials('Incorrect password') });
    const destroy = vi.fn();
    const req = createRequest({ session: { destroy, stepUpAuthAttempts: MAX_VERIFICATION_ATTEMPTS - 1 } });

    await expect(verifyStepUpOrThrow(req, { method: 'password', purpose: 'CHANGE_EMAIL', password: 'nope' })).rejects.toThrow(
      TooManyVerificationAttempts,
    );

    expect(destroy).not.toHaveBeenCalled();
    expect(req.session.stepUpAuthLockedUntil).toBeGreaterThan(Date.now());
    expect(req.session.stepUpAuthAttempts).toBe(0);
  });

  it('should refuse further attempts while locked out', async () => {
    const req = createRequest({ session: { stepUpAuthLockedUntil: Date.now() + 60_000 } });

    await expect(verifyStepUpOrThrow(req, { method: 'password', purpose: 'CHANGE_EMAIL', password: 'anything' })).rejects.toThrow(
      TooManyVerificationAttempts,
    );
    expect(authDbMock.verifyPasswordForUserId).not.toHaveBeenCalled();
  });

  it('should burn the emailed code once it is used', async () => {
    const req = createRequest({ session: { stepUpChallenge: { type: 'email', token: '123456', exp: Date.now() + 60_000 } } });

    await verifyStepUpOrThrow(req, { method: 'email', purpose: 'CHANGE_EMAIL', code: '123456' });

    expect(req.session.stepUpChallenge).toBeNull();
    expect(req.session.stepUpAuth).toMatchObject({ method: 'email' });
  });

  it('should reject an expired emailed code', async () => {
    const req = createRequest({ session: { stepUpChallenge: { type: 'email', token: '123456', exp: Date.now() - 1 } } });

    await expect(verifyStepUpOrThrow(req, { method: 'email', purpose: 'CHANGE_EMAIL', code: '123456' })).rejects.toThrow(
      InvalidVerificationToken,
    );
    expect(req.session.stepUpAuthAttempts).toBe(1);
  });

  it('should reject a TOTP code that was already consumed', async () => {
    authServiceMock.verifyTotpCodeOnceOrThrow.mockRejectedValue(new InvalidVerificationToken('Provided code has already been used'));
    const req = createRequest();

    await expect(verifyStepUpOrThrow(req, { method: '2fa-otp', purpose: 'CHANGE_EMAIL', code: '654321' })).rejects.toThrow(
      InvalidVerificationToken,
    );
    expect(authServiceMock.verifyTotpCodeOnceOrThrow).toHaveBeenCalledWith(USER_ID, '654321');
  });
});

describe('consumeStepUpAuthOrThrow', () => {
  function grantedRequest(overrides: Record<string, unknown> = {}) {
    return createRequest({
      session: {
        stepUpAuth: {
          method: 'password',
          purpose: 'CHANGE_EMAIL',
          verifiedAt: Date.now(),
          expiresAt: Date.now() + 60_000,
          nonce: 'nonce-value',
          ...overrides,
        },
      },
    });
  }

  it('should consume a valid grant exactly once', async () => {
    const req = grantedRequest();

    expect(consumeStepUpAuthOrThrow(req, 'CHANGE_EMAIL', 'nonce-value')).toBe('password');
    expect(req.session.stepUpAuth).toBeNull();
    // A grant authorizes one action - replaying it must fail.
    expect(() => consumeStepUpAuthOrThrow(req, 'CHANGE_EMAIL', 'nonce-value')).toThrow(StepUpAuthRequiredError);
  });

  it('should reject an expired grant', () => {
    const req = grantedRequest({ expiresAt: Date.now() - 1 });
    expect(() => consumeStepUpAuthOrThrow(req, 'CHANGE_EMAIL', 'nonce-value')).toThrow(StepUpAuthRequiredError);
  });

  it('should reject a grant obtained for a different purpose', () => {
    const req = grantedRequest({ purpose: 'SOMETHING_ELSE' });
    expect(() => consumeStepUpAuthOrThrow(req, 'CHANGE_EMAIL', 'nonce-value')).toThrow(StepUpAuthRequiredError);
  });

  it('should reject a mismatched nonce so another browser tab cannot ride the grant', () => {
    const req = grantedRequest();
    expect(() => consumeStepUpAuthOrThrow(req, 'CHANGE_EMAIL', 'a-different-nonce')).toThrow(StepUpAuthRequiredError);
  });

  it('should reject an omitted nonce rather than treating it as a waiver', () => {
    // Otherwise the binding could be sidestepped simply by leaving the field out.
    const req = grantedRequest();
    expect(() => consumeStepUpAuthOrThrow(req, 'CHANGE_EMAIL')).toThrow(StepUpAuthRequiredError);
  });

  it('should reject when there is no grant at all', () => {
    expect(() => consumeStepUpAuthOrThrow(createRequest(), 'CHANGE_EMAIL')).toThrow(StepUpAuthRequiredError);
  });

  it('should deny external (desktop/extension) callers even with a valid grant on the session', () => {
    // Bearer-token callers have no express session for a grant to live on - denying outright is the
    // only safe outcome, since silently skipping the check would bypass step-up entirely.
    const req = grantedRequest();
    req.externalAuth = { user: { id: USER_ID } };

    expect(() => consumeStepUpAuthOrThrow(req, 'CHANGE_EMAIL', 'nonce-value')).toThrow(StepUpAuthRequiredError);
  });

  it('should NOT be an AuthError, which would log the user out instead of prompting', () => {
    // response.handlers redirects AuthError to the login page; a step-up prompt must not do that.
    const error = new StepUpAuthRequiredError('Please verify your identity to continue');
    expect(error.status).toBe(403);
    expect(error.errorType).toBe('STEP_UP_AUTH_REQUIRED');
  });
});

describe('createEmailStepUpChallenge', () => {
  it('should store the code on the session and reset the attempt budget', async () => {
    prismaMock.user.findUniqueOrThrow.mockResolvedValue({ email: 'user@example.com' });
    const req = createRequest({ session: { stepUpAuthAttempts: 3 } });

    const { code, email } = await createEmailStepUpChallenge(req, USER_ID);

    expect(code).toBe('123456');
    expect(email).toBe('user@example.com');
    expect(req.session.stepUpChallenge).toMatchObject({ type: 'email', token: '123456' });
    expect(req.session.stepUpAuthAttempts).toBe(0);
  });

  it('should refuse to send while locked out', async () => {
    const req = createRequest({ session: { stepUpAuthLockedUntil: Date.now() + 60_000 } });
    await expect(createEmailStepUpChallenge(req, USER_ID)).rejects.toThrow(TooManyVerificationAttempts);
  });
});
