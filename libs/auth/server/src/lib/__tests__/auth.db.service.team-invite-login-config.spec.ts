import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CURRENT_TOS_VERSION } from '../auth.constants';
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
 *
 * Someone accepting an invite has no membership on the inviting team yet, so SSO bypass is judged
 * against the role they were invited with. That check has to run on every path that creates a user or
 * links an identity, and before it does so, or a refused invitee is left with a half-made account.
 */

const prismaMock = vi.hoisted(() => ({
  team: { findFirst: vi.fn() },
  loginConfiguration: { findFirst: vi.fn() },
  teamMemberInvitation: { findFirst: vi.fn(), delete: vi.fn() },
  teamMember: { create: vi.fn() },
  authIdentity: { create: vi.fn() },
  passwordHistory: { create: vi.fn() },
  user: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirstOrThrow: vi.fn(),
    update: vi.fn(),
  },
  // Accepting the invite passes an array of operations, the failed-login accounting and registration pass a callback
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
const TEAM_INVITE = { token: 'invite-token', teamId: TEAM_ID };

type TeamMembership = { teamId: string; role: string; status: string } | null;

const ADMIN_MEMBERSHIP: TeamMembership = { teamId: TEAM_ID, role: 'ADMIN', status: 'ACTIVE' };

type SsoBypassConfig = { ssoBypassEnabled: boolean; ssoBypassEnabledRoles: string[] };

/** The team requires SSO - only the bypass settings differ between tests */
function buildSsoRequiredLoginConfig(ssoBypassConfig: SsoBypassConfig) {
  return {
    id: 'cccccccc-0000-4000-8000-cccccccccccc',
    allowedMfaMethods: ['otp'],
    allowedProviders: ['credentials', 'google'],
    allowIdentityLinking: true,
    domains: [],
    autoAddToTeam: false,
    ssoProvider: 'SAML',
    ssoEnabled: true,
    ssoJitProvisioningEnabled: false,
    requireMfa: false,
    team: { id: TEAM_ID },
    ...ssoBypassConfig,
  };
}

/** The user is invited as a MEMBER */
function mockPendingInvite(ssoBypassConfig: SsoBypassConfig) {
  prismaMock.teamMemberInvitation.findFirst.mockResolvedValue({
    id: 'invite-id',
    email: EMAIL,
    role: 'MEMBER',
    features: [],
    createdById: 'inviter-id',
    team: { id: TEAM_ID, name: 'Acme', loginConfig: buildSsoRequiredLoginConfig(ssoBypassConfig) },
  });
}

function buildUser(teamMembership: TeamMembership) {
  return {
    id: USER_ID,
    userId: 'jetstream|invitee',
    name: 'Invitee',
    email: EMAIL,
    emailVerified: true,
    tosAcceptedVersion: null,
    authFactors: [],
    teamMembership,
  };
}

/** Signs the user in with a correct password, as an ADMIN of the inviting team unless told otherwise */
function mockSuccessfulPasswordLogin(teamMembership: TeamMembership = ADMIN_MEMBERSHIP) {
  prismaMock.user.findFirst.mockResolvedValue({ id: USER_ID, password: 'hashed-password' });
  prismaMock.user.findUnique
    .mockResolvedValueOnce({ lockedUntil: null, failedLoginAttempts: 0 })
    .mockResolvedValueOnce({ forcePasswordReset: false, passwordResetReason: null });
  authUtilsMock.verifyPassword.mockResolvedValue(true);
  prismaMock.user.findFirstOrThrow.mockResolvedValue(buildUser(teamMembership));
}

/** No account uses the invitee's email, so registration creates one */
function mockNewUser() {
  prismaMock.user.findFirst.mockResolvedValue(null);
  prismaMock.user.findMany.mockResolvedValue([]);
  prismaMock.user.create.mockResolvedValue(buildUser(null));
  prismaMock.user.update.mockResolvedValue(buildUser(null));
  prismaMock.user.findFirstOrThrow.mockResolvedValue(buildUser({ teamId: TEAM_ID, role: 'MEMBER', status: 'ACTIVE' }));
}

function signIn() {
  return handleSignInOrRegistration({
    providerType: 'credentials',
    action: 'login',
    email: EMAIL,
    password: 'correct-password',
    teamInvite: TEAM_INVITE,
  });
}

function register() {
  return handleSignInOrRegistration({
    providerType: 'credentials',
    action: 'register',
    email: EMAIL,
    name: 'Invitee',
    password: 'correct-password',
    tosVersion: CURRENT_TOS_VERSION,
    teamInvite: TEAM_INVITE,
  });
}

function signInWithGoogle(teamInvite: typeof TEAM_INVITE | null = TEAM_INVITE) {
  return handleSignInOrRegistration({
    providerType: 'oauth',
    provider: 'google',
    providerUser: {
      id: 'google-account-id',
      email: EMAIL,
      emailVerified: true,
      username: EMAIL,
      name: 'Invitee',
    },
    teamInvite,
  });
}

function expectNothingCreated() {
  expect(prismaMock.user.create).not.toHaveBeenCalled();
  expect(prismaMock.authIdentity.create).not.toHaveBeenCalled();
  expect(prismaMock.teamMember.create).not.toHaveBeenCalled();
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

describe('existing user without a team accepting an invite', () => {
  it('judges SSO bypass by the role they were invited with', async () => {
    mockPendingInvite({ ssoBypassEnabled: true, ssoBypassEnabledRoles: ['MEMBER'] });
    mockSuccessfulPasswordLogin(null);

    await expect(signIn()).resolves.toEqual(expect.objectContaining({ provider: 'credentials' }));
    expect(prismaMock.teamMember.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: 'MEMBER' }) }),
    );
  });

  it('rejects the login when the invite role is not one the team lets bypass SSO', async () => {
    mockPendingInvite({ ssoBypassEnabled: true, ssoBypassEnabledRoles: ['ADMIN'] });
    mockSuccessfulPasswordLogin(null);

    await expect(signIn()).rejects.toBeInstanceOf(SsoRequired);
    expect(prismaMock.teamMember.create).not.toHaveBeenCalled();
  });
});

