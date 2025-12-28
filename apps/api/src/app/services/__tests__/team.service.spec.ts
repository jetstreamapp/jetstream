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
  rollbarServer: { error: vi.fn() },
  getExceptionLog: vi.fn((err) => ({ message: err.message })),
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
      expect(result.mfa.message).toContain("You don't have a valid login method configured");
      expect(result.mfa.message).toContain(LoginConfigurationIdentityDisplayNames.google);
      expect(result.mfa.message).toContain(LoginConfigurationIdentityDisplayNames.credentials);
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
      expect(result.session.message).toContain('You have linked identities that are not allowed on this team');
      expect(result.session.message).toContain(LoginConfigurationIdentityDisplayNames.google);
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
      expect(result.session.message).toContain('You have linked identities that are not allowed on this team');
      expect(result.session.message).toContain('you will no longer be able to login using');
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
