import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMAIL_CHANGE_MIN_INTERVAL_HOURS, PASSWORD_RESET_EMAIL_CHANGE_COOLDOWN_HOURS } from '../auth.constants';
import { EmailChangeNotAllowed, InvalidOrExpiredEmailChangeToken } from '../auth.errors';
import { hashOpaqueToken } from '../auth.utils';
import {
  assertEmailChangeAllowedOrThrow,
  cancelEmailChangeByToken,
  completeEmailChange,
  createEmailChangeRequest,
  expirePendingEmailChangeRequests,
} from '../email-change.db.service';

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  authIdentity: { findFirst: vi.fn() },
  emailChangeRequest: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  passwordResetToken: { deleteMany: vi.fn() },
  blockedEmailDomain: { findMany: vi.fn() },
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
}));

const authDbMock = vi.hoisted(() => ({
  getLoginConfiguration: vi.fn(),
  revokeAllUserSessions: vi.fn(),
  withEmailAddressLock: vi.fn(),
}));

const authServiceMock = vi.hoisted(() => ({
  generateRandomString: vi.fn(() => 'a'.repeat(64)),
}));

vi.mock('@jetstream/api-config', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  prisma: prismaMock,
}));

vi.mock('@jetstream/prisma', () => ({ Prisma: {} }));
vi.mock('../auth.db.service', () => authDbMock);
vi.mock('../auth.service', () => authServiceMock);

const USER_ID = 'aaaaaaaa-0000-0000-0000-aaaaaaaaaaaa';
const OTHER_USER_ID = 'bbbbbbbb-0000-0000-0000-bbbbbbbbbbbb';
const CURRENT_EMAIL = 'current@example.com';
const NEW_EMAIL = 'new@example.com';
const CONFIRM_TOKEN = 'c'.repeat(64);
const REQUEST_ID = 'dddddddd-0000-0000-0000-dddddddddddd';

function pendingRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: REQUEST_ID,
    userId: USER_ID,
    status: 'PENDING',
    currentEmail: CURRENT_EMAIL,
    newEmail: NEW_EMAIL,
    confirmTokenHash: hashOpaqueToken(CONFIRM_TOKEN),
    cancelTokenHash: hashOpaqueToken('cancel'),
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(prismaMock));
  prismaMock.emailChangeRequest.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.emailChangeRequest.findFirst.mockResolvedValue(null);
  prismaMock.user.findFirst.mockResolvedValue(null);
  prismaMock.authIdentity.findFirst.mockResolvedValue(null);
  prismaMock.blockedEmailDomain.findMany.mockResolvedValue([]);
  authDbMock.getLoginConfiguration.mockResolvedValue(null);
});

