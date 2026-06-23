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
 * - checkDomainVerification covers the DNS TXT + hosted-file domain ownership checks:
 *   host fallbacks (apex → _jetstream. for DNS, apex → www. for files), detection of
 *   non-matching Jetstream values (drives the clearer user-facing error message), and
 *   resilience to DNS/fetch failures.
 */
import { Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkDomainVerification, fetchSamlMetadata, maskSsoSecrets } from '../team.controller';

const assertDomainResolvesToPublicIpMock = vi.hoisted(() => vi.fn());
// fetchSamlMetadata and checkDomainVerification's file fallback fetch each hop via
// fetchWithPinnedPublicIp, which resolves+validates the host is public and pins the connection to
// that IP using undici's own fetch. Mocked here so tests drive responses (and rejections) at that seam.
const fetchWithPinnedPublicIpMock = vi.hoisted(() => vi.fn());
// checkDomainVerification resolves TXT records via `dns/promises` — mocked so tests control DNS answers.
const resolveTxtMock = vi.hoisted(() => vi.fn());

// Mock the transitive import chain of team.controller.ts down to the minimum needed
// to load the module. We are exercising maskSsoSecrets and fetchSamlMetadata — nothing
// else from the controller touches its DB/service layer. vitest hoists these vi.mock
// calls before the imports above at runtime, so the load-order is correct.
// Holder so the mocked getLogger() can be pointed at warnMock for checkDomainVerification's
// warning assertions. Defaults to a no-op logger for every other test.
const loggerHolder = vi.hoisted(() => ({
  current: { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as Record<string, ReturnType<typeof vi.fn>>,
}));

vi.mock('@jetstream/api-config', () => ({
  ENV: { JETSTREAM_SERVER_URL: 'https://server.test', USE_SECURE_COOKIES: true, JETSTREAM_SAML_ACS_PATH_PREFIX: '/api/auth/sso/saml' },
  getExceptionLog: (error: unknown) => ({ error: error instanceof Error ? error.message : error }),
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  getLogger: () => loggerHolder.current,
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
  fetchWithPinnedPublicIp: fetchWithPinnedPublicIpMock,
}));
vi.mock('dns/promises', () => ({ resolveTxt: resolveTxtMock }));
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
    fetchWithPinnedPublicIpMock.mockReset();
    // Global fetch is only exercised on the dev/CI (USE_SECURE_COOKIES=false) carve-out path below.
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the response when the initial URL resolves without redirects', async () => {
    const body = '<EntityDescriptor/>';
    fetchWithPinnedPublicIpMock.mockResolvedValueOnce(new Response(body, { status: 200 }));

    const response = await fetchSamlMetadata('https://idp.okta.com/metadata');
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toBe(body);
    expect(fetchWithPinnedPublicIpMock).toHaveBeenCalledTimes(1);
    expect(fetchWithPinnedPublicIpMock).toHaveBeenCalledWith(
      'https://idp.okta.com/metadata',
      expect.objectContaining({ redirect: 'manual' }),
    );
  });

  it('follows a 302 redirect and pins the new host before fetching again', async () => {
    fetchWithPinnedPublicIpMock
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://regional.okta.com/metadata' } }))
      .mockResolvedValueOnce(new Response('<EntityDescriptor/>', { status: 200 }));

    const response = await fetchSamlMetadata('https://idp.okta.com/metadata');

    expect(response.status).toBe(200);
    expect(fetchWithPinnedPublicIpMock).toHaveBeenCalledTimes(2);
    expect(fetchWithPinnedPublicIpMock.mock.calls[0][0]).toBe('https://idp.okta.com/metadata');
    expect(fetchWithPinnedPublicIpMock.mock.calls[1][0]).toBe('https://regional.okta.com/metadata');
  });

  it('rejects a redirect to a host that resolves to a private IP', async () => {
    // The pin+validate happens inside fetchWithPinnedPublicIp, so a private redirect target
    // surfaces as a rejection from the second hop's fetch.
    fetchWithPinnedPublicIpMock
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: 'https://internal.lan/metadata' } }))
      .mockRejectedValueOnce(new Error('Hostname resolves to a private or reserved IP address'));

    await expect(fetchSamlMetadata('https://idp.okta.com/metadata')).rejects.toThrow(/private or reserved/i);
    expect(fetchWithPinnedPublicIpMock).toHaveBeenCalledTimes(2);
  });

  it('resolves a relative Location header against the current URL', async () => {
    fetchWithPinnedPublicIpMock
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: '/metadata/v2' } }))
      .mockResolvedValueOnce(new Response('<EntityDescriptor/>', { status: 200 }));

    const response = await fetchSamlMetadata('https://idp.okta.com/metadata');

    expect(response.status).toBe(200);
    expect(fetchWithPinnedPublicIpMock.mock.calls[1][0]).toBe('https://idp.okta.com/metadata/v2');
  });

  it('throws when a redirect response is missing a Location header', async () => {
    fetchWithPinnedPublicIpMock.mockResolvedValueOnce(new Response(null, { status: 302 }));

    await expect(fetchSamlMetadata('https://idp.okta.com/metadata')).rejects.toThrow(/missing Location header/);
  });

  it('throws when the redirect chain exceeds the hop cap', async () => {
    // MAX_REDIRECTS is 5 in the implementation — supply 6 consecutive redirects so the cap fires.
    for (let i = 0; i < 6; i++) {
      fetchWithPinnedPublicIpMock.mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: `https://hop${i + 1}.test/` } }),
      );
    }
    fetchWithPinnedPublicIpMock.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://never.test/' } }));

    await expect(fetchSamlMetadata('https://hop0.test/')).rejects.toThrow(/exceeded maximum redirect hops/);
  });

  it('returns non-redirect non-2xx responses to the caller (e.g. a 404 surfaces unchanged)', async () => {
    fetchWithPinnedPublicIpMock.mockResolvedValueOnce(new Response('not found', { status: 404 }));

    const response = await fetchSamlMetadata('https://idp.okta.com/metadata');
    expect(response.status).toBe(404);
  });

  // Intentional dev/CI carve-out: when USE_SECURE_COOKIES=false the SSRF pinning is skipped so the
  // local mock IdP (http://localhost:4000) is reachable via the global fetch. Re-imports the module
  // under a fresh mock so the top-level ENV.USE_SECURE_COOKIES=true default doesn't apply.
  it('skips pinning and uses the global fetch when USE_SECURE_COOKIES is false (dev/CI mock-IdP case)', async () => {
    vi.resetModules();
    vi.doMock('@jetstream/api-config', () => ({
      ENV: { JETSTREAM_SERVER_URL: 'https://server.test', USE_SECURE_COOKIES: false, JETSTREAM_SAML_ACS_PATH_PREFIX: '/api/auth/sso/saml' },
      getExceptionLog: (error: unknown) => ({ error: error instanceof Error ? error.message : error }),
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      getLogger: () => loggerHolder.current,
      prisma: {},
      rollbarServer: { error: vi.fn(), warn: vi.fn() },
    }));
    const { fetchSamlMetadata: fetchSamlMetadataDev } = await import('../team.controller');
    fetchMock.mockResolvedValueOnce(new Response('<EntityDescriptor/>', { status: 200 }));

    const response = await fetchSamlMetadataDev('http://localhost:4000/api/saml/metadata');

    expect(response.status).toBe(200);
    expect(fetchWithPinnedPublicIpMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('checkDomainVerification', () => {
  const DOMAIN = 'example.com';
  const CODE = 'jetstream-verification=abc123';
  let warnMock: Mock<(obj: Record<string, unknown>, msg: string) => void>;

  beforeEach(() => {
    resolveTxtMock.mockReset();
    fetchWithPinnedPublicIpMock.mockReset();
    warnMock = vi.fn<(obj: Record<string, unknown>, msg: string) => void>();
    // checkDomainVerification now logs via getLogger(); point its warn at warnMock for assertions.
    loggerHolder.current = { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: warnMock, error: vi.fn() };
  });

  it('verifies via a DNS TXT record on the apex domain without checking files', async () => {
    resolveTxtMock.mockResolvedValueOnce([[CODE]]);

    const result = await checkDomainVerification(DOMAIN, CODE);

    expect(result).toEqual({ verified: true, verificationMethod: 'dns', foundNonMatchingValue: false });
    expect(resolveTxtMock).toHaveBeenCalledTimes(1);
    expect(resolveTxtMock).toHaveBeenCalledWith('example.com');
    expect(fetchWithPinnedPublicIpMock).not.toHaveBeenCalled();
  });

  it('verifies via the _jetstream. subdomain when the apex has no matching record', async () => {
    resolveTxtMock.mockResolvedValueOnce([['v=spf1 include:_spf.google.com ~all']]).mockResolvedValueOnce([[CODE]]);

    const result = await checkDomainVerification(DOMAIN, CODE);

    expect(result).toEqual({ verified: true, verificationMethod: 'dns', foundNonMatchingValue: false });
    expect(resolveTxtMock).toHaveBeenNthCalledWith(2, '_jetstream.example.com');
    expect(fetchWithPinnedPublicIpMock).not.toHaveBeenCalled();
  });

  it('does not report a mismatch when a stale apex record coexists with a matching _jetstream. record', async () => {
    resolveTxtMock.mockResolvedValueOnce([['jetstream-verification=stale']]).mockResolvedValueOnce([[CODE]]);

    const result = await checkDomainVerification(DOMAIN, CODE);

    expect(result).toEqual({ verified: true, verificationMethod: 'dns', foundNonMatchingValue: false });
    expect(fetchWithPinnedPublicIpMock).not.toHaveBeenCalled();
  });

  it('flags foundNonMatchingValue when a Jetstream TXT record exists with a different code', async () => {
    resolveTxtMock.mockResolvedValue([['jetstream-verification=stale']]);
    fetchWithPinnedPublicIpMock.mockImplementation(async () => new Response('not found', { status: 404 }));

    const result = await checkDomainVerification(DOMAIN, CODE);

    expect(result).toEqual({ verified: false, verificationMethod: null, foundNonMatchingValue: true });
    expect(warnMock).toHaveBeenCalledWith(
      expect.objectContaining({ dnsHost: 'example.com' }),
      'DNS TXT verification record found but value did not match',
    );
  });

  it('does not flag unrelated TXT records (e.g. SPF) as non-matching Jetstream values', async () => {
    resolveTxtMock.mockResolvedValue([['v=spf1 include:_spf.google.com ~all']]);
    fetchWithPinnedPublicIpMock.mockImplementation(async () => new Response('not found', { status: 404 }));

    const result = await checkDomainVerification(DOMAIN, CODE);

    expect(result).toEqual({ verified: false, verificationMethod: null, foundNonMatchingValue: false });
  });

  it('falls back to the apex file URL when DNS lookups fail, pinning the fetch to a validated IP', async () => {
    resolveTxtMock.mockRejectedValue(new Error('queryTxt ENOTFOUND example.com'));
    // Trailing newline exercises the trim before comparison.
    fetchWithPinnedPublicIpMock.mockResolvedValueOnce(new Response(`${CODE}\n`, { status: 200 }));

    const result = await checkDomainVerification(DOMAIN, CODE);

    expect(result).toEqual({ verified: true, verificationMethod: 'file', foundNonMatchingValue: false });
    expect(fetchWithPinnedPublicIpMock).toHaveBeenCalledTimes(1);
    expect(fetchWithPinnedPublicIpMock.mock.calls[0][0]).toBe('https://example.com/.well-known/jetstream-verification.txt');
    expect(fetchWithPinnedPublicIpMock.mock.calls[0][1].redirect).toBe('manual');
  });

  it('falls back to the www. file URL when the apex file is unavailable', async () => {
    resolveTxtMock.mockRejectedValue(new Error('queryTxt ENOTFOUND example.com'));
    fetchWithPinnedPublicIpMock
      .mockResolvedValueOnce(new Response('not found', { status: 404 }))
      .mockResolvedValueOnce(new Response(CODE, { status: 200 }));

    const result = await checkDomainVerification(DOMAIN, CODE);

    expect(result).toEqual({ verified: true, verificationMethod: 'file', foundNonMatchingValue: false });
    expect(fetchWithPinnedPublicIpMock.mock.calls[1][0]).toBe('https://www.example.com/.well-known/jetstream-verification.txt');
  });

  it('does not duplicate the www. prefix when the domain already starts with www.', async () => {
    resolveTxtMock.mockResolvedValue([]);
    fetchWithPinnedPublicIpMock.mockImplementation(async () => new Response('not found', { status: 404 }));

    const result = await checkDomainVerification('www.example.com', CODE);

    expect(result).toEqual({ verified: false, verificationMethod: null, foundNonMatchingValue: false });
    // Only the stored host is fetched — never `www.www.example.com`.
    expect(fetchWithPinnedPublicIpMock).toHaveBeenCalledTimes(1);
    expect(fetchWithPinnedPublicIpMock.mock.calls[0][0]).toBe('https://www.example.com/.well-known/jetstream-verification.txt');
  });

  it('flags foundNonMatchingValue when the hosted file contains a different Jetstream code', async () => {
    resolveTxtMock.mockResolvedValue([]);
    fetchWithPinnedPublicIpMock.mockImplementation(async () => new Response('jetstream-verification=stale', { status: 200 }));

    const result = await checkDomainVerification(DOMAIN, CODE);

    expect(result).toEqual({ verified: false, verificationMethod: null, foundNonMatchingValue: true });
    expect(warnMock).toHaveBeenCalledWith(
      expect.objectContaining({ fileUrl: 'https://example.com/.well-known/jetstream-verification.txt' }),
      'Verification file found but contents did not match',
    );
  });

  it('returns not-verified with no flags when nothing is found via DNS or files', async () => {
    resolveTxtMock.mockResolvedValue([]);
    fetchWithPinnedPublicIpMock.mockImplementation(async () => new Response('<html>404</html>', { status: 404 }));

    const result = await checkDomainVerification(DOMAIN, CODE);

    expect(result).toEqual({ verified: false, verificationMethod: null, foundNonMatchingValue: false });
    // Both DNS hosts and both file hosts are tried before giving up.
    expect(resolveTxtMock).toHaveBeenCalledTimes(2);
    expect(fetchWithPinnedPublicIpMock).toHaveBeenCalledTimes(2);
  });

  it('survives file fetch rejections (e.g. SSRF validation failure) without throwing', async () => {
    resolveTxtMock.mockResolvedValue([]);
    fetchWithPinnedPublicIpMock.mockRejectedValue(new Error('Hostname resolves to a private or reserved IP address'));

    const result = await checkDomainVerification(DOMAIN, CODE);

    expect(result).toEqual({ verified: false, verificationMethod: null, foundNonMatchingValue: false });
    expect(fetchWithPinnedPublicIpMock).toHaveBeenCalled();
  });
});
