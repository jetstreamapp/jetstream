import type { OauthProviderType, UserProfileSession } from '@jetstream/auth/types';
import { LoginConfigurationIdentityDisplayNames, LoginConfigurationMdaDisplayNames } from '@jetstream/types';
import { vi } from 'vitest';
import * as teamDbService from '../../db/team.db';
import { verifyTeamInvitation } from '../team.service';

vi.mock('../../db/team.db');
vi.mock('oauth4webapi');

vi.mock('@jetstream/auth/server', async () => {
  const actual = await vi.importActual('@jetstream/auth/server');
  return {
    ...actual,
    OauthClients: {
      getInstance: vi.fn(() =>
        Promise.resolve({
          google: { client: {}, authorizationServer: {} },
          salesforce: { client: {}, authorizationServer: {} },
        }),
      ),
    },
  };
});

const mockTeamDbService = teamDbService as unknown as {
  [K in keyof typeof teamDbService]: ReturnType<typeof vi.fn>;
};

vi.mock('@jetstream/shared/node-utils', () => ({
  encryptString: vi.fn(),
  decryptString: vi.fn(),
  hexToBase64: vi.fn((v) => v),
}));

vi.mock('@jetstream/api-config', () => ({
  ENV: {
    JWT_ENCRYPTION_KEY: 'test-jwt-key',
    SFDC_ENCRYPTION_KEY: 'test-master-key',
    SFDC_ENCRYPTION_CACHE_MAX_ENTRIES: 10000,
    SFDC_ENCRYPTION_CACHE_TTL_MS: 3600000,
    SFDC_ENCRYPTION_ITERATIONS: 10000,
    SFDC_CONSUMER_SECRET: 'legacy-secret',
  },
  logger: { error: vi.fn() },
  errorTracker: { error: vi.fn(), warn: vi.fn(), critical: vi.fn(), info: vi.fn() },
  DbCacheProvider: vi.fn().mockImplementation(function () {
    this.saveAsync = vi.fn().mockResolvedValue(null);
    this.getAsync = vi.fn().mockResolvedValue(null);
    this.removeAsync = vi.fn().mockResolvedValue(null);
  }),
}));

