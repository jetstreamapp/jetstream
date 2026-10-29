import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleSignInOrRegistration } from '../auth.db.service';
import { InactiveUser, LoginWithExistingIdentity } from '../auth.errors';

const prismaMock = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findFirstOrThrow: vi.fn(),
    update: vi.fn(),
  },
  team: {
    findFirst: vi.fn(),
  },
  authIdentity: {
    create: vi.fn(),
  },
  rememberedDevice: {
    findFirst: vi.fn(),
  },
}));

vi.mock('@jetstream/api-config', () => ({
  ENV: { JETSTREAM_AUTH_2FA_EMAIL_DEFAULT_VALUE: false },
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  prisma: prismaMock,
  DbCacheProvider: class {
    static cleanupExpired = vi.fn();
    consumeOnceAsync = vi.fn();
  },
}));

const TEAM_ID = 'team-1';
const USER_ID = 'user-1';
const EMAIL = 'ex-admin@example.com';
const LOGIN_CONFIG_ID = '11111111-1111-4111-8111-111111111111';

const providerUser = {
  id: 'google-new-identity',
  email: EMAIL,
  emailVerified: true,
  username: 'ex-admin',
  name: 'Ex Admin',
  givenName: null,
  familyName: null,
  picture: null,
};

/** An existing user who was an ADMIN of a team but whose membership is now INACTIVE (deactivated). */
function makeInactiveAdmin() {
  return {
    id: USER_ID,
    userId: `google|${providerUser.id}`,
    name: 'Ex Admin',
    email: EMAIL,
    emailVerified: true,
    tosAcceptedVersion: null,
    authFactors: [],
    teamMembership: { teamId: TEAM_ID, role: 'ADMIN', status: 'INACTIVE' },
  };
}

/** The team's login configuration, with identity linking enabled (required for the auto-link path). */
function teamWithLoginConfig({ allowIdentityLinking }: { allowIdentityLinking: boolean }) {
  return {
    loginConfig: {
      id: LOGIN_CONFIG_ID,
      allowedMfaMethods: ['email', 'otp'],
      allowedProviders: ['google', 'credentials'],
      requireMfa: false,
      allowIdentityLinking,
      autoAddToTeam: false,
      domains: [],
      ssoProvider: 'NONE',
      ssoEnabled: false,
      ssoJitProvisioningEnabled: false,
      ssoBypassEnabled: true,
      ssoBypassEnabledRoles: ['ADMIN'],
      ssoRequireMfa: false,
      samlConfiguration: null,
      oidcConfiguration: null,
      team: { id: TEAM_ID },
    },
  };
}

function signInWithGoogle({ emailVerified = true }: { emailVerified?: boolean } = {}) {
  return handleSignInOrRegistration({
    providerType: 'oauth',
    provider: 'google',
    providerUser: { ...providerUser, emailVerified },
    teamInvite: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.update.mockResolvedValue({});
  prismaMock.rememberedDevice.findFirst.mockResolvedValue(null);
  // After linking, addIdentityToUser reloads the user; return the same inactive-admin record.
  prismaMock.user.findFirstOrThrow.mockResolvedValue(makeInactiveAdmin());
  prismaMock.team.findFirst.mockResolvedValue(teamWithLoginConfig({ allowIdentityLinking: true }));
});

describe('inactive member on OAuth sign-in', () => {
  it('rejects an inactive member who signs in through an already-linked identity', async () => {
    // findUserByProviderId finds the existing (inactive) user for this provider id.
    prismaMock.user.findFirst.mockResolvedValue(makeInactiveAdmin());

    await expect(signInWithGoogle()).rejects.toBeInstanceOf(InactiveUser);
    // The guard fires before anything is linked.
    expect(prismaMock.authIdentity.create).not.toHaveBeenCalled();
  });

  it('rejects an inactive member who tries to sign in by auto-linking a new identity to their account', async () => {
    // No user for this NEW provider id -> findUserByProviderId returns null, so the first inactive
    // guard sees nobody. The email then matches exactly one existing (inactive) account, which is the
    // path the advisory abused. The auto-link branch must now reject before linking anything.
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.user.findMany.mockResolvedValue([makeInactiveAdmin()]);

    await expect(signInWithGoogle()).rejects.toBeInstanceOf(InactiveUser);
    // No identity is linked and no session is minted for the deactivated member.
    expect(prismaMock.authIdentity.create).not.toHaveBeenCalled();
  });

  it('does not reveal inactive membership when the provider email is unverified', async () => {
    // An attacker can put an unverified email on a provider identity they control (e.g. a user in their
    // own Salesforce org). The verified-email check must reject first with the same error every existing
    // account gets, so the response does not disclose that the address belongs to a deactivated member.
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.user.findMany.mockResolvedValue([makeInactiveAdmin()]);

    await expect(signInWithGoogle({ emailVerified: false })).rejects.toBeInstanceOf(LoginWithExistingIdentity);
    expect(prismaMock.authIdentity.create).not.toHaveBeenCalled();
  });
});
