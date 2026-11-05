import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createOrUpdateOtpAuthFactor, handleSignInOrRegistration } from '../auth.db.service';
import { InvalidAction } from '../auth.errors';

/**
 * A team's allowedMfaMethods is enforced on the server for every path that can add or honour a
 * factor, not only the enable/disable toggle: enrolling an authenticator, and the password/OAuth
 * login path that turns enabled factors into the second-factor prompt.
 */

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
  authFactors: {
    findMany: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
  authIdentity: {
    create: vi.fn(),
  },
  rememberedDevice: {
    findFirst: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock('@jetstream/api-config', () => ({
  ENV: { JETSTREAM_AUTH_2FA_EMAIL_DEFAULT_VALUE: false, JETSTREAM_AUTH_OTP_SECRET: Buffer.alloc(32, 1).toString('base64') },
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  prisma: prismaMock,
  DbCacheProvider: class {
    static cleanupExpired = vi.fn();
    consumeOnceAsync = vi.fn();
  },
}));

const TEAM_ID = 'team-1';
const USER_ID = 'user-1';
const EMAIL = 'member@example.com';
const LOGIN_CONFIG_ID = '11111111-1111-4111-8111-111111111111';

const providerUser = {
  id: 'google-identity',
  email: EMAIL,
  emailVerified: true,
  username: 'member',
  name: 'Member',
  givenName: null,
  familyName: null,
  picture: null,
};

function makeMember(authFactors: { type: string; enabled: boolean }[]) {
  return {
    id: USER_ID,
    name: 'Member',
    email: EMAIL,
    emailVerified: true,
    tosAcceptedVersion: null,
    authFactors,
    teamMembership: { teamId: TEAM_ID, role: 'MEMBER', status: 'ACTIVE' },
  };
}

function teamWithLoginConfig({ allowedMfaMethods, requireMfa = false }: { allowedMfaMethods: string[]; requireMfa?: boolean }) {
  return {
    loginConfig: {
      id: LOGIN_CONFIG_ID,
      allowedMfaMethods,
      allowedProviders: ['google', 'credentials'],
      requireMfa,
      allowIdentityLinking: true,
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

function signInWithGoogle() {
  return handleSignInOrRegistration({
    providerType: 'oauth',
    provider: 'google',
    providerUser,
    teamInvite: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.update.mockResolvedValue({});
  prismaMock.rememberedDevice.findFirst.mockResolvedValue(null);
  prismaMock.authFactors.findMany.mockResolvedValue([]);
  prismaMock.$transaction.mockResolvedValue([]);
});

describe('createOrUpdateOtpAuthFactor - team allowed MFA methods', () => {
  it('refuses to enroll an authenticator when the team does not allow it', async () => {
    prismaMock.team.findFirst.mockResolvedValue(teamWithLoginConfig({ allowedMfaMethods: ['email'] }));

    await expect(
      createOrUpdateOtpAuthFactor({ id: USER_ID, email: EMAIL, teamMembership: { teamId: TEAM_ID } as never }, 'secret'),
    ).rejects.toBeInstanceOf(InvalidAction);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('enrolls the authenticator when the team allows it', async () => {
    prismaMock.team.findFirst.mockResolvedValue(teamWithLoginConfig({ allowedMfaMethods: ['email', 'otp'] }));

    await createOrUpdateOtpAuthFactor({ id: USER_ID, email: EMAIL, teamMembership: { teamId: TEAM_ID } as never }, 'secret');

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it('enrolls the authenticator for a user without a team', async () => {
    await createOrUpdateOtpAuthFactor({ id: USER_ID, email: EMAIL, teamMembership: null }, 'secret');

    expect(prismaMock.team.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe('handleSignInOrRegistration - factors offered at login honour allowed MFA methods', () => {
  it('drops an enabled factor the team no longer allows', async () => {
    prismaMock.user.findFirst.mockResolvedValue(
      makeMember([
        { type: '2fa-email', enabled: true },
        { type: '2fa-otp', enabled: true },
      ]),
    );
    prismaMock.team.findFirst.mockResolvedValue(teamWithLoginConfig({ allowedMfaMethods: ['otp'], requireMfa: true }));

    const result = await signInWithGoogle();

    expect(result.verificationRequired.twoFactor.map(({ type }) => type)).toEqual(['2fa-otp']);
    expect(result.mfaEnrollmentRequired).toBe(false);
  });

  it('keeps every enabled factor when the team allows them all', async () => {
    prismaMock.user.findFirst.mockResolvedValue(
      makeMember([
        { type: '2fa-email', enabled: true },
        { type: '2fa-otp', enabled: true },
      ]),
    );
    prismaMock.team.findFirst.mockResolvedValue(teamWithLoginConfig({ allowedMfaMethods: ['email', 'otp'] }));

    const result = await signInWithGoogle();

    expect(result.verificationRequired.twoFactor.map(({ type }) => type)).toEqual(['2fa-otp', '2fa-email']);
  });

  it('forces authenticator enrollment when the only enabled factor is no longer allowed and MFA is required', async () => {
    prismaMock.user.findFirst.mockResolvedValue(makeMember([{ type: '2fa-email', enabled: true }]));
    prismaMock.team.findFirst.mockResolvedValue(teamWithLoginConfig({ allowedMfaMethods: ['otp'], requireMfa: true }));

    const result = await signInWithGoogle();

    expect(result.verificationRequired.twoFactor).toEqual([]);
    expect(result.mfaEnrollmentRequired).toEqual({ factor: '2fa-otp' });
  });
});