describe('assertEmailChangeAllowedOrThrow', () => {
  function mockUser(overrides: Record<string, unknown> = {}) {
    prismaMock.user.findUniqueOrThrow.mockResolvedValue({
      email: CURRENT_EMAIL,
      passwordResetAt: null,
      teamMembership: null,
      ...overrides,
    });
  }

  it('should allow a change for a personal account', async () => {
    mockUser();
    await expect(assertEmailChangeAllowedOrThrow({ userId: USER_ID, newEmail: NEW_EMAIL })).resolves.toEqual({
      currentEmail: CURRENT_EMAIL,
      newEmail: NEW_EMAIL,
    });
  });

  it('should reject changing to the address already on the account', async () => {
    mockUser();
    await expect(assertEmailChangeAllowedOrThrow({ userId: USER_ID, newEmail: CURRENT_EMAIL.toUpperCase() })).rejects.toThrow(
      EmailChangeNotAllowed,
    );
  });

  it('should reject changing to a blocked (disposable) email domain', async () => {
    // Otherwise the registration-time block is trivially sidestepped: register with a real address,
    // then change to a burner.
    mockUser();
    prismaMock.blockedEmailDomain.findMany.mockResolvedValue([{ domain: 'burner.example', blocked: true }]);

    await expect(assertEmailChangeAllowedOrThrow({ userId: USER_ID, newEmail: 'someone@burner.example' })).rejects.toThrow(
      EmailChangeNotAllowed,
    );
  });

  it('should reject when the team is SSO managed', async () => {
    // The identity provider owns the address; a divergent User.email would desync the account and
    // leave a login path that survives IdP deprovisioning.
    mockUser({ teamMembership: { teamId: 'team-1' } });
    authDbMock.getLoginConfiguration.mockResolvedValue({ ssoEnabled: true, ssoProvider: 'SAML' });

    await expect(assertEmailChangeAllowedOrThrow({ userId: USER_ID, newEmail: NEW_EMAIL })).rejects.toThrow(EmailChangeNotAllowed);
  });

  it('should allow a team member whose team has SSO configured but disabled', async () => {
    mockUser({ teamMembership: { teamId: 'team-1' } });
    authDbMock.getLoginConfiguration.mockResolvedValue({ ssoEnabled: false, ssoProvider: 'SAML' });

    await expect(assertEmailChangeAllowedOrThrow({ userId: USER_ID, newEmail: NEW_EMAIL })).resolves.toBeTruthy();
  });

  it('should block within the cool-down after a password reset', async () => {
    // Closes compromised-mailbox -> reset password -> change email -> permanent takeover.
    mockUser({ passwordResetAt: new Date(Date.now() - (PASSWORD_RESET_EMAIL_CHANGE_COOLDOWN_HOURS - 1) * 60 * 60 * 1000) });

    await expect(assertEmailChangeAllowedOrThrow({ userId: USER_ID, newEmail: NEW_EMAIL })).rejects.toThrow(EmailChangeNotAllowed);
  });

  it('should allow once the password-reset cool-down has elapsed', async () => {
    mockUser({ passwordResetAt: new Date(Date.now() - (PASSWORD_RESET_EMAIL_CHANGE_COOLDOWN_HOURS + 1) * 60 * 60 * 1000) });

    await expect(assertEmailChangeAllowedOrThrow({ userId: USER_ID, newEmail: NEW_EMAIL })).resolves.toBeTruthy();
  });

  it('should enforce one completed change per interval', async () => {
    mockUser();
    prismaMock.emailChangeRequest.findFirst.mockResolvedValue({ resolvedAt: new Date() });

    await expect(assertEmailChangeAllowedOrThrow({ userId: USER_ID, newEmail: NEW_EMAIL })).rejects.toThrow(
      new RegExp(`once every ${EMAIL_CHANGE_MIN_INTERVAL_HOURS} hours`),
    );
  });
});

