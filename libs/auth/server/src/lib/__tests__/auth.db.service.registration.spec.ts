import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CURRENT_TOS_VERSION } from '../auth.constants';
import { handleSignInOrRegistration } from '../auth.db.service';
import { EmailDomainNotAllowed, SsoRequired } from '../auth.errors';

/**
 * Locks in the blocked-domain and SSO-domain rejections on credentials registration and, more
 * importantly, that both run BEFORE the "email already in use" branch.
 *
 * That branch deliberately returns a placeholder verification flow instead of an error so it cannot
 * be used to enumerate accounts. Rejecting either kind of domain after it would surface an error only
 * for addresses with no account, turning the pair of responses into exactly the oracle that branch
 * exists to avoid.
 */

const prismaMock = vi.hoisted(() => ({
  user: { findMany: vi.fn() },
  blockedEmailDomain: { findMany: vi.fn() },
  loginConfiguration: { findFirst: vi.fn() },
  teamMemberInvitation: { findFirst: vi.fn() },
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

const BLOCKED_EMAIL = 'someone@burner.example.com';
const ALLOWED_EMAIL = 'someone@company.example.com';
const SSO_DOMAIN_EMAIL = 'someone@sso.example.com';
const TEAM_ID = 'bbbbbbbb-0000-4000-8000-bbbbbbbbbbbb';
const OTHER_TEAM_ID = 'dddddddd-0000-4000-8000-dddddddddddd';

const EXISTING_USER = {
  id: 'aaaaaaaa-0000-0000-0000-aaaaaaaaaaaa',
  userId: 'credentials|aaaaaaaa-0000-0000-0000-aaaaaaaaaaaa',
  name: 'Existing User',
  emailVerified: true,
  tosAcceptedVersion: '1',
  authFactors: [],
  teamMembership: null,
};

/** A team that verified sso.example.com and turned SSO on */
const SSO_DOMAIN_LOGIN_CONFIGURATION = {
  id: 'cccccccc-0000-4000-8000-cccccccccccc',
  allowedMfaMethods: ['otp'],
  allowedProviders: ['credentials', 'google'],
  allowIdentityLinking: true,
  domains: ['sso.example.com'],
  ssoProvider: 'SAML',
  ssoEnabled: true,
  ssoJitProvisioningEnabled: true,
  ssoBypassEnabled: true,
  ssoBypassEnabledRoles: ['ADMIN'],
  requireMfa: false,
  team: { id: TEAM_ID, name: 'Acme' },
};

function registerPayload(email: string): Parameters<typeof handleSignInOrRegistration>[0] {
  return {
    providerType: 'credentials',
    action: 'register',
    email,
    name: 'Test User',
    password: 'a-very-long-password',
    tosVersion: CURRENT_TOS_VERSION,
    teamInvite: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.blockedEmailDomain.findMany.mockResolvedValue([]);
  prismaMock.loginConfiguration.findFirst.mockResolvedValue(null);
  prismaMock.user.findMany.mockResolvedValue([]);
});

describe('handleSignInOrRegistration - credentials register', () => {
  it('rejects a blocked domain before looking up existing accounts, so the response cannot reveal whether one exists', async () => {
    prismaMock.blockedEmailDomain.findMany.mockResolvedValue([{ domain: 'burner.example.com', blocked: true }]);

    await expect(handleSignInOrRegistration(registerPayload(BLOCKED_EMAIL))).rejects.toBeInstanceOf(EmailDomainNotAllowed);
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });

  it('allows a domain that is not blocked through to the existing-account check', async () => {
    prismaMock.user.findMany.mockResolvedValue([{ ...EXISTING_USER, email: ALLOWED_EMAIL }]);

    const result = await handleSignInOrRegistration(registerPayload(ALLOWED_EMAIL));

    expect(prismaMock.blockedEmailDomain.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.loginConfiguration.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ domains: { has: 'company.example.com' } }) }),
    );
    // The enumeration-safe branch: a placeholder user routed to email verification, not an error
    expect(result.isNewUser).toBe(false);
    expect(result.user.userId).toBe(`invalid|${ALLOWED_EMAIL}`);
    expect(result.verificationRequired.email).toBe(true);
  });

  describe('email domain with SSO turned on', () => {
    beforeEach(() => {
      prismaMock.loginConfiguration.findFirst.mockResolvedValue(SSO_DOMAIN_LOGIN_CONFIGURATION);
    });

    it('rejects an address with no account, directing them to SSO', async () => {
      await expect(handleSignInOrRegistration(registerPayload(SSO_DOMAIN_EMAIL))).rejects.toBeInstanceOf(SsoRequired);
      expect(prismaMock.user.findMany).not.toHaveBeenCalled();
    });

    it('rejects an address that already has an account the same way, before looking it up', async () => {
      prismaMock.user.findMany.mockResolvedValue([{ ...EXISTING_USER, email: SSO_DOMAIN_EMAIL }]);

      await expect(handleSignInOrRegistration(registerPayload(SSO_DOMAIN_EMAIL))).rejects.toBeInstanceOf(SsoRequired);
      expect(prismaMock.user.findMany).not.toHaveBeenCalled();
    });

    it("leaves a pending invite to be judged by the inviting team's login configuration", async () => {
      // Invited as an ADMIN, a role this team lets bypass SSO
      prismaMock.teamMemberInvitation.findFirst.mockResolvedValue({
        id: 'invite-id',
        email: SSO_DOMAIN_EMAIL,
        role: 'ADMIN',
        features: [],
        createdById: 'inviter-id',
        team: { id: TEAM_ID, name: 'Acme', loginConfig: SSO_DOMAIN_LOGIN_CONFIGURATION },
      });
      prismaMock.user.findMany.mockResolvedValue([{ ...EXISTING_USER, email: SSO_DOMAIN_EMAIL }]);

      const result = await handleSignInOrRegistration({
        ...registerPayload(SSO_DOMAIN_EMAIL),
        teamInvite: { token: 'invite-token', teamId: TEAM_ID },
      });

      expect(result.user.userId).toBe(`invalid|${SSO_DOMAIN_EMAIL}`);
    });

    it('rejects a pending invite from a different team, which cannot hand out password accounts on this domain', async () => {
      prismaMock.teamMemberInvitation.findFirst.mockResolvedValue({
        id: 'invite-id',
        email: SSO_DOMAIN_EMAIL,
        role: 'MEMBER',
        features: [],
        createdById: 'inviter-id',
        team: {
          id: OTHER_TEAM_ID,
          name: 'Consultants',
          loginConfig: { ...SSO_DOMAIN_LOGIN_CONFIGURATION, domains: [], ssoProvider: 'NONE', ssoEnabled: false },
        },
      });

      await expect(
        handleSignInOrRegistration({ ...registerPayload(SSO_DOMAIN_EMAIL), teamInvite: { token: 'invite-token', teamId: OTHER_TEAM_ID } }),
      ).rejects.toBeInstanceOf(SsoRequired);
      expect(prismaMock.user.findMany).not.toHaveBeenCalled();
    });
  });
});
