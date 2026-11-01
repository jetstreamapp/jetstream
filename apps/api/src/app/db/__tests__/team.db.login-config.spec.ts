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
  },
  loginConfiguration: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  authIdentity: {
    deleteMany: vi.fn(),
  },
  samlConfiguration: {
    delete: vi.fn(),
  },
  oidcConfiguration: {
    delete: vi.fn(),
  },
  sessions: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  $transaction: vi.fn(),
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
  notifySessionsRevoked: vi.fn(),
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
  prismaMock.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback(prismaMock));
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
    prismaMock.loginConfiguration.findUnique.mockResolvedValueOnce(null);

    await expect(run([])).rejects.toThrow('At least one login provider must be selected when SSO is not enabled.');
    expect(prismaMock.loginConfiguration.upsert).not.toHaveBeenCalled();
  });

  it('rejects an empty provider list when SSO is configured but not enabled', async () => {
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
    expect(prismaMock.loginConfiguration.upsert).not.toHaveBeenCalled();
  });

  it('allows an empty provider list when SSO is enabled', async () => {
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
    prismaMock.loginConfiguration.upsert.mockResolvedValueOnce({ id: 'login-config-id' });
    // Halt execution after the update so the test does not need to mock the full team re-fetch
    prismaMock.team.findFirstOrThrow.mockRejectedValueOnce(new Error('stop-after-update'));

    await expect(run([])).rejects.toThrow('stop-after-update');
    expect(prismaMock.loginConfiguration.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ allowedProviders: [] }) }),
    );
  });

  it('creates the login configuration when the team has none', async () => {
    prismaMock.loginConfiguration.findUnique.mockResolvedValueOnce(null);
    prismaMock.loginConfiguration.upsert.mockResolvedValueOnce({ id: 'login-config-id' });
    prismaMock.team.findFirstOrThrow.mockRejectedValueOnce(new Error('stop-after-upsert'));

    await expect(run(['credentials'])).rejects.toThrow('stop-after-upsert');
    expect(prismaMock.loginConfiguration.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { teamId: 'team-id' },
        create: expect.objectContaining({ teamId: 'team-id', allowedProviders: ['credentials'], createdById: 'admin-id' }),
      }),
    );
  });
});

describe('updateSsoSettings — only-login-provider guard', () => {
  function mockLoginConfig(allowedProviders: string[], ssoEnabled = true) {
    prismaMock.loginConfiguration.findUnique.mockResolvedValueOnce({
      id: 'login-config-id',
      ssoProvider: 'SAML',
      ssoEnabled,
      ssoJitProvisioningEnabled: false,
      ssoBypassEnabled: true,
      ssoBypassEnabledRoles: ['ADMIN'],
      ssoRequireMfa: false,
      allowedProviders,
      samlConfiguration: { id: 'saml-config-id' },
      oidcConfiguration: null,
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
    mockLoginConfig([]);

    await expect(run(false)).rejects.toThrow(
      'Cannot disable SSO because it is the only allowed login provider. Enable another login provider first.',
    );
    expect(prismaMock.loginConfiguration.update).not.toHaveBeenCalled();
  });

  it('allows disabling SSO when another login provider is allowed', async () => {
    mockLoginConfig(['credentials']);
    prismaMock.loginConfiguration.update.mockResolvedValueOnce({});
    // Halt execution after the update so the test does not need to mock getSsoConfiguration
    prismaMock.loginConfiguration.findUnique.mockRejectedValueOnce(new Error('stop-after-update'));

    await expect(run(false)).rejects.toThrow('stop-after-update');
    expect(prismaMock.loginConfiguration.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ssoEnabled: false }) }),
    );
  });
});