describe('createEmailChangeRequest', () => {
  beforeEach(() => {
    prismaMock.user.findUniqueOrThrow.mockResolvedValue({ email: CURRENT_EMAIL, passwordResetAt: null, teamMembership: null });
    prismaMock.emailChangeRequest.create.mockResolvedValue({ id: REQUEST_ID });
  });

  it('should store only hashes of the tokens it returns', async () => {
    const result = await createEmailChangeRequest({ userId: USER_ID, newEmail: NEW_EMAIL });

    expect(result).toBeTruthy();
    const [createArgs] = prismaMock.emailChangeRequest.create.mock.calls[0];
    const data = createArgs.data as Record<string, string>;

    expect(data.confirmTokenHash).toBe(hashOpaqueToken(result!.confirmToken));
    expect(data.cancelTokenHash).toBe(hashOpaqueToken(result!.cancelToken));
    // No column may hold the plaintext.
    expect(JSON.stringify(data)).not.toContain(result!.confirmToken);
    expect(JSON.stringify(data)).not.toContain(result!.cancelToken);
  });

  it('should supersede any earlier pending request rather than deleting it', async () => {
    // The table is the permanent history of every change - nothing is ever removed.
    await createEmailChangeRequest({ userId: USER_ID, newEmail: NEW_EMAIL });

    expect(prismaMock.emailChangeRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID, status: 'PENDING' },
        data: expect.objectContaining({ status: 'SUPERSEDED' }),
      }),
    );
  });

  /**
   * Without the user lock, two requests from one user for DIFFERENT addresses take different address
   * locks, so neither supersede sees the other's uncommitted row and both insert a PENDING row -
   * colliding on the "one pending request per user" partial unique index.
   */
  it('should take the user lock before the address lock, same as the confirm path', async () => {
    await createEmailChangeRequest({ userId: USER_ID, newEmail: NEW_EMAIL });

    // The user lock is a raw advisory lock; the address lock goes through the shared helper.
    expect(prismaMock.$executeRaw).toHaveBeenCalled();
    expect(authDbMock.withEmailAddressLock).toHaveBeenCalledWith(prismaMock, NEW_EMAIL);
    const userLockOrder = prismaMock.$executeRaw.mock.invocationCallOrder[0];
    const addressLockOrder = authDbMock.withEmailAddressLock.mock.invocationCallOrder[0];
    expect(userLockOrder).toBeLessThan(addressLockOrder);
  });

  it('should return null and record a FAILED row when the address is taken', async () => {
    // The caller responds exactly as on success, so the endpoint cannot be used to discover whether
    // an address is registered.
    prismaMock.user.findFirst.mockResolvedValue({ id: OTHER_USER_ID });

    const result = await createEmailChangeRequest({ userId: USER_ID, newEmail: NEW_EMAIL });

    expect(result).toBeNull();
    const [createArgs] = prismaMock.emailChangeRequest.create.mock.calls[0];
    expect(createArgs.data).toMatchObject({ status: 'FAILED', failureReason: 'EMAIL_IN_USE' });
  });

  it('should normalize the address before storing it', async () => {
    const result = await createEmailChangeRequest({ userId: USER_ID, newEmail: '  NEW@Example.COM  ' });
    expect(result?.newEmail).toBe(NEW_EMAIL);
  });
});

