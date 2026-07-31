import { beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyPasswordForUserId } from '../auth.db.service';
import { AccountLocked, InvalidCredentials, PasswordResetRequired } from '../auth.errors';

/**
 * Locks in that step-up password verification is scoped by userId.
 *
 * User.email carries no unique constraint (production contains duplicates, and the sign-in paths
 * have explicit multi-match handling for them). The login helper resolves the account by email via
 * findFirst, which for a duplicated address returns an arbitrary row. Reusing it for step-up would
 * accept a different user's password as proof of identity AND charge that unrelated user's
 * failed-attempt counter, handing anyone sharing an email address a lockout weapon.
 */

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findFirstOrThrow: vi.fn(),
    update: vi.fn(),
  },
  authFactors: { findFirstOrThrow: vi.fn() },
  emailChangeRequest: { updateMany: vi.fn() },
  // recordFailedLoginAttempt wraps its read-modify-write; run the callback against the same mock.
  $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(prismaMock)),
}));

const authUtilsMock = vi.hoisted(() => ({
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
  timingSafeStringCompare: vi.fn(),
  checkUserAgentSimilarity: vi.fn(),
  hashOpaqueToken: vi.fn(),
  maskEmail: vi.fn(),
  REMEMBER_DEVICE_DAYS: 30,
}));

vi.mock('@jetstream/api-config', () => ({
  ENV: {},
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  prisma: prismaMock,
  DbCacheProvider: class {
    static cleanupExpired = vi.fn();
    consumeOnceAsync = vi.fn();
  },
}));

vi.mock('../auth.utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../auth.utils')>();
  return { ...actual, ...authUtilsMock };
});

const USER_A = 'aaaaaaaa-0000-0000-0000-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-0000-0000-0000-bbbbbbbbbbbb';
const SHARED_EMAIL = 'shared@example.com';

/**
 * verifyPasswordForUserId reads the user three times via findUnique, in order:
 * 1. its own {id, password} lookup, 2. isAccountLocked, 3. isPasswordResetRequired.
 * recordFailedLoginAttempt then reads a fourth time inside its transaction.
 */
function mockUserLookups({
  password,
  lockedUntil = null,
  forcePasswordReset = false,
}: {
  password: string | null;
  lockedUntil?: Date | null;
  forcePasswordReset?: boolean;
}) {
  prismaMock.user.findUnique
    .mockResolvedValueOnce({ id: USER_A, password })
    .mockResolvedValueOnce({ lockedUntil, failedLoginAttempts: 0 })
    .mockResolvedValueOnce({ forcePasswordReset, passwordResetReason: forcePasswordReset ? 'Admin initiated' : null })
    .mockResolvedValue({ failedLoginAttempts: 0, lockedUntil: null });
}

beforeEach(() => {
  vi.clearAllMocks();
  // clearAllMocks does not drain queued mockResolvedValueOnce values, and the early-return paths
  // below leave some unconsumed - they would otherwise surface as the first result in the next test.
  prismaMock.user.findUnique.mockReset();
  prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(prismaMock));
  prismaMock.user.update.mockResolvedValue({ failedLoginAttempts: 1 });
});

describe('verifyPasswordForUserId', () => {
  it('should resolve the account by id, not by email', async () => {
    mockUserLookups({ password: 'hash-for-a' });
    authUtilsMock.verifyPassword.mockResolvedValue(true);
    prismaMock.user.findFirstOrThrow.mockResolvedValue({
      id: USER_A,
      userId: 'jetstream|a',
      name: 'User A',
      email: SHARED_EMAIL,
      emailVerified: true,
      tosAcceptedVersion: null,
      authFactors: [],
      teamMembership: null,
    });

    await verifyPasswordForUserId(USER_A, 'password-a');

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: USER_A } }));
    // The email-keyed lookup used by the login path must not appear anywhere here.
    const emailLookups = prismaMock.user.findFirst.mock.calls.filter(([args]) => 'email' in ((args?.where as object) ?? {}));
    expect(emailLookups).toHaveLength(0);
  });

  it('should reject user B password when verifying against user A, even on a shared email', async () => {
    // Only user A's hash is ever loaded, so user B's password cannot match.
    mockUserLookups({ password: 'hash-for-a' });
    authUtilsMock.verifyPassword.mockResolvedValue(false);

    const { error } = await verifyPasswordForUserId(USER_A, 'password-belonging-to-b');

    expect(error).toBeInstanceOf(InvalidCredentials);
    expect(authUtilsMock.verifyPassword).toHaveBeenCalledWith('password-belonging-to-b', 'hash-for-a');
    // Failed-attempt accounting must land on A - the account actually being verified - never on B.
    const updateCalls = prismaMock.user.update.mock.calls;
    expect(updateCalls.length).toBeGreaterThan(0);
    updateCalls.forEach(([args]) => {
      expect((args?.where as { id: string }).id).toBe(USER_A);
      expect((args?.where as { id: string }).id).not.toBe(USER_B);
    });
  });

  it('should spend a constant-cost compare when the account has no password', async () => {
    // Keeps a passwordless account indistinguishable by response time from a wrong password.
    prismaMock.user.findUnique.mockResolvedValue({ id: USER_A, password: null });
    authUtilsMock.verifyPassword.mockResolvedValue(false);

    const { error } = await verifyPasswordForUserId(USER_A, 'anything');

    expect(error).toBeInstanceOf(InvalidCredentials);
    expect(authUtilsMock.verifyPassword).toHaveBeenCalledTimes(1);
  });

  it('should spend a constant-cost compare when the account does not exist', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    authUtilsMock.verifyPassword.mockResolvedValue(false);

    const { error } = await verifyPasswordForUserId(USER_A, 'anything');

    expect(error).toBeInstanceOf(InvalidCredentials);
    expect(authUtilsMock.verifyPassword).toHaveBeenCalledTimes(1);
  });

  it('should surface a locked account before doing any bcrypt work', async () => {
    mockUserLookups({ password: 'hash-for-a', lockedUntil: new Date(Date.now() + 60_000) });

    const { error } = await verifyPasswordForUserId(USER_A, 'password-a');

    expect(error).toBeInstanceOf(AccountLocked);
    expect(authUtilsMock.verifyPassword).not.toHaveBeenCalled();
  });

  it('should refuse when an admin has forced a password reset', async () => {
    mockUserLookups({ password: 'hash-for-a', forcePasswordReset: true });

    const { error } = await verifyPasswordForUserId(USER_A, 'password-a');

    expect(error).toBeInstanceOf(PasswordResetRequired);
    expect(authUtilsMock.verifyPassword).not.toHaveBeenCalled();
  });
});
