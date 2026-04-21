/**
 * Regression coverage for session revocation on identity unlink. When a user unlinks an
 * OAuth identity we must revoke sessions/tokens that were authenticated via that exact
 * (provider, providerAccountId) pair — so an attacker whose foothold is an OAuth-minted
 * session loses access. Sessions authenticated by other means (password, other providers,
 * or other accounts of the same provider) must remain intact. Identity removal and session
 * revocation happen atomically inside removeIdentityFromUser, so the controller only needs
 * to forward the current session id.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { routeDefinition } from '../user.controller';

const emailMocks = vi.hoisted(() => ({
  sendAuthenticationChangeConfirmation: vi.fn(),
  sendGoodbyeEmail: vi.fn(),
  sendInternalAccountDeletionEmail: vi.fn(),
  sendPasswordReset: vi.fn(),
}));

const authServerMocks = vi.hoisted(() => {
  class AuthError extends Error {
    type = 'auth_error';
  }
  class InvalidVerificationToken extends AuthError {}

  return {
    AuthError,
    InvalidVerificationToken,
    PASSWORD_RESET_DURATION_MINUTES: 30,
    clearOauthCookies: vi.fn(),
    convertBase32ToHex: vi.fn(),
    createOrUpdateOtpAuthFactor: vi.fn(),
    createUserActivityFromReq: vi.fn(),
    createUserActivityFromReqWithError: vi.fn(),
    deleteAuthFactor: vi.fn(),
    generate2faTotpUrl: vi.fn(),
    generatePasswordResetToken: vi.fn(),
    getAllSessions: vi.fn(),
    getApiAddressFromReq: vi.fn(() => '127.0.0.1'),
    getAuthorizationUrl: vi.fn(),
    getCookieConfig: vi.fn(() => ({})),
    getLoginConfiguration: vi.fn(),
    removeIdentityFromUser: vi.fn(),
    removePasswordFromUser: vi.fn(),
    revokeAllUserSessions: vi.fn(),
    revokeExternalSession: vi.fn(),
    revokeUserSession: vi.fn(),
    setPasswordForUser: vi.fn(),
    toggleEnableDisableAuthFactor: vi.fn(),
    verify2faTotpOrThrow: vi.fn(),
  };
});

const userDbMocks = vi.hoisted(() => ({
  findIdByUserIdUserFacing: vi.fn(),
  findUserWithIdentitiesById: vi.fn(),
  findByIdWithSubscriptions: vi.fn(),
  deleteUserAndAllRelatedData: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock('@jetstream/api-config', () => ({
  ENV: {
    JETSTREAM_SERVER_URL: 'https://server.test',
    JETSTREAM_CLIENT_URL: 'https://client.test',
    USE_SECURE_COOKIES: false,
    STRIPE_BILLING_PORTAL_LINK: 'https://billing.test',
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

vi.mock('../../db/user.db', () => userDbMocks);

vi.mock('../../db/salesforce-org.db', () => ({
  findByUniqueId_UNSAFE: vi.fn(),
  updateOrg_UNSAFE: vi.fn(),
}));

vi.mock('../../services/stripe.service', () => ({
  cancelAllSubscriptions: vi.fn(),
}));

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
    method: 'DELETE',
    headers: { cookie: '' },
    params: {},
    query: {},
    body: {},
    session: {
      id: 'current-session-id',
      user: { id: 'user-id', email: 'user@example.com' },
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

describe('user.controller - unlinkIdentity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authServerMocks.removeIdentityFromUser.mockResolvedValue(undefined);
    userDbMocks.findUserWithIdentitiesById.mockResolvedValue({
      id: 'user-id',
      email: 'user@example.com',
      identities: [],
    });
    emailMocks.sendAuthenticationChangeConfirmation.mockResolvedValue(undefined);
  });

  it('forwards the current session id so removeIdentityFromUser can revoke identity-scoped sessions atomically', async () => {
    const req = makeReq({
      query: { provider: 'google', providerAccountId: 'google-account-123' },
    });
    const res = makeRes();
    const next = vi.fn();

    const handler = routeDefinition.unlinkIdentity.controllerFn();
    await handler(req as never, res as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(authServerMocks.removeIdentityFromUser).toHaveBeenCalledTimes(1);
    expect(authServerMocks.removeIdentityFromUser).toHaveBeenCalledWith('user-id', 'google', 'google-account-123', 'current-session-id');
    // revokeAllUserSessions (the full-nuke variant) must NOT fire on identity unlink.
    expect(authServerMocks.revokeAllUserSessions).not.toHaveBeenCalled();
  });

  it('does not fetch or return the updated profile if identity removal fails', async () => {
    authServerMocks.removeIdentityFromUser.mockRejectedValue(new Error('tx failed'));

    const req = makeReq({
      query: { provider: 'salesforce', providerAccountId: 'sfdc-account-456' },
    });
    const res = makeRes();
    const next = vi.fn();

    const handler = routeDefinition.unlinkIdentity.controllerFn();
    await handler(req as never, res as never, next);

    expect(authServerMocks.removeIdentityFromUser).toHaveBeenCalledTimes(1);
    expect(userDbMocks.findUserWithIdentitiesById).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  it('forwards the exact providerAccountId from the request verbatim to the auth layer', async () => {
    const req = makeReq({
      query: { provider: 'google', providerAccountId: 'google-account-A' },
    });
    const res = makeRes();
    const next = vi.fn();

    const handler = routeDefinition.unlinkIdentity.controllerFn();
    await handler(req as never, res as never, next);

    expect(authServerMocks.removeIdentityFromUser).toHaveBeenCalledTimes(1);
    const [passedUserId, passedProvider, passedProviderAccountId] = authServerMocks.removeIdentityFromUser.mock.calls[0];
    expect(passedUserId).toBe('user-id');
    expect(passedProvider).toBe('google');
    expect(passedProviderAccountId).toBe('google-account-A');
  });
});