describe('completeEmailChange', () => {
  beforeEach(() => {
    prismaMock.user.findUniqueOrThrow.mockResolvedValue({ id: USER_ID, email: CURRENT_EMAIL, teamMembership: null });
  });

  function expectGenericRejection(promise: Promise<unknown>) {
    // Every rejection must be indistinguishable - the specific reason stays server-side.
    return expect(promise).rejects.toThrow(new InvalidOrExpiredEmailChangeToken('This link is invalid or has expired').message);
  }

  it('should apply the change and revoke sessions inside the transaction', async () => {
    prismaMock.emailChangeRequest.findUnique.mockResolvedValue(pendingRequest());

    const result = await completeEmailChange({ confirmToken: CONFIRM_TOKEN, resolvedVia: 'EMAIL_LINK' });

    expect(result).toMatchObject({ userId: USER_ID, oldEmail: CURRENT_EMAIL, newEmail: NEW_EMAIL });
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { email: NEW_EMAIL, emailVerified: true }, where: { id: USER_ID } }),
    );
    // Passed the transaction client so a partially-applied change cannot leave a live session.
    expect(authDbMock.revokeAllUserSessions).toHaveBeenCalledWith(USER_ID, undefined, prismaMock);
  });

  it('should delete outstanding reset tokens by userId, never by email', async () => {
    // PasswordResetToken is keyed by address; deleting by the old address would also destroy a
    // duplicate-email user's live token.
    prismaMock.emailChangeRequest.findUnique.mockResolvedValue(pendingRequest());

    await completeEmailChange({ confirmToken: CONFIRM_TOKEN, resolvedVia: 'EMAIL_LINK' });

    expect(prismaMock.passwordResetToken.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
  });

  it('should take the user lock before the address lock so concurrent confirms cannot deadlock', async () => {
    prismaMock.emailChangeRequest.findUnique.mockResolvedValue(pendingRequest());

    await completeEmailChange({ confirmToken: CONFIRM_TOKEN, resolvedVia: 'EMAIL_LINK' });

    // The user lock is a raw advisory lock; the address lock goes through the shared helper.
    expect(prismaMock.$executeRaw).toHaveBeenCalled();
    expect(authDbMock.withEmailAddressLock).toHaveBeenCalledWith(prismaMock, NEW_EMAIL);
    const userLockOrder = prismaMock.$executeRaw.mock.invocationCallOrder[0];
    const addressLockOrder = authDbMock.withEmailAddressLock.mock.invocationCallOrder[0];
    expect(userLockOrder).toBeLessThan(addressLockOrder);
  });

  it('should preserve the confirming session only when it belongs to the target user', async () => {
    prismaMock.emailChangeRequest.findUnique.mockResolvedValue(pendingRequest());

    await completeEmailChange({
      confirmToken: CONFIRM_TOKEN,
      resolvedVia: 'USER_PROFILE',
      currentSession: { id: 'session-1', userId: USER_ID },
    });

    expect(authDbMock.revokeAllUserSessions).toHaveBeenCalledWith(USER_ID, 'session-1', prismaMock);
  });

  it('should revoke everything when confirming while signed in as someone else', async () => {
    prismaMock.emailChangeRequest.findUnique.mockResolvedValue(pendingRequest());

    await completeEmailChange({
      confirmToken: CONFIRM_TOKEN,
      resolvedVia: 'USER_PROFILE',
      currentSession: { id: 'session-1', userId: OTHER_USER_ID },
    });

    expect(authDbMock.revokeAllUserSessions).toHaveBeenCalledWith(USER_ID, undefined, prismaMock);
  });

  it('should reject an unknown token', async () => {
    prismaMock.emailChangeRequest.findUnique.mockResolvedValue(null);
    await expectGenericRejection(completeEmailChange({ confirmToken: CONFIRM_TOKEN, resolvedVia: 'EMAIL_LINK' }));
  });

  it('should reject and mark EXPIRED once past the expiry', async () => {
    prismaMock.emailChangeRequest.findUnique.mockResolvedValue(pendingRequest({ expiresAt: new Date(Date.now() - 1) }));

    await expectGenericRejection(completeEmailChange({ confirmToken: CONFIRM_TOKEN, resolvedVia: 'EMAIL_LINK' }));

    expect(prismaMock.emailChangeRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'EXPIRED', failureReason: 'EXPIRED' }) }),
    );
  });

  it('should reject a token that was already used', async () => {
    prismaMock.emailChangeRequest.findUnique.mockResolvedValue(pendingRequest({ status: 'COMPLETED' }));
    await expectGenericRejection(completeEmailChange({ confirmToken: CONFIRM_TOKEN, resolvedVia: 'EMAIL_LINK' }));
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('should mark SUPERSEDED when the account address changed since the request', async () => {
    prismaMock.user.findUniqueOrThrow.mockResolvedValue({ id: USER_ID, email: 'someone-else@example.com', teamMembership: null });
    prismaMock.emailChangeRequest.findUnique.mockResolvedValue(pendingRequest());

    await expectGenericRejection(completeEmailChange({ confirmToken: CONFIRM_TOKEN, resolvedVia: 'EMAIL_LINK' }));

    expect(prismaMock.emailChangeRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SUPERSEDED', failureReason: 'STALE_CURRENT_EMAIL' }) }),
    );
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('should close the request-to-confirm race when the address was claimed in between', async () => {
    prismaMock.emailChangeRequest.findUnique.mockResolvedValue(pendingRequest());
    prismaMock.user.findFirst.mockResolvedValue({ id: OTHER_USER_ID });

    await expectGenericRejection(completeEmailChange({ confirmToken: CONFIRM_TOKEN, resolvedVia: 'EMAIL_LINK' }));

    expect(prismaMock.emailChangeRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED', failureReason: 'EMAIL_IN_USE' }) }),
    );
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('should re-check SSO policy at confirm time', async () => {
    // A team enabling SSO mid-flight must not be bypassable by sitting on a token issued earlier.
    prismaMock.user.findUniqueOrThrow.mockResolvedValue({ id: USER_ID, email: CURRENT_EMAIL, teamMembership: { teamId: 'team-1' } });
    prismaMock.emailChangeRequest.findUnique.mockResolvedValue(pendingRequest());
    authDbMock.getLoginConfiguration.mockResolvedValue({ ssoEnabled: true, ssoProvider: 'OIDC' });

    await expectGenericRejection(completeEmailChange({ confirmToken: CONFIRM_TOKEN, resolvedVia: 'EMAIL_LINK' }));

    expect(prismaMock.emailChangeRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED', failureReason: 'SSO_POLICY' }) }),
    );
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('should lose to a concurrent cancel', async () => {
    prismaMock.emailChangeRequest.findUnique.mockResolvedValue(pendingRequest());
    // The final status write matches nothing because the row is no longer PENDING.
    prismaMock.emailChangeRequest.updateMany.mockResolvedValue({ count: 0 });

    await expectGenericRejection(completeEmailChange({ confirmToken: CONFIRM_TOKEN, resolvedVia: 'EMAIL_LINK' }));
  });

  it('should only touch credentials identities, never oauth or sso ones', async () => {
    // oauth/sso identity emails are what the external provider asserted, and legacy SSO rows are
    // matched on providerAccountId - rewriting them would corrupt the profile for no benefit.
    prismaMock.emailChangeRequest.findUnique.mockResolvedValue(pendingRequest());

    await completeEmailChange({ confirmToken: CONFIRM_TOKEN, resolvedVia: 'EMAIL_LINK' });

    const identityUpdate = prismaMock.$executeRaw.mock.calls.find(([strings]) =>
      Array.isArray(strings) ? strings.join('').includes('AuthIdentity') : false,
    );
    expect(identityUpdate).toBeTruthy();
    expect((identityUpdate![0] as string[]).join('')).toContain("type = 'credentials'");
  });
});

describe('cancelEmailChangeByToken', () => {
  it('should cancel a pending request', async () => {
    prismaMock.emailChangeRequest.findFirst.mockResolvedValue({
      id: REQUEST_ID,
      userId: USER_ID,
      status: 'PENDING',
      currentEmail: CURRENT_EMAIL,
      newEmail: NEW_EMAIL,
    });

    const result = await cancelEmailChangeByToken({ cancelToken: 'cancel' });

    expect(result).toMatchObject({ userId: USER_ID, currentEmail: CURRENT_EMAIL, newEmail: NEW_EMAIL });
    expect(prismaMock.emailChangeRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELLED' }) }),
    );
  });

  it('should reject a request that is no longer pending', async () => {
    prismaMock.emailChangeRequest.findFirst.mockResolvedValue({ id: REQUEST_ID, userId: USER_ID, status: 'COMPLETED' });
    await expect(cancelEmailChangeByToken({ cancelToken: 'cancel' })).rejects.toThrow(InvalidOrExpiredEmailChangeToken);
  });
});

describe('expirePendingEmailChangeRequests', () => {
  it('should flip abandoned requests to EXPIRED without deleting them', async () => {
    prismaMock.emailChangeRequest.updateMany.mockResolvedValue({ count: 3 });

    await expect(expirePendingEmailChangeRequests()).resolves.toBe(3);

    expect(prismaMock.emailChangeRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'PENDING', expiresAt: { lt: expect.any(Date) } },
        data: expect.objectContaining({ status: 'EXPIRED', resolvedVia: 'EXPIRED_SWEEP' }),
      }),
    );
  });
});