describe('deleteSamlConfiguration / deleteOidcConfiguration', () => {
  const SAML_CONFIG = { id: 'saml-config-id', idpEntityId: 'entity-id', idpCertificateExpiresAt: null };
  const OIDC_CONFIG = { id: 'oidc-config-id', issuer: 'https://example.com', clientId: 'client-id' };

  function mockLoginConfig({
    ssoProvider,
    ssoEnabled = true,
    allowedProviders = ['credentials'],
    samlConfiguration = SAML_CONFIG,
    oidcConfiguration = OIDC_CONFIG,
  }: {
    ssoProvider: 'NONE' | 'SAML' | 'OIDC';
    ssoEnabled?: boolean;
    allowedProviders?: string[];
    samlConfiguration?: typeof SAML_CONFIG | null;
    oidcConfiguration?: typeof OIDC_CONFIG | null;
  }) {
    prismaMock.loginConfiguration.findUnique.mockResolvedValueOnce({
      id: 'login-config-id',
      ssoEnabled,
      ssoProvider,
      allowedProviders,
      samlConfiguration,
      oidcConfiguration,
    });
  }

  it('rejects deleting the active SAML configuration when SSO is the only allowed login provider', async () => {
    mockLoginConfig({ ssoProvider: 'SAML', allowedProviders: [] });

    await expect(teamDb.deleteSamlConfiguration('team-id', 'admin-id')).rejects.toThrow(
      'Cannot delete the SSO configuration because SSO is the only allowed login provider.',
    );
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.authIdentity.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.samlConfiguration.delete).not.toHaveBeenCalled();
  });

  it('rejects deleting the active OIDC configuration when SSO is the only allowed login provider', async () => {
    mockLoginConfig({ ssoProvider: 'OIDC', allowedProviders: [] });

    await expect(teamDb.deleteOidcConfiguration('team-id', 'admin-id')).rejects.toThrow(
      'Cannot delete the SSO configuration because SSO is the only allowed login provider.',
    );
    expect(prismaMock.authIdentity.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.oidcConfiguration.delete).not.toHaveBeenCalled();
  });

  it('deletes the active SAML configuration, its identities, and resets the SSO provider inside a transaction', async () => {
    mockLoginConfig({ ssoProvider: 'SAML' });
    prismaMock.authIdentity.deleteMany.mockResolvedValueOnce({ count: 3 });
    prismaMock.samlConfiguration.delete.mockResolvedValueOnce({});
    prismaMock.loginConfiguration.update.mockResolvedValueOnce({});

    const result = await teamDb.deleteSamlConfiguration('team-id', 'admin-id');

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ deletedConfig: SAML_CONFIG, affectedIdentitiesCount: 3 });
    expect(prismaMock.authIdentity.deleteMany).toHaveBeenCalledWith({ where: { samlConfigurationId: 'saml-config-id' } });
    expect(prismaMock.samlConfiguration.delete).toHaveBeenCalledWith({ where: { id: 'saml-config-id' } });
    expect(prismaMock.loginConfiguration.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ssoProvider: 'NONE', ssoEnabled: false }) }),
    );
  });

  it('deletes the active OIDC configuration and scopes identity cleanup to that configuration', async () => {
    mockLoginConfig({ ssoProvider: 'OIDC' });
    prismaMock.authIdentity.deleteMany.mockResolvedValueOnce({ count: 2 });
    prismaMock.oidcConfiguration.delete.mockResolvedValueOnce({});
    prismaMock.loginConfiguration.update.mockResolvedValueOnce({});

    const result = await teamDb.deleteOidcConfiguration('team-id', 'admin-id');

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ deletedConfig: OIDC_CONFIG, affectedIdentitiesCount: 2 });
    expect(prismaMock.authIdentity.deleteMany).toHaveBeenCalledWith({ where: { oidcConfigurationId: 'oidc-config-id' } });
    expect(prismaMock.oidcConfiguration.delete).toHaveBeenCalledWith({ where: { id: 'oidc-config-id' } });
    expect(prismaMock.loginConfiguration.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ssoProvider: 'NONE', ssoEnabled: false }) }),
    );
  });

  it('deletes an inactive SAML configuration without changing the active OIDC provider', async () => {
    // allowedProviders is empty, but SAML is not the active provider so the lockout guard does not apply
    mockLoginConfig({ ssoProvider: 'OIDC', allowedProviders: [] });
    prismaMock.authIdentity.deleteMany.mockResolvedValueOnce({ count: 0 });
    prismaMock.samlConfiguration.delete.mockResolvedValueOnce({});

    const result = await teamDb.deleteSamlConfiguration('team-id', 'admin-id');

    expect(result.affectedIdentitiesCount).toBe(0);
    expect(prismaMock.authIdentity.deleteMany).toHaveBeenCalledWith({ where: { samlConfigurationId: 'saml-config-id' } });
    expect(prismaMock.samlConfiguration.delete).toHaveBeenCalledWith({ where: { id: 'saml-config-id' } });
    expect(prismaMock.loginConfiguration.update).not.toHaveBeenCalled();
  });

  it('deletes an inactive OIDC configuration without changing the active SAML provider', async () => {
    mockLoginConfig({ ssoProvider: 'SAML' });
    prismaMock.authIdentity.deleteMany.mockResolvedValueOnce({ count: 0 });
    prismaMock.oidcConfiguration.delete.mockResolvedValueOnce({});

    await teamDb.deleteOidcConfiguration('team-id', 'admin-id');

    expect(prismaMock.oidcConfiguration.delete).toHaveBeenCalledWith({ where: { id: 'oidc-config-id' } });
    expect(prismaMock.loginConfiguration.update).not.toHaveBeenCalled();
  });

  it('throws when there is no SAML configuration to delete and leaves the login configuration untouched', async () => {
    mockLoginConfig({ ssoProvider: 'NONE', ssoEnabled: false, samlConfiguration: null });

    await expect(teamDb.deleteSamlConfiguration('team-id', 'admin-id')).rejects.toThrow('SAML configuration not found');
    expect(prismaMock.authIdentity.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.samlConfiguration.delete).not.toHaveBeenCalled();
    expect(prismaMock.loginConfiguration.update).not.toHaveBeenCalled();
  });

  it('throws when there is no OIDC configuration to delete and leaves the login configuration untouched', async () => {
    mockLoginConfig({ ssoProvider: 'NONE', ssoEnabled: false, oidcConfiguration: null });

    await expect(teamDb.deleteOidcConfiguration('team-id', 'admin-id')).rejects.toThrow('OIDC configuration not found');
    expect(prismaMock.authIdentity.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.oidcConfiguration.delete).not.toHaveBeenCalled();
    expect(prismaMock.loginConfiguration.update).not.toHaveBeenCalled();
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
