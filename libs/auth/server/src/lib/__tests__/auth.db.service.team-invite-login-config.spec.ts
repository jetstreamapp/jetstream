import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleSignInOrRegistration } from '../auth.db.service';
import { SsoRequired } from '../auth.errors';

/**
 * A pending team invite supplies the login configuration for the rest of sign in - the user's own
 * team configuration is never loaded once it is set, so the inviting team's settings are what decide
 * whether a password login is allowed past an SSO requirement.
 *
 * Anything the invite query leaves out of its Prisma select is silently replaced by a
 * LoginConfigurationSchema default, and for the SSO bypass fields those defaults (bypass enabled,
 * ADMIN only) are permissive enough to let someone past a gate their team had closed. A mocked
 * Prisma client returns whatever the test hands it regardless of the select, so that omission can
 * only be caught by asserting the query itself - hence the select assertion below.
 */

const prismaMock = vi.hoisted(() => ({
  teamMemberInvitation: { findFirst: vi.fn(), delete: vi.fn() },
  teamMember: { create: vi.fn() },
  user: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findFirstOrThrow: vi.fn(),
    update: vi.fn(),
  },
  // Accepting the invite passes an array of operations, the failed-login accounting passes a callback
  $transaction: vi.fn(async (operationsOrCallback: unknown[] | ((tx: unknown) => unknown)) =>
    Array.isArray(operationsOrCallback) ? Promise.all(operationsOrCallback) : operationsOrCallback(prismaMock),
  ),
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

const USER_ID = 'aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa';
const TEAM_ID = 'bbbbbbbb-0000-4000-8000-bbbbbbbbbbbb';
const EMAIL = 'invitee@example.com';

/** The inviting team requires SSO - only the bypass settings differ between tests */
function mockPendingInvite(loginConfig: { ssoBypassEnabled: boolean; ssoBypassEnabledRoles: string[] }) {
  prismaMock.teamMemberInvitation.findFirst.mockResolvedValue({
    id: 'invite-id',
    email: EMAIL,
    role: 'MEMBER',
    features: [],
    createdById: 'inviter-id',
    team: {
      id: TEAM_ID,
      name: 'Acme',
      loginConfig: {
        id: 'cccccccc-0000-4000-8000-cccccccccccc',
        allowedMfaMethods: ['otp'],
        allowedProviders: ['credentials'],
        allowIdentityLinking: true,
        domains: [],
        autoAddToTeam: false,
        ssoProvider: 'SAML',
        ssoEnabled: true,
        ssoJitProvisioningEnabled: false,
        requireMfa: false,
        team: { id: TEAM_ID },
        ...loginConfig,
      },
    },
  });
}

/** Signs the user in with a correct password, as an ADMIN of the team they already belong to */
function mockSuccessfulPasswordLogin() {
  prismaMock.user.findFirst.mockResolvedValue({ id: USER_ID, password: 'hashed-password' });
  prismaMock.user.findUnique
    .mockResolvedValueOnce({ lockedUntil: null, failedLoginAttempts: 0 })
    .mockResolvedValueOnce({ forcePasswordReset: false, passwordResetReason: null });
  authUtilsMock.verifyPassword.mockResolvedValue(true);
  prismaMock.user.findFirstOrThrow.mockResolvedValue({
    id: USER_ID,
    userId: 'jetstream|invitee',
    name: 'Invitee',
    email: EMAIL,
    emailVerified: true,
    tosAcceptedVersion: null,
    authFactors: [],
    teamMembership: { teamId: TEAM_ID, role: 'ADMIN', status: 'ACTIVE' },
  });
}

function signIn() {
  return handleSignInOrRegistration({
    providerType: 'credentials',
    action: 'login',
    email: EMAIL,
    password: 'correct-password',
    teamInvite: { token: 'invite-token', teamId: TEAM_ID },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.findUnique.mockReset();
  prismaMock.user.update.mockResolvedValue({ failedLoginAttempts: 0 });
  prismaMock.teamMemberInvitation.delete.mockResolvedValue({ id: 'invite-id' });
  prismaMock.teamMember.create.mockResolvedValue({ role: 'MEMBER', status: 'ACTIVE', teamId: TEAM_ID, userId: USER_ID });
});

describe('pending team invite login configuration', () => {
  it('asks for every field needed to evaluate SSO bypass', async () => {
    mockPendingInvite({ ssoBypassEnabled: true, ssoBypassEnabledRoles: ['ADMIN'] });
    mockSuccessfulPasswordLogin();

    await signIn();

    const [{ select }] = prismaMock.teamMemberInvitation.findFirst.mock.calls[0];
    expect(select.team.select.loginConfig.select).toEqual(expect.objectContaining({ ssoBypassEnabled: true, ssoBypassEnabledRoles: true }));
  });

  it('rejects the login when the inviting team has turned SSO bypass off', async () => {
    mockPendingInvite({ ssoBypassEnabled: false, ssoBypassEnabledRoles: ['ADMIN'] });
    mockSuccessfulPasswordLogin();

    await expect(signIn()).rejects.toBeInstanceOf(SsoRequired);
  });

  it('rejects the login when the user role is not one the inviting team lets bypass SSO', async () => {
    // The user is an ADMIN, which is exactly what the schema default would have allowed
    mockPendingInvite({ ssoBypassEnabled: true, ssoBypassEnabledRoles: ['MEMBER'] });
    mockSuccessfulPasswordLogin();

    await expect(signIn()).rejects.toBeInstanceOf(SsoRequired);
  });

  it('allows the login when the user role is one the inviting team lets bypass SSO', async () => {
    // Control for the two above - proves they fail on the bypass rules, not on SSO being enabled
    mockPendingInvite({ ssoBypassEnabled: true, ssoBypassEnabledRoles: ['ADMIN', 'MEMBER'] });
    mockSuccessfulPasswordLogin();

    await expect(signIn()).resolves.toEqual(expect.objectContaining({ provider: 'credentials' }));
  });
});