describe('verifyTeamInvitation', () => {
  const mockUserProfileSession: UserProfileSession = {
    id: 'user-id',
    name: 'Test User',
    email: 'test@example.com',
    emailVerified: true,
  } as UserProfileSession;

  const baseInvitation = {
    user: {
      id: 'user-id',
      email: 'test@example.com',
      hasPasswordSet: true,
      authFactors: [] as Array<{ type: string }>,
      identities: [] as Array<{ provider: string }>,
    },
    team: {
      id: 'team-id',
      name: 'Test Team',
      loginConfig: {
        requireMfa: false,
        allowedMfaMethods: ['otp', 'email'] as Array<'otp' | 'email'>,
        allowedProviders: ['credentials'] as Array<OauthProviderType | 'credentials'>,
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('happy path - all validations pass', () => {
    it('should return canEnroll=true when user meets all requirements', async () => {
      const invitation = {
        ...baseInvitation,
        user: {
          ...baseInvitation.user,
          hasPasswordSet: true,
          authFactors: [{ type: '2fa-otp' }],
          identities: [],
        },
      };

      mockTeamDbService.verifyTeamInvitation.mockResolvedValue(invitation as any);

      const result = await verifyTeamInvitation({
        user: mockUserProfileSession,
        currentSessionProvider: 'credentials',
        teamId: 'team-id',
        token: 'valid-token',
      });

      expect(result.canEnroll).toBe(true);
      expect(result.teamName).toBe('Test Team');
      expect(result.session.expireOnAcceptance).toBe(false);
      expect(result.mfa.isValid).toBe(true);
      expect(result.identityProvider.isValid).toBe(true);
      expect(result.linkedIdentities.isValid).toBe(true);
    });

    it('should handle OAuth provider successfully', async () => {
      const invitation = {
        ...baseInvitation,
        user: {
          ...baseInvitation.user,
          hasPasswordSet: false,
          identities: [{ provider: 'google' }],
        },
        team: {
          ...baseInvitation.team,
          loginConfig: {
            ...baseInvitation.team.loginConfig,
            allowedProviders: ['google'] as Array<OauthProviderType | 'credentials'>,
          },
        },
      };

      mockTeamDbService.verifyTeamInvitation.mockResolvedValue(invitation as any);

      const result = await verifyTeamInvitation({
        user: mockUserProfileSession,
        currentSessionProvider: 'google',
        teamId: 'team-id',
        token: 'valid-token',
      });

      expect(result.canEnroll).toBe(true);
      expect(result.identityProvider.isValid).toBe(true);
    });
  });

  describe('MFA validation', () => {
    it('should require enrollment when MFA is required but user has no auth factors', async () => {
      const invitation = {
        ...baseInvitation,
        user: {
          ...baseInvitation.user,
          authFactors: [],
        },
        team: {
          ...baseInvitation.team,
          loginConfig: {
            ...baseInvitation.team.loginConfig,
            requireMfa: true,
            allowedMfaMethods: ['otp', 'email'] as Array<'otp' | 'email'>,
          },
        },
      };

      mockTeamDbService.verifyTeamInvitation.mockResolvedValue(invitation as any);

      const result = await verifyTeamInvitation({
        user: mockUserProfileSession,
        currentSessionProvider: 'credentials',
        teamId: 'team-id',
        token: 'valid-token',
      });

      expect(result.canEnroll).toBe(false);
      expect(result.mfa.isValid).toBe(false);
      expect(result.mfa.action).toBe('ENROLL');
      expect(result.mfa.message).toContain('Before accepting this invitation, you must setup a valid MFA method');
      expect(result.mfa.message).toContain(LoginConfigurationMdaDisplayNames.otp);
      expect(result.mfa.message).toContain(LoginConfigurationMdaDisplayNames.email);
    });

    it('should require enrollment when user has MFA but not an allowed method', async () => {
      const invitation = {
        ...baseInvitation,
        user: {
          ...baseInvitation.user,
          authFactors: [{ type: '2fa-email' }],
        },
        team: {
          ...baseInvitation.team,
          loginConfig: {
            ...baseInvitation.team.loginConfig,
            requireMfa: true,
            allowedMfaMethods: ['otp'] as Array<'otp' | 'email'>,
          },
        },
      };

      mockTeamDbService.verifyTeamInvitation.mockResolvedValue(invitation as any);

      const result = await verifyTeamInvitation({
        user: mockUserProfileSession,
        currentSessionProvider: 'credentials',
        teamId: 'team-id',
        token: 'valid-token',
      });

      expect(result.canEnroll).toBe(false);
      expect(result.mfa.isValid).toBe(true);
      expect(result.mfa.action).toBe('ENROLL');
      expect(result.mfa.message).toContain('Before accepting this invitation, you must setup a valid MFA method');
      expect(result.mfa.message).toContain(LoginConfigurationMdaDisplayNames.otp);
    });

    it('should pass when user has allowed MFA method', async () => {
      const invitation = {
        ...baseInvitation,
        user: {
          ...baseInvitation.user,
          authFactors: [{ type: '2fa-otp' }],
        },
        team: {
          ...baseInvitation.team,
          loginConfig: {
            ...baseInvitation.team.loginConfig,
            requireMfa: true,
            allowedMfaMethods: ['otp', 'email'] as Array<'otp' | 'email'>,
          },
        },
      };

      mockTeamDbService.verifyTeamInvitation.mockResolvedValue(invitation as any);

      const result = await verifyTeamInvitation({
        user: mockUserProfileSession,
        currentSessionProvider: 'credentials',
        teamId: 'team-id',
        token: 'valid-token',
      });

      expect(result.canEnroll).toBe(true);
      expect(result.mfa.isValid).toBe(true);
      expect(result.mfa.action).toBe('NONE');
    });
  });

  describe('identity provider validation', () => {
    it('should require linking when user has no valid identity provider', async () => {
      const invitation = {
        ...baseInvitation,
        user: {
          ...baseInvitation.user,
          hasPasswordSet: false,
          identities: [{ provider: 'salesforce' }],
        },
        team: {
          ...baseInvitation.team,
          loginConfig: {
            ...baseInvitation.team.loginConfig,
            allowedProviders: ['google', 'credentials'] as Array<OauthProviderType | 'credentials'>,
          },
        },
      };

      mockTeamDbService.verifyTeamInvitation.mockResolvedValue(invitation as any);

      const result = await verifyTeamInvitation({
        user: mockUserProfileSession,
        currentSessionProvider: 'credentials',
        teamId: 'team-id',
        token: 'valid-token',
      });

      expect(result.canEnroll).toBe(false);
      expect(result.identityProvider.isValid).toBe(false);
      expect(result.identityProvider.action).toBe('LINK');
      expect(result.identityProvider.message).toContain("You don't have a valid login method configured");
      expect(result.identityProvider.message).toContain(LoginConfigurationIdentityDisplayNames.google);
      expect(result.identityProvider.message).toContain(LoginConfigurationIdentityDisplayNames.credentials);
    });

    it('should invalidate session when current provider is not allowed', async () => {
      const invitation = {
        ...baseInvitation,
        user: {
          ...baseInvitation.user,
          hasPasswordSet: true,
          identities: [{ provider: 'google' }],
        },
        team: {
          ...baseInvitation.team,
          loginConfig: {
            ...baseInvitation.team.loginConfig,
            allowedProviders: ['google'] as Array<OauthProviderType | 'credentials'>,
          },
        },
      };

      mockTeamDbService.verifyTeamInvitation.mockResolvedValue(invitation as any);

      const result = await verifyTeamInvitation({
        user: mockUserProfileSession,
        currentSessionProvider: 'credentials',
        teamId: 'team-id',
        token: 'valid-token',
      });

      expect(result.canEnroll).toBe(false);
      expect(result.session.expireOnAcceptance).toBe(true);
      expect(result.session.action).toBe('CURRENT_PROVIDER_INVALID');
      // The linked identities warning used to overwrite this instruction, leaving no hint to sign in with Google
      expect(result.session.message).toContain('You must be signed in with a different login method');
      expect(result.session.message).toContain(LoginConfigurationIdentityDisplayNames.google);
      expect(result.linkedIdentities.message).toContain(
        `you will no longer be able to login using: ${LoginConfigurationIdentityDisplayNames.credentials}.`,
      );
    });

    it('should add credentials provider when user has password set', async () => {
      const invitation = {
        ...baseInvitation,
        user: {
          ...baseInvitation.user,
          hasPasswordSet: true,
          identities: [],
        },
        team: {
          ...baseInvitation.team,
          loginConfig: {
            ...baseInvitation.team.loginConfig,
            allowedProviders: ['credentials'] as Array<OauthProviderType | 'credentials'>,
          },
        },
      };

      mockTeamDbService.verifyTeamInvitation.mockResolvedValue(invitation as any);

      const result = await verifyTeamInvitation({
        user: mockUserProfileSession,
        currentSessionProvider: 'credentials',
        teamId: 'team-id',
        token: 'valid-token',
      });

      expect(result.canEnroll).toBe(true);
      expect(result.identityProvider.isValid).toBe(true);
    });
  });

  describe('linked identities validation', () => {
    it('should warn when user has providers not allowed by team', async () => {
      const invitation = {
        ...baseInvitation,
        user: {
          ...baseInvitation.user,
          hasPasswordSet: true,
          identities: [{ provider: 'google' }, { provider: 'salesforce' }],
        },
        team: {
          ...baseInvitation.team,
          loginConfig: {
            ...baseInvitation.team.loginConfig,
            allowedProviders: ['credentials'] as Array<OauthProviderType | 'credentials'>,
          },
        },
      };

      mockTeamDbService.verifyTeamInvitation.mockResolvedValue(invitation as any);

      const result = await verifyTeamInvitation({
        user: mockUserProfileSession,
        currentSessionProvider: 'credentials',
        teamId: 'team-id',
        token: 'valid-token',
      });

      expect(result.canEnroll).toBe(true);
      expect(result.linkedIdentities.isValid).toBe(false);
      expect(result.linkedIdentities.message).toContain('You have linked identities that are not allowed on this team');
      // Names the methods the user loses, not the ones the team allows
      expect(result.linkedIdentities.message).toContain(
        `you will no longer be able to login using: ${LoginConfigurationIdentityDisplayNames.google}, ${LoginConfigurationIdentityDisplayNames.salesforce}.`,
      );
      expect(result.linkedIdentities.message).not.toContain(LoginConfigurationIdentityDisplayNames.credentials);
    });

    it('should pass when all linked identities are allowed', async () => {
      const invitation = {
        ...baseInvitation,
        user: {
          ...baseInvitation.user,
          hasPasswordSet: true,
          identities: [{ provider: 'google' }],
        },
        team: {
          ...baseInvitation.team,
          loginConfig: {
            ...baseInvitation.team.loginConfig,
            allowedProviders: ['credentials', 'google'] as Array<OauthProviderType | 'credentials'>,
          },
        },
      };

      mockTeamDbService.verifyTeamInvitation.mockResolvedValue(invitation as any);

      const result = await verifyTeamInvitation({
        user: mockUserProfileSession,
        currentSessionProvider: 'credentials',
        teamId: 'team-id',
        token: 'valid-token',
      });

      expect(result.canEnroll).toBe(true);
      expect(result.linkedIdentities.isValid).toBe(true);
    });
  });

  describe('SSO requirement', () => {
    /** The team requires SSO for MEMBERs, the invitee is a MEMBER on a verified domain signed in with a password */
    function buildSsoInvitation({
      role = 'MEMBER',
      ssoBypassEnabled = true,
      domains = ['example.com'],
      requireMfa = false,
    }: { role?: string; ssoBypassEnabled?: boolean; domains?: string[]; requireMfa?: boolean } = {}) {
      return {
        ...baseInvitation,
        role,
        team: {
          ...baseInvitation.team,
          loginConfig: {
            ...baseInvitation.team.loginConfig,
            requireMfa,
            ssoEnabled: true,
            ssoProvider: 'SAML',
            ssoBypassEnabled,
            ssoBypassEnabledRoles: ['ADMIN'],
            domains,
          },
        },
      };
    }

    function verifyWithPasswordSession() {
      return verifyTeamInvitation({
        user: mockUserProfileSession,
        currentSessionProvider: 'credentials',
        teamId: 'team-id',
        token: 'valid-token',
      });
    }

    it('refuses a password session and points to SSO when the invite role cannot bypass SSO', async () => {
      mockTeamDbService.verifyTeamInvitation.mockResolvedValue(buildSsoInvitation() as any);

      const result = await verifyWithPasswordSession();

      expect(result.canEnroll).toBe(false);
      expect(result.session.action).toBe('SSO_REQUIRED');
      expect(result.session.message).toContain('Continue with SSO');
    });

    it('refuses every role when SSO bypass is off', async () => {
      mockTeamDbService.verifyTeamInvitation.mockResolvedValue(buildSsoInvitation({ role: 'ADMIN', ssoBypassEnabled: false }) as any);

      const result = await verifyWithPasswordSession();

      expect(result.canEnroll).toBe(false);
      expect(result.session.action).toBe('SSO_REQUIRED');
    });

    it('sends the invitee to an admin when their email domain cannot sign in with SSO', async () => {
      mockTeamDbService.verifyTeamInvitation.mockResolvedValue(buildSsoInvitation({ domains: ['other.com'] }) as any);

      const result = await verifyWithPasswordSession();

      expect(result.canEnroll).toBe(false);
      expect(result.session.action).toBe('SSO_UNAVAILABLE');
      expect(result.session.message).toContain('Contact a team administrator');
    });

    it('does not ask for MFA enrollment when only SSO can get the invitee in', async () => {
      mockTeamDbService.verifyTeamInvitation.mockResolvedValue(buildSsoInvitation({ requireMfa: true }) as any);

      const result = await verifyWithPasswordSession();

      expect(result.mfa.message).toBeNull();
      expect(result.session.action).toBe('SSO_REQUIRED');
    });

    it('allows a password session when the invite role may bypass SSO', async () => {
      // Control for the refusals above - proves they come from the bypass rules and not from SSO being enabled
      mockTeamDbService.verifyTeamInvitation.mockResolvedValue(buildSsoInvitation({ role: 'ADMIN' }) as any);

      const result = await verifyWithPasswordSession();

      expect(result.canEnroll).toBe(true);
      expect(result.session.message).toBeNull();
    });
  });

  describe('complex scenarios', () => {
    it('should handle multiple validation failures', async () => {
      const invitation = {
        ...baseInvitation,
        user: {
          ...baseInvitation.user,
          hasPasswordSet: false,
          authFactors: [],
          identities: [{ provider: 'salesforce' }],
        },
        team: {
          ...baseInvitation.team,
          loginConfig: {
            requireMfa: true,
            allowedMfaMethods: ['otp'] as Array<'otp' | 'email'>,
            allowedProviders: ['google'] as Array<OauthProviderType | 'credentials'>,
          },
        },
      };

      mockTeamDbService.verifyTeamInvitation.mockResolvedValue(invitation as any);

      const result = await verifyTeamInvitation({
        user: mockUserProfileSession,
        currentSessionProvider: 'salesforce',
        teamId: 'team-id',
        token: 'valid-token',
      });

      expect(result.canEnroll).toBe(false);
      expect(result.mfa.isValid).toBe(false);
      expect(result.identityProvider.isValid).toBe(false);
    });

    it('should handle team with multiple allowed providers and methods', async () => {
      const invitation = {
        ...baseInvitation,
        user: {
          ...baseInvitation.user,
          hasPasswordSet: true,
          authFactors: [{ type: '2fa-email' }],
          identities: [{ provider: 'google' }],
        },
        team: {
          ...baseInvitation.team,
          loginConfig: {
            requireMfa: true,
            allowedMfaMethods: ['otp', 'email'] as Array<'otp' | 'email'>,
            allowedProviders: ['credentials', 'google', 'salesforce'] as Array<OauthProviderType | 'credentials'>,
          },
        },
      };

      mockTeamDbService.verifyTeamInvitation.mockResolvedValue(invitation as any);

      const result = await verifyTeamInvitation({
        user: mockUserProfileSession,
        currentSessionProvider: 'google',
        teamId: 'team-id',
        token: 'valid-token',
      });

      expect(result.canEnroll).toBe(true);
      expect(result.mfa.isValid).toBe(true);
      expect(result.identityProvider.isValid).toBe(true);
      expect(result.linkedIdentities.isValid).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty allowed methods and providers arrays', async () => {
      const invitation = {
        ...baseInvitation,
        user: {
          ...baseInvitation.user,
          hasPasswordSet: true,
          authFactors: [],
          identities: [],
        },
        team: {
          ...baseInvitation.team,
          loginConfig: {
            requireMfa: false,
            allowedMfaMethods: [] as Array<'otp' | 'email'>,
            allowedProviders: ['credentials'] as Array<OauthProviderType | 'credentials'>,
          },
        },
      };

      mockTeamDbService.verifyTeamInvitation.mockResolvedValue(invitation as any);

      const result = await verifyTeamInvitation({
        user: mockUserProfileSession,
        currentSessionProvider: 'credentials',
        teamId: 'team-id',
        token: 'valid-token',
      });

      expect(result.mfa.allowedMethods).toEqual([]);
      expect(result.canEnroll).toBe(true);
    });

    it('should properly parse auth factor types by removing 2fa- prefix', async () => {
      const invitation = {
        ...baseInvitation,
        user: {
          ...baseInvitation.user,
          authFactors: [{ type: '2fa-otp' }, { type: '2fa-email' }],
        },
        team: {
          ...baseInvitation.team,
          loginConfig: {
            requireMfa: true,
            allowedMfaMethods: ['otp', 'email'] as Array<'otp' | 'email'>,
            allowedProviders: ['credentials'] as Array<OauthProviderType | 'credentials'>,
          },
        },
      };

      mockTeamDbService.verifyTeamInvitation.mockResolvedValue(invitation as any);

      const result = await verifyTeamInvitation({
        user: mockUserProfileSession,
        currentSessionProvider: 'credentials',
        teamId: 'team-id',
        token: 'valid-token',
      });

      expect(result.canEnroll).toBe(true);
      expect(result.mfa.isValid).toBe(true);
    });
  });
});