describe('new user registering with a password from an invite', () => {
  it('refuses to create the account when the inviting team has turned SSO bypass off', async () => {
    mockPendingInvite({ ssoBypassEnabled: false, ssoBypassEnabledRoles: ['ADMIN', 'MEMBER'] });
    mockNewUser();

    await expect(register()).rejects.toBeInstanceOf(SsoRequired);
    expectNothingCreated();
  });

  it('refuses to create the account when the invite role is not one the team lets bypass SSO', async () => {
    mockPendingInvite({ ssoBypassEnabled: true, ssoBypassEnabledRoles: ['ADMIN'] });
    mockNewUser();

    await expect(register()).rejects.toBeInstanceOf(SsoRequired);
    expectNothingCreated();
  });

  it('creates the account and joins the team when the invite role may bypass SSO', async () => {
    mockPendingInvite({ ssoBypassEnabled: true, ssoBypassEnabledRoles: ['MEMBER'] });
    mockNewUser();

    await expect(register()).resolves.toEqual(expect.objectContaining({ isNewUser: true }));
    expect(prismaMock.user.create).toHaveBeenCalled();
    expect(prismaMock.teamMember.create).toHaveBeenCalled();
  });

  it("is not refused by the SSO requirement on their email domain when the invite comes from the domain's own team", async () => {
    mockPendingInvite({ ssoBypassEnabled: true, ssoBypassEnabledRoles: ['MEMBER'] });
    mockNewUser();
    prismaMock.loginConfiguration.findFirst.mockResolvedValue({
      ...buildSsoRequiredLoginConfig({ ssoBypassEnabled: true, ssoBypassEnabledRoles: ['MEMBER'] }),
      domains: ['example.com'],
      team: { id: TEAM_ID, name: 'Acme' },
    });

    await expect(register()).resolves.toEqual(expect.objectContaining({ isNewUser: true }));
    expect(prismaMock.user.create).toHaveBeenCalled();
  });
});

describe('new user signing up with an OAuth provider from an invite', () => {
  it('refuses to create the account when the inviting team has turned SSO bypass off', async () => {
    mockPendingInvite({ ssoBypassEnabled: false, ssoBypassEnabledRoles: ['ADMIN', 'MEMBER'] });
    mockNewUser();

    await expect(signInWithGoogle()).rejects.toBeInstanceOf(SsoRequired);
    expectNothingCreated();
  });

  it('refuses to create the account when the invite role is not one the team lets bypass SSO', async () => {
    mockPendingInvite({ ssoBypassEnabled: true, ssoBypassEnabledRoles: ['ADMIN'] });
    mockNewUser();

    await expect(signInWithGoogle()).rejects.toBeInstanceOf(SsoRequired);
    expectNothingCreated();
  });

  it('creates the account and joins the team when the invite role may bypass SSO', async () => {
    mockPendingInvite({ ssoBypassEnabled: true, ssoBypassEnabledRoles: ['MEMBER'] });
    mockNewUser();

    await expect(signInWithGoogle()).resolves.toEqual(expect.objectContaining({ isNewUser: true }));
    expect(prismaMock.user.create).toHaveBeenCalled();
    expect(prismaMock.teamMember.create).toHaveBeenCalled();
  });
});

describe('OAuth provider auto-linked to an existing user', () => {
  /** A password user with the same verified email signs in with Google for the first time */
  function mockExistingUserWithSameEmail(teamMembership: TeamMembership = null) {
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.user.findMany.mockResolvedValue([buildUser(teamMembership)]);
    prismaMock.user.findFirstOrThrow.mockResolvedValue(buildUser(teamMembership));
  }

  it('refuses to link the identity when the invite role is not one the team lets bypass SSO', async () => {
    mockPendingInvite({ ssoBypassEnabled: true, ssoBypassEnabledRoles: ['ADMIN'] });
    mockExistingUserWithSameEmail();

    await expect(signInWithGoogle()).rejects.toBeInstanceOf(SsoRequired);
    expectNothingCreated();
  });

  it('links the identity and joins the team when the invite role may bypass SSO', async () => {
    mockPendingInvite({ ssoBypassEnabled: true, ssoBypassEnabledRoles: ['MEMBER'] });
    mockExistingUserWithSameEmail();

    await expect(signInWithGoogle()).resolves.toEqual(expect.objectContaining({ isNewUser: false }));
    expect(prismaMock.authIdentity.create).toHaveBeenCalled();
    expect(prismaMock.teamMember.create).toHaveBeenCalled();
  });

  it('refuses to link the identity for a team member whose role cannot bypass SSO, without any invite', async () => {
    // Only sign ins with an already linked provider used to be checked, so a member's first sign in
    // with a new provider got past SSO
    prismaMock.team.findFirst.mockResolvedValue({
      loginConfig: buildSsoRequiredLoginConfig({ ssoBypassEnabled: true, ssoBypassEnabledRoles: ['MEMBER'] }),
    });
    mockExistingUserWithSameEmail(ADMIN_MEMBERSHIP);

    await expect(signInWithGoogle(null)).rejects.toBeInstanceOf(SsoRequired);
    expectNothingCreated();
  });
});
