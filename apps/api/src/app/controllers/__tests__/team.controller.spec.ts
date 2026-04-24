/**
 * Focused unit tests for the pure helpers exported from team.controller.ts.
 *
 * - maskSsoSecrets is called from four separate send-sites (GET + 3 write endpoints);
 *   locking its behavior here prevents a future refactor from silently un-masking a
 *   new secret-bearing field that gets added to the SAML/OIDC config shapes.
 * - fetchSamlMetadata is the most complex new defensive code in the branch — it
 *   follows redirects manually with a per-hop SSRF check. These tests lock in:
 *     (a) the first hop's host is validated,
 *     (b) each redirect target is validated before the next fetch,
 *     (c) redirects to private IPs are rejected,
 *     (d) the hop cap throws,
 *     (e) missing Location header throws,
 *     (f) a successful terminal response (2xx/4xx) is returned unchanged.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchSamlMetadata, maskSsoSecrets } from '../team.controller';

const assertDomainResolvesToPublicIpMock = vi.hoisted(() => vi.fn());

// Mock the transitive import chain of team.controller.ts down to the minimum needed
// to load the module. We are exercising maskSsoSecrets and fetchSamlMetadata — nothing
// else from the controller touches its DB/service layer. vitest hoists these vi.mock
// calls before the imports above at runtime, so the load-order is correct.
vi.mock('@jetstream/api-config', () => ({
  ENV: { JETSTREAM_SERVER_URL: 'https://server.test', USE_SECURE_COOKIES: true, JETSTREAM_SAML_ACS_PATH_PREFIX: '/api/auth/sso/saml' },
  getExceptionLog: (error: unknown) => ({ error: error instanceof Error ? error.message : error }),
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  prisma: {},
  rollbarServer: { error: vi.fn(), warn: vi.fn() },
}));
vi.mock('@jetstream/audit-logs', () => ({
  AuditLogAction: {},
  AuditLogResource: {},
  createTeamAuditLog: vi.fn(),
}));
vi.mock('@jetstream/auth/server', () => ({
  encryptSecret: vi.fn(),
  oidcService: { getDiscoveredConfigForSaving: vi.fn() },
  samlService: { parseIdpMetadata: vi.fn() },
  refreshSessionUser: vi.fn(),
  getCookieConfig: vi.fn(() => ({ redirectUrl: { name: 'rd', options: {} } })),
  getTeamUserSessions: vi.fn(),
  revokeTeamUserSession: vi.fn(),
  getTeamUserActivity: vi.fn(),
}));
vi.mock('@jetstream/auth/types', () => ({
  OidcConfigurationRequestSchema: { parse: vi.fn() },
  SamlConfigurationRequestSchema: { parse: vi.fn() },
}));
vi.mock('@jetstream/shared/node-utils', () => ({
  assertDomainResolvesToPublicIp: assertDomainResolvesToPublicIpMock,
}));
vi.mock('@jetstream/prisma', () => ({
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
}));
vi.mock('../../db/team.db', () => ({}));
vi.mock('../../services/team.service', () => ({}));
vi.mock('../../utils/response.handlers', () => ({ sendJson: vi.fn() }));

describe('maskSsoSecrets', () => {
  it('masks spPrivateKey on SAML configuration while preserving non-secret fields', () => {
    const input = {
      id: 'team-1',
      samlConfiguration: {
        id: 'saml-1',
        idpEntityId: 'https://idp.test',
        idpSsoUrl: 'https://idp.test/sso',
        idpCertificate: 'CERT-DATA',
        spPrivateKey: 'ENCRYPTED-PRIVATE-KEY',
        spCertificate: 'SP-CERT',
      },
    } as any;

    const output = maskSsoSecrets(input);

    expect(output.samlConfiguration?.spPrivateKey).toBeNull();
    expect(output.samlConfiguration?.idpEntityId).toBe('https://idp.test');
    expect(output.samlConfiguration?.idpCertificate).toBe('CERT-DATA');
    expect(output.samlConfiguration?.spCertificate).toBe('SP-CERT');
  });

  it('masks clientSecret on OIDC configuration while preserving non-secret fields', () => {
    const input = {
      oidcConfiguration: {
        id: 'oidc-1',
        issuer: 'https://issuer.test',
        clientId: 'client-abc',
        clientSecret: 'ENCRYPTED-CLIENT-SECRET',
      },
    } as any;

    const output = maskSsoSecrets(input);

    expect(output.oidcConfiguration?.clientSecret).toBeNull();
    expect(output.oidcConfiguration?.issuer).toBe('https://issuer.test');
    expect(output.oidcConfiguration?.clientId).toBe('client-abc');
  });

  it('masks both SAML and OIDC secrets when both are configured', () => {
    const input = {
      samlConfiguration: { spPrivateKey: 'SAML-PK' },
      oidcConfiguration: { clientSecret: 'OIDC-CS' },
    } as any;

    const output = maskSsoSecrets(input);

    expect(output.samlConfiguration?.spPrivateKey).toBeNull();
    expect(output.oidcConfiguration?.clientSecret).toBeNull();
  });

  it('does not mutate the original config object (returns a new top-level object)', () => {
    const original: { samlConfiguration: { spPrivateKey: string | null } | null } = {
      samlConfiguration: { spPrivateKey: 'SECRET' },
    };

    maskSsoSecrets(original);

    expect(original.samlConfiguration?.spPrivateKey).toBe('SECRET');
  });

  it('passes through configs without SAML or OIDC populated', () => {
    const input = { samlConfiguration: null, oidcConfiguration: null } as any;
    const output = maskSsoSecrets(input);
    expect(output.samlConfiguration).toBeNull();
    expect(output.oidcConfiguration).toBeNull();
  });
});

describe('fetchSamlMetadata', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    assertDomainResolvesToPublicIpMock.mockReset();
    assertDomainResolvesToPublicIpMock.mockResolvedValue(undefined);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the response when the initial URL resolves without redirects', async () => {
    const body = '<EntityDescriptor/>';
    fetchMock.mockResolvedValueOnce(new Response(body, { status: 200 }));

    const response = await fetchSamlMetadata('https://idp.okta.com/metadata');
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toBe(body);
    expect(assertDomainResolvesToPublicIpMock).toHaveBeenCalledTimes(1);
    expect(assertDomainResolvesToPublicIpMock).toHaveBeenCalledWith('https://idp.okta.com/metadata');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].redirect).toBe('manual');
  });

  it('follows a 302 redirect and validates the new host before fetching again', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://regional.okta.com/metadata' } }))
      .mockResolvedValueOnce(new Response('<EntityDescriptor/>', { status: 200 }));

    const response = await fetchSamlMetadata('https://idp.okta.com/metadata');

    expect(response.status).toBe(200);
    expect(assertDomainResolvesToPublicIpMock).toHaveBeenCalledTimes(2);
    expect(assertDomainResolvesToPublicIpMock.mock.calls[0][0]).toBe('https://idp.okta.com/metadata');
    expect(assertDomainResolvesToPublicIpMock.mock.calls[1][0]).toBe('https://regional.okta.com/metadata');
  });

  it('rejects a redirect to a host that resolves to a private IP', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: 'https://internal.lan/metadata' } }));
    assertDomainResolvesToPublicIpMock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Hostname resolves to a private or reserved IP address'));

    await expect(fetchSamlMetadata('https://idp.okta.com/metadata')).rejects.toThrow(/private or reserved/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('resolves a relative Location header against the current URL', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: '/metadata/v2' } }))
      .mockResolvedValueOnce(new Response('<EntityDescriptor/>', { status: 200 }));

    const response = await fetchSamlMetadata('https://idp.okta.com/metadata');

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[1][0]).toBe('https://idp.okta.com/metadata/v2');
  });

  it('throws when a redirect response is missing a Location header', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 302 }));

    await expect(fetchSamlMetadata('https://idp.okta.com/metadata')).rejects.toThrow(/missing Location header/);
  });

  it('throws when the redirect chain exceeds the hop cap', async () => {
    // MAX_REDIRECTS is 5 in the implementation — supply 6 consecutive redirects so the cap fires.
    for (let i = 0; i < 6; i++) {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: `https://hop${i + 1}.test/` } }));
    }
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://never.test/' } }));

    await expect(fetchSamlMetadata('https://hop0.test/')).rejects.toThrow(/exceeded maximum redirect hops/);
  });

  it('returns non-redirect non-2xx responses to the caller (e.g. a 404 surfaces unchanged)', async () => {
    fetchMock.mockResolvedValueOnce(new Response('not found', { status: 404 }));

    const response = await fetchSamlMetadata('https://idp.okta.com/metadata');
    expect(response.status).toBe(404);
  });

  // Intentional dev/CI carve-out: when USE_SECURE_COOKIES=false the SSRF check is skipped so
  // the local mock IdP (http://localhost:4000) is reachable. Re-imports the module under a
  // fresh mock so the top-level ENV.USE_SECURE_COOKIES=true default doesn't apply.
  it('skips the SSRF check when USE_SECURE_COOKIES is false (dev/CI mock-IdP case)', async () => {
    vi.resetModules();
    vi.doMock('@jetstream/api-config', () => ({
      ENV: { JETSTREAM_SERVER_URL: 'https://server.test', USE_SECURE_COOKIES: false, JETSTREAM_SAML_ACS_PATH_PREFIX: '/api/auth/sso/saml' },
      getExceptionLog: (error: unknown) => ({ error: error instanceof Error ? error.message : error }),
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      prisma: {},
      rollbarServer: { error: vi.fn(), warn: vi.fn() },
    }));
    const { fetchSamlMetadata: fetchSamlMetadataDev } = await import('../team.controller');
    fetchMock.mockResolvedValueOnce(new Response('<EntityDescriptor/>', { status: 200 }));

    const response = await fetchSamlMetadataDev('http://localhost:4000/api/saml/metadata');

    expect(response.status).toBe(200);
    expect(assertDomainResolvesToPublicIpMock).not.toHaveBeenCalled();
  });
});
