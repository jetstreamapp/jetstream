/**
 * Regression coverage for the placeholder-session email-suppression guard in the
 * `callback` (register) and `resendVerification` handlers. When a user attempts to
 * register with an already-used email, the server creates a placeholder/temporary
 * session and routes the request to /auth/verify to preserve the enumeration
 * defense. Historically this also fired a real verification email at the actual
 * owner of the inbox — useless (the verify flow just destroys the session) and
 * effectively spam. These tests lock in that no email is sent for placeholder
 * sessions while still being sent for legitimate new registrations.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { routeDefinition } from '../auth.controller';

const emailMocks = vi.hoisted(() => ({
  sendEmailVerification: vi.fn(),
  sendVerificationCode: vi.fn(),
  sendWelcomeEmail: vi.fn(),
  sendPasswordReset: vi.fn(),
  sendAuthenticationChangeConfirmation: vi.fn(),
}));

const authServerMocks = vi.hoisted(() => {
  const PLACEHOLDER_USER_ID = '00000000-0000-0000-0000-000000000000';
  class AuthError extends Error {
    type = 'auth_error';
  }
  class InvalidSession extends AuthError {}
  class InvalidAction extends AuthError {}
  class InvalidProvider extends AuthError {}
  class InvalidVerificationToken extends AuthError {}
  class InvalidParameters extends AuthError {}
  class ExpiredVerificationToken extends AuthError {}
  class IdentityLinkingNotAllowed extends AuthError {}
  class ProviderEmailNotVerified extends AuthError {}
  class ProviderNotAllowed extends AuthError {}

  return {
    PLACEHOLDER_USER_ID,
    CURRENT_TOS_VERSION: 'v1',
    EMAIL_VERIFICATION_TOKEN_DURATION_HOURS: 24,
    PASSWORD_RESET_DURATION_MINUTES: 30,
    TOKEN_DURATION_MINUTES: 10,
    AuthError,
    InvalidSession,
    InvalidAction,
    InvalidProvider,
    InvalidVerificationToken,
    InvalidParameters,
    ExpiredVerificationToken,
    IdentityLinkingNotAllowed,
    ProviderEmailNotVerified,
    ProviderNotAllowed,
    acceptTos: vi.fn(),
    clearOauthCookies: vi.fn(),
    convertBase32ToHex: vi.fn(),
    createOrUpdateOtpAuthFactor: vi.fn(),
    createRememberDevice: vi.fn(),
    createUserActivityFromReq: vi.fn(),
    createUserActivityFromReqWithError: vi.fn(),
    discoverSsoConfigByDomain: vi.fn(),
    ensureAuthError: vi.fn((error: unknown) => error),
    generate2faTotpUrl: vi.fn(),
    generatePasswordResetToken: vi.fn(),
    generateRandomCode: vi.fn(() => '123456'),
    generateRandomString: vi.fn(() => 'random-string'),
    getApiAddressFromReq: vi.fn(() => '127.0.0.1'),
    getAuthorizationUrl: vi.fn(),
    getCookieConfig: vi.fn(() => ({
      csrfToken: { name: 'csrfToken', options: {} },
      doubleCSRFToken: { name: 'doubleCSRFToken', options: {} },
      pkceCodeVerifier: { name: 'pkceCodeVerifier', options: {} },
      nonce: { name: 'nonce', options: {} },
      linkIdentity: { name: 'linkIdentity', options: {} },
      returnUrl: { name: 'returnUrl', options: {} },
      rememberDevice: { name: 'rememberDevice', options: {} },
      redirectUrl: { name: 'redirectUrl', options: {} },
      teamInviteState: { name: 'teamInviteState', options: {} },
    })),
    getLoginConfiguration: vi.fn(),
    getTeamLoginConfigWithSso: vi.fn(),
    getTotpAuthenticationFactor: vi.fn(),
    handleSignInOrRegistration: vi.fn(),
    handleSsoLogin: vi.fn(),
    hasRememberDeviceRecord: vi.fn(),
    initSession: vi.fn(),
    linkIdentityToUser: vi.fn(),
    getProviders: vi.fn(() => ({
      credentials: { type: 'credentials', provider: 'credentials' },
    })),
    oidcService: {},
    resetUserPassword: vi.fn(),
    samlService: {},
    setUserEmailVerified: vi.fn(),
    timingSafeStringCompare: vi.fn((left: string, right: string) => left === right),
    validateCallback: vi.fn(),
    validateRedirectUrl: vi.fn((url: string) => url || 'https://client.test'),
    verify2faTotpOrThrow: vi.fn(),
    verifyCSRFFromRequestOrThrow: vi.fn(),
  };
});

vi.mock('@jetstream/api-config', () => ({
  ENV: {
    JETSTREAM_SERVER_URL: 'https://server.test',
    JETSTREAM_CLIENT_URL: 'https://client.test',
    USE_SECURE_COOKIES: false,
    JETSTREAM_AUTH_SECRET: 'auth-secret',
    JETSTREAM_SESSION_SECRET: 'session-secret',
    ENVIRONMENT: 'test',
    CI: false,
  },
  getExceptionLog: (error: unknown) => ({ error: error instanceof Error ? error.message : error }),
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  prisma: {},
  rollbarServer: { error: vi.fn(), warn: vi.fn() },
}));

vi.mock('@jetstream/auth/server', () => authServerMocks);

vi.mock('@jetstream/email', () => emailMocks);

vi.mock('@jetstream/prisma', () => ({
  isPrismaError: () => false,
  Prisma: {
    PrismaClientKnownRequestError: class extends Error {},
    PrismaClientUnknownRequestError: class extends Error {},
    PrismaClientValidationError: class extends Error {},
  },
  toTypedPrismaError: () => ({ code: undefined }),
}));

// Stubbed so response.handlers / route.utils don't pull in Prisma-backed DB code.
vi.mock('../../db/salesforce-org.db', () => ({
  findByUniqueId_UNSAFE: vi.fn(),
  updateOrg_UNSAFE: vi.fn(),
}));

// Stub the response helpers — we only need to observe them, not actually write to a socket.
vi.mock('../../utils/response.handlers', () => ({
  redirect: vi.fn(),
  sendJson: vi.fn(),
  setCsrfCookie: vi.fn(),
  sendHtml: vi.fn(),
  setCookieHeaders: vi.fn(),
}));

type MockRequest = {
  method: string;
  headers: { cookie: string };
  params: Record<string, string>;
  query: Record<string, unknown>;
  body: Record<string, unknown>;
  session: Record<string, unknown>;
  get: (name: string) => string | undefined;
  log: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; debug: ReturnType<typeof vi.fn> };
  ip: string;
};

function makeReq(overrides: Partial<MockRequest> = {}): MockRequest {
  return {
    method: 'POST',
    headers: { cookie: '' },
    params: { provider: 'credentials' },
    query: {},
    body: {},
    session: {
      id: 'session-id',
      destroy: vi.fn((cb?: (err?: unknown) => void) => cb?.()),
      save: vi.fn((cb?: (err?: unknown) => void) => cb?.()),
    },
    get: vi.fn(() => undefined),
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    ip: '127.0.0.1',
    ...overrides,
  };
}

function makeRes() {
  const res = {
    locals: { cookies: {}, requestId: 'request-id', ipAddress: '127.0.0.1' },
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    json: vi.fn(),
    status: vi.fn(),
    set: vi.fn(),
    redirect: vi.fn(),
    appendHeader: vi.fn(),
    cookie: vi.fn(),
  };
  res.status.mockReturnValue(res as never);
  res.json.mockReturnValue(res as never);
  return res;
}

const VALID_PASSWORD = 'ValidP@ssw0rd!';

describe('auth.controller - placeholder session email suppression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // getCookieConfig / getProviders are cleared by clearAllMocks - re-prime their return values.
    authServerMocks.getCookieConfig.mockReturnValue({
      csrfToken: { name: 'csrfToken', options: {} },
      doubleCSRFToken: { name: 'doubleCSRFToken', options: {} },
      pkceCodeVerifier: { name: 'pkceCodeVerifier', options: {} },
      nonce: { name: 'nonce', options: {} },
      linkIdentity: { name: 'linkIdentity', options: {} },
      returnUrl: { name: 'returnUrl', options: {} },
      rememberDevice: { name: 'rememberDevice', options: {} },
      redirectUrl: { name: 'redirectUrl', options: {} },
      teamInviteState: { name: 'teamInviteState', options: {} },
    } as never);
    authServerMocks.getProviders.mockReturnValue({
      credentials: { type: 'credentials', provider: 'credentials' },
    } as never);
    authServerMocks.generateRandomCode.mockReturnValue('123456');
    authServerMocks.ensureAuthError.mockImplementation((error: unknown) => error);
    authServerMocks.getApiAddressFromReq.mockReturnValue('127.0.0.1');
    authServerMocks.validateRedirectUrl.mockImplementation((url: string) => url || 'https://client.test');
    emailMocks.sendEmailVerification.mockResolvedValue(undefined);
    emailMocks.sendVerificationCode.mockResolvedValue(undefined);
  });

  describe('register callback', () => {
    it('does not send a verification email for a placeholder (already-registered email) session', async () => {
      authServerMocks.handleSignInOrRegistration.mockResolvedValue({
        user: {
          id: authServerMocks.PLACEHOLDER_USER_ID,
          email: 'existing@example.com',
          userId: 'invalid|existing@example.com',
          name: 'Invalid User',
          emailVerified: false,
          authFactors: [],
          teamMembership: null,
          tosAcceptedVersion: 'invalid',
        },
        sessionDetails: { isTemporary: true },
        isNewUser: false,
        providerType: 'credentials',
        provider: 'credentials',
        mfaEnrollmentRequired: false,
        teamInviteResponse: null,
        verificationRequired: { email: true, twoFactor: [] },
      });
      authServerMocks.initSession.mockImplementation(async (req: any, sessionData: any) => {
        req.session.user = sessionData.user;
        req.session.sessionDetails = sessionData.sessionDetails;
        req.session.pendingVerification = [{ type: 'email', exp: Date.now() + 60_000, token: '123456' }];
      });

      const req = makeReq({
        body: {
          action: 'register',
          csrfToken: 'csrf-token',
          email: 'existing@example.com',
          name: 'Test User',
          password: VALID_PASSWORD,
          tosVersion: 'v1',
        },
      });
      const res = makeRes();
      const next = vi.fn();

      const handler = routeDefinition.callback.controllerFn();
      await handler(req as never, res as never, next);

      expect(next).not.toHaveBeenCalled();
      expect(authServerMocks.handleSignInOrRegistration).toHaveBeenCalledTimes(1);
      expect(authServerMocks.initSession).toHaveBeenCalledTimes(1);
      expect(emailMocks.sendEmailVerification).not.toHaveBeenCalled();
      expect(emailMocks.sendVerificationCode).not.toHaveBeenCalled();
    });

    it('does not send a 2fa-email verification code for a placeholder session', async () => {
      authServerMocks.handleSignInOrRegistration.mockResolvedValue({
        user: {
          id: authServerMocks.PLACEHOLDER_USER_ID,
          email: 'existing@example.com',
          userId: 'invalid|existing@example.com',
          name: 'Invalid User',
          emailVerified: false,
          authFactors: [],
          teamMembership: null,
          tosAcceptedVersion: 'invalid',
        },
        sessionDetails: { isTemporary: true },
        isNewUser: false,
        providerType: 'credentials',
        provider: 'credentials',
        mfaEnrollmentRequired: false,
        teamInviteResponse: null,
        verificationRequired: { email: true, twoFactor: [] },
      });
      authServerMocks.initSession.mockImplementation(async (req: any, sessionData: any) => {
        req.session.user = sessionData.user;
        req.session.sessionDetails = sessionData.sessionDetails;
        req.session.pendingVerification = [{ type: '2fa-email', exp: Date.now() + 60_000, token: '123456' }];
      });

      const req = makeReq({
        body: {
          action: 'register',
          csrfToken: 'csrf-token',
          email: 'existing@example.com',
          name: 'Test User',
          password: VALID_PASSWORD,
          tosVersion: 'v1',
        },
      });
      const res = makeRes();
      const next = vi.fn();

      const handler = routeDefinition.callback.controllerFn();
      await handler(req as never, res as never, next);

      expect(next).not.toHaveBeenCalled();
      expect(emailMocks.sendEmailVerification).not.toHaveBeenCalled();
      expect(emailMocks.sendVerificationCode).not.toHaveBeenCalled();
    });

    it('sends a verification email for a legitimate new-user registration', async () => {
      authServerMocks.handleSignInOrRegistration.mockResolvedValue({
        user: {
          id: 'real-user-id',
          email: 'new@example.com',
          userId: 'userid|real-user-id',
          name: 'Real User',
          emailVerified: false,
          authFactors: [],
          teamMembership: null,
          tosAcceptedVersion: 'v1',
        },
        sessionDetails: undefined,
        isNewUser: true,
        providerType: 'credentials',
        provider: 'credentials',
        mfaEnrollmentRequired: false,
        teamInviteResponse: null,
        verificationRequired: { email: true, twoFactor: [] },
      });
      authServerMocks.initSession.mockImplementation(async (req: any, sessionData: any) => {
        req.session.user = sessionData.user;
        req.session.sessionDetails = sessionData.sessionDetails;
        req.session.pendingVerification = [{ type: 'email', exp: Date.now() + 60_000, token: '123456' }];
      });

      const req = makeReq({
        body: {
          action: 'register',
          csrfToken: 'csrf-token',
          email: 'new@example.com',
          name: 'New User',
          password: VALID_PASSWORD,
          tosVersion: 'v1',
        },
      });
      const res = makeRes();
      const next = vi.fn();

      const handler = routeDefinition.callback.controllerFn();
      await handler(req as never, res as never, next);

      expect(next).not.toHaveBeenCalled();
      expect(emailMocks.sendEmailVerification).toHaveBeenCalledTimes(1);
      expect(emailMocks.sendEmailVerification).toHaveBeenCalledWith('new@example.com', '123456', expect.any(Number));
    });

    it('sends a 2fa-email verification code for a legitimate new-user registration', async () => {
      authServerMocks.handleSignInOrRegistration.mockResolvedValue({
        user: {
          id: 'real-user-id',
          email: 'new@example.com',
          userId: 'userid|real-user-id',
          name: 'Real User',
          emailVerified: false,
          authFactors: [],
          teamMembership: null,
          tosAcceptedVersion: 'v1',
        },
        sessionDetails: undefined,
        isNewUser: true,
        providerType: 'credentials',
        provider: 'credentials',
        mfaEnrollmentRequired: false,
        teamInviteResponse: null,
        verificationRequired: { email: true, twoFactor: [] },
      });
      authServerMocks.initSession.mockImplementation(async (req: any, sessionData: any) => {
        req.session.user = sessionData.user;
        req.session.sessionDetails = sessionData.sessionDetails;
        req.session.pendingVerification = [{ type: '2fa-email', exp: Date.now() + 60_000, token: '123456' }];
      });

      const req = makeReq({
        body: {
          action: 'register',
          csrfToken: 'csrf-token',
          email: 'new@example.com',
          name: 'New User',
          password: VALID_PASSWORD,
          tosVersion: 'v1',
        },
      });
      const res = makeRes();
      const next = vi.fn();

      const handler = routeDefinition.callback.controllerFn();
      await handler(req as never, res as never, next);

      expect(next).not.toHaveBeenCalled();
      expect(emailMocks.sendVerificationCode).toHaveBeenCalledTimes(1);
      expect(emailMocks.sendVerificationCode).toHaveBeenCalledWith('new@example.com', '123456', expect.any(Number));
    });
  });

  describe('resendVerification', () => {
    it('does not re-send a verification email for a placeholder session', async () => {
      const req = makeReq({
        body: { csrfToken: 'csrf-token', type: 'email' },
        session: {
          id: 'session-id',
          destroy: vi.fn(),
          save: vi.fn(),
          user: {
            id: authServerMocks.PLACEHOLDER_USER_ID,
            email: 'existing@example.com',
          },
          sessionDetails: { isTemporary: true },
          pendingVerification: [{ type: 'email', exp: Date.now() + 60_000, token: 'old-token' }],
        },
      });
      const res = makeRes();
      const next = vi.fn();

      const handler = routeDefinition.resendVerification.controllerFn();
      await handler(req as never, res as never, next);

      expect(next).not.toHaveBeenCalled();
      expect(emailMocks.sendEmailVerification).not.toHaveBeenCalled();
      expect(emailMocks.sendVerificationCode).not.toHaveBeenCalled();
    });

    it('does not re-send a 2fa-email verification code for a placeholder session', async () => {
      const req = makeReq({
        body: { csrfToken: 'csrf-token', type: '2fa-email' },
        session: {
          id: 'session-id',
          destroy: vi.fn(),
          save: vi.fn(),
          user: {
            id: authServerMocks.PLACEHOLDER_USER_ID,
            email: 'existing@example.com',
          },
          sessionDetails: { isTemporary: true },
          pendingVerification: [{ type: '2fa-email', exp: Date.now() + 60_000, token: 'old-token' }],
        },
      });
      const res = makeRes();
      const next = vi.fn();

      const handler = routeDefinition.resendVerification.controllerFn();
      await handler(req as never, res as never, next);

      expect(next).not.toHaveBeenCalled();
      expect(emailMocks.sendEmailVerification).not.toHaveBeenCalled();
      expect(emailMocks.sendVerificationCode).not.toHaveBeenCalled();
    });

    it('re-sends a verification email for a real user session', async () => {
      const req = makeReq({
        body: { csrfToken: 'csrf-token', type: 'email' },
        session: {
          id: 'session-id',
          destroy: vi.fn(),
          save: vi.fn(),
          user: {
            id: 'real-user-id',
            email: 'real@example.com',
          },
          sessionDetails: undefined,
          pendingVerification: [{ type: 'email', exp: Date.now() + 60_000, token: 'old-token' }],
        },
      });
      const res = makeRes();
      const next = vi.fn();

      const handler = routeDefinition.resendVerification.controllerFn();
      await handler(req as never, res as never, next);

      expect(next).not.toHaveBeenCalled();
      expect(emailMocks.sendEmailVerification).toHaveBeenCalledTimes(1);
      expect(emailMocks.sendEmailVerification).toHaveBeenCalledWith('real@example.com', '123456', expect.any(Number));
    });

    it('re-sends a 2fa-email verification code for a real user session', async () => {
      const req = makeReq({
        body: { csrfToken: 'csrf-token', type: '2fa-email' },
        session: {
          id: 'session-id',
          destroy: vi.fn(),
          save: vi.fn(),
          user: {
            id: 'real-user-id',
            email: 'real@example.com',
          },
          sessionDetails: undefined,
          pendingVerification: [{ type: '2fa-email', exp: Date.now() + 60_000, token: 'old-token' }],
        },
      });
      const res = makeRes();
      const next = vi.fn();

      const handler = routeDefinition.resendVerification.controllerFn();
      await handler(req as never, res as never, next);

      expect(next).not.toHaveBeenCalled();
      expect(emailMocks.sendVerificationCode).toHaveBeenCalledTimes(1);
      expect(emailMocks.sendVerificationCode).toHaveBeenCalledWith('real@example.com', '123456', expect.any(Number));
    });
  });
});
