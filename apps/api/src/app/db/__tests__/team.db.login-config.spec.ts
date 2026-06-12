/**
 * Regression coverage for SSO-aware login configuration guards:
 * - An empty allowedProviders list is only valid when SSO is active (SSO counts as a login provider).
 * - SSO cannot be disabled or have its configuration deleted when it is the only allowed login provider,
 *   otherwise the entire team would be locked out.
 * - Session revocation treats active SSO sessions ('saml'/'oidc') as valid even though those providers
 *   are never part of allowedProviders.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as teamDb from '../team.db';

const prismaMock = vi.hoisted(() => ({
  team: {
    findFirstOrThrow: vi.fn(),
    findUnique: vi.fn(),
  },
  loginConfiguration: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  teamMember: {
    findMany: vi.fn(),
  },
  authIdentity: {
    deleteMany: vi.fn(),
  },
  samlConfiguration: {
    deleteMany: vi.fn(),
  },
  oidcConfiguration: {
    deleteMany: vi.fn(),
  },
  sessions: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock('@jetstream/api-config', () => ({
  ENV: {},
  getExceptionLog: (error: unknown) => ({ error: error instanceof Error ? error.message : error }),
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  prisma: prismaMock,
  DbCacheProvider: vi.fn().mockImplementation(function () {
    this.saveAsync = vi.fn().mockResolvedValue(null);
    this.getAsync = vi.fn().mockResolvedValue(null);
    this.removeAsync = vi.fn().mockResolvedValue(null);
    this.consumeOnceAsync = vi.fn().mockResolvedValue(true);
  }),
  rollbarServer: { error: vi.fn(), warn: vi.fn() },
}));

vi.mock('@jetstream/prisma', () => ({
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
}));

vi.mock('@jetstream/auth/server', () => ({
  clearLoginConfigurationCacheItem: vi.fn(),
  resolveSamlIdentifiers: vi.fn().mockReturnValue({ callbackUrls: {} }),
}));

const BASE_LOGIN_CONFIG_REQUEST = {
  requireMfa: false,
  ssoRequireMfa: false,
  allowedMfaMethods: ['otp', 'email'] as ('otp' | 'email')[],
  allowedProviders: [] as ('credentials' | 'google' | 'salesforce')[],
  allowIdentityLinking: true,
  autoAddToTeam: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('updateLoginConfiguration — empty allowedProviders guard', () => {
  function run(allowedProviders: ('credentials' | 'google' | 'salesforce')[]) {
    return teamDb.updateLoginConfiguration({
      teamId: 'team-id',
      runningUserId: 'admin-id',
      loginConfiguration: { ...BASE_LOGIN_CONFIG_REQUEST, allowedProviders },
    });
  }

  it('rejects an empty provider list when the team has no login configuration (no SSO possible)', async () => {
    prismaMock.team.findFirstOrThrow.mockResolvedValueOnce({ id: 'team-id', loginConfigId: null });

    await expect(run([])).rejects.toThrow('At least one login provider must be selected when SSO is not enabled.');
    expect(prismaMock.loginConfiguration.create).not.toHaveBeenCalled();
    expect(prismaMock.loginConfiguration.update).not.toHaveBeenCalled();
  });

  it('rejects an empty provider list when SSO is configured but not enabled', async () => {
    prismaMock.team.findFirstOrThrow.mockResolvedValueOnce({ id: 'team-id', loginConfigId: 'login-config-id' });
    prismaMock.loginConfiguration.findUnique.mockResolvedValueOnce({
      requireMfa: false,
      allowIdentityLinking: true,
      autoAddToTeam: false,
      allowedMfaMethods: ['otp', 'email'],
      allowedProviders: ['credentials'],
      ssoRequireMfa: false,
      ssoEnabled: false,
      ssoProvider: 'SAML',
    });

    await expect(run([])).rejects.toThrow('At least one login provider must be selected when SSO is not enabled.');
    expect(prismaMock.loginConfiguration.update).not.toHaveBeenCalled();
  });

  it('allows an empty provider list when SSO is enabled', async () => {
    prismaMock.team.findFirstOrThrow.mockResolvedValueOnce({ id: 'team-id', loginConfigId: 'login-config-id' });
    prismaMock.loginConfiguration.findUnique.mockResolvedValueOnce({
      requireMfa: false,
      allowIdentityLinking: true,
      autoAddToTeam: false,
      allowedMfaMethods: ['otp', 'email'],
      allowedProviders: ['credentials'],
      ssoRequireMfa: false,
      ssoEnabled: true,
      ssoProvider: 'SAML',
    });
    prismaMock.loginConfiguration.update.mockResolvedValueOnce({});
    // Halt execution after the update so the test does not need to mock the full team re-fetch
    prismaMock.team.findFirstOrThrow.mockRejectedValueOnce(new Error('stop-after-update'));

    await expect(run([])).rejects.toThrow('stop-after-update');
    expect(prismaMock.loginConfiguration.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ allowedProviders: [] }) }),
    );
  });

  it('allows a non-empty provider list without SSO', async () => {
    prismaMock.team.findFirstOrThrow.mockResolvedValueOnce({ id: 'team-id', loginConfigId: null });
    prismaMock.loginConfiguration.create.mockResolvedValueOnce({});
    prismaMock.team.findFirstOrThrow.mockRejectedValueOnce(new Error('stop-after-create'));

    await expect(run(['credentials'])).rejects.toThrow('stop-after-create');
    expect(prismaMock.loginConfiguration.create).toHaveBeenCalled();
  });
});

describe('updateSsoSettings — only-login-provider guard', () => {
  function mockTeam(allowedProviders: string[], ssoEnabled = true) {
    prismaMock.team.findUnique.mockResolvedValueOnce({
      loginConfigId: 'login-config-id',
      loginConfig: {
        ssoProvider: 'SAML',
        ssoEnabled,
        ssoJitProvisioningEnabled: false,
        ssoBypassEnabled: true,
        ssoBypassEnabledRoles: ['ADMIN'],
        ssoRequireMfa: false,
        allowedProviders,
        samlConfiguration: { id: 'saml-config-id' },
        oidcConfiguration: null,
      },
    });
  }

  function run(ssoEnabled: boolean) {
    return teamDb.updateSsoSettings('team-id', 'admin-id', {
      ssoEnabled,
      ssoJitProvisioningEnabled: false,
      ssoBypassEnabled: true,
      ssoBypassEnabledRoles: ['ADMIN'],
    });
  }

  it('rejects disabling SSO when it is the only allowed login provider', async () => {
    mockTeam([]);

    await expect(run(false)).rejects.toThrow(
      'Cannot disable SSO because it is the only allowed login provider. Enable another login provider first.',
    );
    expect(prismaMock.loginConfiguration.update).not.toHaveBeenCalled();
  });

  it('allows disabling SSO when another login provider is allowed', async () => {
    mockTeam(['credentials']);
    prismaMock.loginConfiguration.update.mockResolvedValueOnce({});
    // Halt execution after the update so the test does not need to mock getSsoConfiguration
    prismaMock.team.findUnique.mockRejectedValueOnce(new Error('stop-after-update'));

    await expect(run(false)).rejects.toThrow('stop-after-update');
    expect(prismaMock.loginConfiguration.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ssoEnabled: false }) }),
    );
  });
});

describe('deleteSamlConfiguration / deleteOidcConfiguration — only-login-provider guard', () => {
  it('rejects deleting the SAML configuration when SSO is the only allowed login provider', async () => {
    prismaMock.team.findUnique.mockResolvedValueOnce({
      loginConfigId: 'login-config-id',
      loginConfig: {
        ssoEnabled: true,
        allowedProviders: [],
        samlConfiguration: { id: 'saml-config-id', idpEntityId: 'entity-id', idpCertificateExpiresAt: null },
      },
    });

    await expect(teamDb.deleteSamlConfiguration('team-id', 'admin-id')).rejects.toThrow(
      'Cannot delete the SSO configuration because SSO is the only allowed login provider.',
    );
    expect(prismaMock.samlConfiguration.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects deleting the OIDC configuration when SSO is the only allowed login provider', async () => {
    prismaMock.team.findUnique.mockResolvedValueOnce({
      loginConfigId: 'login-config-id',
      loginConfig: {
        ssoEnabled: true,
        allowedProviders: [],
        oidcConfiguration: { id: 'oidc-config-id', issuer: 'https://example.com', clientId: 'client-id' },
      },
    });

    await expect(teamDb.deleteOidcConfiguration('team-id', 'admin-id')).rejects.toThrow(
      'Cannot delete the SSO configuration because SSO is the only allowed login provider.',
    );
    expect(prismaMock.oidcConfiguration.deleteMany).not.toHaveBeenCalled();
  });

  it('allows deleting the SAML configuration when SSO is not the only allowed login provider', async () => {
    prismaMock.team.findUnique.mockResolvedValueOnce({
      loginConfigId: 'login-config-id',
      loginConfig: {
        ssoEnabled: true,
        allowedProviders: ['credentials'],
        samlConfiguration: { id: 'saml-config-id', idpEntityId: 'entity-id', idpCertificateExpiresAt: null },
      },
    });
    prismaMock.teamMember.findMany.mockResolvedValueOnce([]);
    prismaMock.samlConfiguration.deleteMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.loginConfiguration.update.mockResolvedValueOnce({});

    const result = await teamDb.deleteSamlConfiguration('team-id', 'admin-id');

    expect(result.affectedIdentitiesCount).toBe(0);
    expect(prismaMock.samlConfiguration.deleteMany).toHaveBeenCalled();
    expect(prismaMock.loginConfiguration.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ssoProvider: 'NONE', ssoEnabled: false }) }),
    );
  });
});

describe('revokeSessionThatViolateLoginConfiguration — SSO session handling', () => {
  function mockTeam({
    allowedProviders,
    ssoEnabled,
    ssoProvider,
  }: {
    allowedProviders: string[];
    ssoEnabled: boolean;
    ssoProvider: 'NONE' | 'SAML' | 'OIDC';
  }) {
    prismaMock.team.findFirstOrThrow.mockResolvedValueOnce({
      loginConfig: {
        allowedMfaMethods: ['otp', 'email'],
        allowedProviders,
        requireMfa: false,
        ssoEnabled,
        ssoProvider,
      },
      members: [
        { userId: 'sso-user', user: { authFactors: [], identities: [] } },
        { userId: 'credentials-user', user: { authFactors: [], identities: [] } },
      ],
    });
  }

  function mockSessions() {
    prismaMock.sessions.findMany.mockResolvedValueOnce([
      { sid: 'saml-session', userId: 'sso-user', sess: { provider: 'saml' } },
      { sid: 'oidc-session', userId: 'sso-user', sess: { provider: 'oidc' } },
      { sid: 'credentials-session', userId: 'credentials-user', sess: { provider: 'credentials' } },
    ]);
    prismaMock.sessions.deleteMany.mockResolvedValueOnce({ count: 0 });
  }

  it('keeps sessions for the active SSO provider when allowedProviders is empty', async () => {
    mockTeam({ allowedProviders: [], ssoEnabled: true, ssoProvider: 'SAML' });
    mockSessions();

    const revokedCount = await teamDb.revokeSessionThatViolateLoginConfiguration({ teamId: 'team-id' });

    // Only the saml session survives - oidc is not the configured provider and credentials is not allowed
    expect(revokedCount).toBe(2);
    expect(prismaMock.sessions.deleteMany).toHaveBeenCalledWith({
      where: { sid: { in: expect.arrayContaining(['oidc-session', 'credentials-session']) } },
    });
  });

  it('revokes SSO sessions when SSO is not enabled', async () => {
    mockTeam({ allowedProviders: ['credentials'], ssoEnabled: false, ssoProvider: 'SAML' });
    mockSessions();

    const revokedCount = await teamDb.revokeSessionThatViolateLoginConfiguration({ teamId: 'team-id' });

    expect(revokedCount).toBe(2);
    expect(prismaMock.sessions.deleteMany).toHaveBeenCalledWith({
      where: { sid: { in: expect.arrayContaining(['saml-session', 'oidc-session']) } },
    });
  });

  it('keeps both SSO and allowed provider sessions when both are valid', async () => {
    mockTeam({ allowedProviders: ['credentials'], ssoEnabled: true, ssoProvider: 'SAML' });
    mockSessions();

    const revokedCount = await teamDb.revokeSessionThatViolateLoginConfiguration({ teamId: 'team-id' });

    expect(revokedCount).toBe(1);
    expect(prismaMock.sessions.deleteMany).toHaveBeenCalledWith({
      where: { sid: { in: ['oidc-session'] } },
    });
  });
});
