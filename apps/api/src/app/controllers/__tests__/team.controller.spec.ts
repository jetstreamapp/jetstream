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
 * - The access profile handlers (create/update/delete routes, plus the admin-only gate on assigning a
 *   profile when inviting, resending an invitation or updating a member) are driven through their
 *   route definitions with the team service mocked, to lock in what reaches the service and the audit log.
 */
import { Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotAllowedError, UserFacingError } from '../../utils/error-handler';
import { checkDomainVerification, fetchSamlMetadata, maskSsoSecrets, routeDefinition } from '../team.controller';

const assertDomainResolvesToPublicIpMock = vi.hoisted(() => vi.fn());
// fetchSamlMetadata and checkDomainVerification's file fallback fetch each hop via
// fetchWithPinnedPublicIp, which resolves+validates the host is public and pins the connection to
// that IP using undici's own fetch. Mocked here so tests drive responses (and rejections) at that seam.
const fetchWithPinnedPublicIpMock = vi.hoisted(() => vi.fn());
// checkDomainVerification resolves TXT records via `dns/promises` — mocked so tests control DNS answers.
const resolveTxtMock = vi.hoisted(() => vi.fn());
// The service, db and audit seams the access profile route handlers call
const routeMocks = vi.hoisted(() => ({
  sendJson: vi.fn(),
  createTeamAuditLog: vi.fn(),
  findTeamInvitationById: vi.fn(),
  canRunningUserUpdateTargetUserOrThrow: vi.fn(),
  updateTeamMember: vi.fn(),
  createInvitation: vi.fn(),
  resendInvitation: vi.fn(),
  createAccessProfile: vi.fn(),
  updateAccessProfile: vi.fn(),
  deleteAccessProfile: vi.fn(),
}));

// Mock the transitive import chain of team.controller.ts down to the minimum needed
// to load the module. The pure helpers never touch the DB/service layer; the route handler
// tests only reach the functions in routeMocks. vitest hoists these vi.mock
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
  errorTracker: { error: vi.fn(), warn: vi.fn() },
  prisma: {},
  rollbarServer: { error: vi.fn(), warn: vi.fn() },
}));
vi.mock('@jetstream/audit-logs', () => ({
  AuditLogAction: {
    TEAM_INVITATION_CREATED: 'TEAM_INVITATION_CREATED',
    TEAM_INVITATION_RESENT: 'TEAM_INVITATION_RESENT',
    TEAM_MEMBER_ROLE_UPDATED: 'TEAM_MEMBER_ROLE_UPDATED',
    TEAM_MEMBER_ACCESS_PROFILE_UPDATED: 'TEAM_MEMBER_ACCESS_PROFILE_UPDATED',
    TEAM_ACCESS_PROFILE_CREATED: 'TEAM_ACCESS_PROFILE_CREATED',
    TEAM_ACCESS_PROFILE_UPDATED: 'TEAM_ACCESS_PROFILE_UPDATED',
    TEAM_ACCESS_PROFILE_DELETED: 'TEAM_ACCESS_PROFILE_DELETED',
  },
  AuditLogResource: { TEAM_MEMBER: 'team_member', TEAM_INVITATION: 'team_invitation', TEAM_ACCESS_PROFILE: 'team_access_profile' },
  createTeamAuditLog: routeMocks.createTeamAuditLog,
}));
vi.mock('@jetstream/auth/server', () => ({
  getApiAddressFromReq: vi.fn(() => '127.0.0.1'),
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
vi.mock('../../db/team.db', () => ({ findTeamInvitationById: routeMocks.findTeamInvitationById }));
vi.mock('../../services/team.service', () => ({
  canRunningUserUpdateTargetUserOrThrow: routeMocks.canRunningUserUpdateTargetUserOrThrow,
  updateTeamMember: routeMocks.updateTeamMember,
  createInvitation: routeMocks.createInvitation,
  resendInvitation: routeMocks.resendInvitation,
  createAccessProfile: routeMocks.createAccessProfile,
  updateAccessProfile: routeMocks.updateAccessProfile,
  deleteAccessProfile: routeMocks.deleteAccessProfile,
}));
vi.mock('../../utils/response.handlers', () => ({ sendJson: routeMocks.sendJson }));

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

const TEAM_ID = '4d2c1b0a-9f8e-4d7c-8b6a-5f4e3d2c1b0a';
const RUNNING_USER_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const TARGET_USER_ID = '9e8d7c6b-5a4f-4e3d-9c2b-1a0f9e8d7c6b';
const INVITATION_ID = '2f3e4d5c-6b7a-4980-a1b2-c3d4e5f6a7b8';
const ACCESS_PROFILE_ID = '6b1f8d4e-2c3a-4e5f-9a7b-1c2d3e4f5a6b';
const OTHER_ACCESS_PROFILE_ID = '0d9c8b7a-6f5e-4d3c-8b2a-1f0e9d8c7b6a';
const INVITEE_EMAIL = 'invitee@example.com';

type AccessProfileRouteName =
  | 'createInvitation'
  | 'resendInvitation'
  | 'updateTeamMember'
  | 'createAccessProfile'
  | 'updateAccessProfile'
  | 'deleteAccessProfile';

/** Runs a team route handler the way express would after the team role middleware has passed */
async function invokeTeamRoute(
  routeName: AccessProfileRouteName,
  {
    role = 'ADMIN',
    params = {},
    body = {},
    query = {},
  }: { role?: string; params?: Record<string, string>; body?: unknown; query?: Record<string, string> } = {},
) {
  const req = {
    params: { teamId: TEAM_ID, ...params },
    body,
    query,
    ip: '127.0.0.1',
    headers: { 'user-agent': 'vitest' },
    get: () => undefined,
    session: { user: { id: RUNNING_USER_ID, teamMembership: { teamId: TEAM_ID, role, status: 'ACTIVE' } } },
  };
  const res = { locals: { requestId: 'req-1' } };
  const next = vi.fn();
  await routeDefinition[routeName].controllerFn()(req as never, res as never, next);
  return { res, next };
}

function expectForbidden(next: Mock) {
  expect(next).toHaveBeenCalledTimes(1);
  const [error] = next.mock.calls[0];
  expect(error).toBeInstanceOf(NotAllowedError);
  expect(error.status).toBe(403);
  // Distinguishes the profile gate from the role checks that run before it
  expect(error.message).toBe('Only administrators can assign access profiles');
}

function findAuditLogEntry(action: string) {
  return routeMocks.createTeamAuditLog.mock.calls.map(([entry]) => entry).find((entry) => entry.action === action);
}

function makeTeam() {
  return {
    id: TEAM_ID,
    members: [{ userId: TARGET_USER_ID, role: 'MEMBER', status: 'ACTIVE' }],
    accessProfiles: [
      { id: ACCESS_PROFILE_ID, name: 'Read only' },
      { id: OTHER_ACCESS_PROFILE_ID, name: 'Data loaders' },
    ],
  };
}

function makeAccessProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: ACCESS_PROFILE_ID,
    name: 'Read only',
    description: null,
    policy: { v: 1, tools: ['query'], operations: [], surfaces: [] },
    isDefault: false,
    version: 1,
    memberCount: 0,
    invitationCount: 0,
    ...overrides,
  };
}

const ACCESS_PROFILE_REQUEST = { name: 'Read only', policy: { tools: ['query'], operations: [], surfaces: [] } };

describe('assigning an access profile is limited to admins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.canRunningUserUpdateTargetUserOrThrow.mockResolvedValue(undefined);
    routeMocks.findTeamInvitationById.mockResolvedValue({
      id: INVITATION_ID,
      email: INVITEE_EMAIL,
      role: 'MEMBER',
      accessProfileId: null,
      expiresAt: new Date(),
      lastSentAt: new Date(),
    });
    routeMocks.createInvitation.mockResolvedValue({
      invitations: [],
      createdInvitation: { id: INVITATION_ID, email: INVITEE_EMAIL, role: 'MEMBER', accessProfileId: null, expiresAt: new Date() },
    });
    routeMocks.resendInvitation.mockResolvedValue({
      invitations: [],
      updatedInvitation: { id: INVITATION_ID, email: INVITEE_EMAIL, role: 'MEMBER', accessProfileId: null, previousAccessProfileId: null },
    });
    routeMocks.updateTeamMember.mockResolvedValue({
      team: makeTeam(),
      previousMember: { role: 'MEMBER', accessProfileId: null, email: 'member@example.com' },
    });
  });

  const assignments: [string, string | null][] = [
    ['a profile', ACCESS_PROFILE_ID],
    ['full access (null)', null],
  ];

  describe('invite', () => {
    it.each(assignments)('refuses a BILLING caller who assigns %s', async (_label, accessProfileId) => {
      const { next } = await invokeTeamRoute('createInvitation', {
        role: 'BILLING',
        body: { email: INVITEE_EMAIL, role: 'MEMBER', accessProfileId },
      });

      expectForbidden(next);
      expect(routeMocks.createInvitation).not.toHaveBeenCalled();
    });

    it('lets a BILLING caller invite without choosing a profile, so the team default applies', async () => {
      const { next } = await invokeTeamRoute('createInvitation', { role: 'BILLING', body: { email: INVITEE_EMAIL, role: 'MEMBER' } });

      expect(next).not.toHaveBeenCalled();
      expect(routeMocks.createInvitation).toHaveBeenCalledWith({
        runningUserId: RUNNING_USER_ID,
        teamId: TEAM_ID,
        request: { email: INVITEE_EMAIL, role: 'MEMBER' },
      });
    });

    it('lets an ADMIN assign a profile', async () => {
      const { next } = await invokeTeamRoute('createInvitation', {
        role: 'ADMIN',
        body: { email: INVITEE_EMAIL, role: 'MEMBER', accessProfileId: ACCESS_PROFILE_ID },
      });

      expect(next).not.toHaveBeenCalled();
      expect(routeMocks.createInvitation).toHaveBeenCalledWith(
        expect.objectContaining({ request: { email: INVITEE_EMAIL, role: 'MEMBER', accessProfileId: ACCESS_PROFILE_ID } }),
      );
    });
  });

  describe('resend or update invitation', () => {
    it.each(assignments)('refuses a BILLING caller who assigns %s', async (_label, accessProfileId) => {
      const { next } = await invokeTeamRoute('resendInvitation', {
        role: 'BILLING',
        params: { id: INVITATION_ID },
        body: { accessProfileId },
      });

      expectForbidden(next);
      expect(routeMocks.resendInvitation).not.toHaveBeenCalled();
    });

    it('lets a BILLING caller resend without touching the profile', async () => {
      const { next } = await invokeTeamRoute('resendInvitation', { role: 'BILLING', params: { id: INVITATION_ID }, body: {} });

      expect(next).not.toHaveBeenCalled();
      expect(routeMocks.resendInvitation).toHaveBeenCalledWith({
        runningUserId: RUNNING_USER_ID,
        teamId: TEAM_ID,
        invitationId: INVITATION_ID,
        expectedRole: 'MEMBER',
        request: {},
      });
    });

    it('records the previous and new profile in the audit entry when an ADMIN changes it', async () => {
      routeMocks.resendInvitation.mockResolvedValue({
        invitations: [],
        updatedInvitation: {
          id: INVITATION_ID,
          email: INVITEE_EMAIL,
          role: 'MEMBER',
          accessProfileId: ACCESS_PROFILE_ID,
          previousAccessProfileId: OTHER_ACCESS_PROFILE_ID,
        },
      });

      const { next } = await invokeTeamRoute('resendInvitation', {
        role: 'ADMIN',
        params: { id: INVITATION_ID },
        body: { accessProfileId: ACCESS_PROFILE_ID },
      });

      expect(next).not.toHaveBeenCalled();
      expect(findAuditLogEntry('TEAM_INVITATION_RESENT')?.metadata).toEqual({
        inviteeEmail: INVITEE_EMAIL,
        role: 'MEMBER',
        previousAccessProfileId: OTHER_ACCESS_PROFILE_ID,
        accessProfileId: ACCESS_PROFILE_ID,
      });
    });
  });

  describe('update member', () => {
    it.each(assignments)('refuses a BILLING caller who assigns %s', async (_label, accessProfileId) => {
      const { next } = await invokeTeamRoute('updateTeamMember', {
        role: 'BILLING',
        params: { userId: TARGET_USER_ID },
        body: { accessProfileId },
      });

      expectForbidden(next);
      expect(routeMocks.updateTeamMember).not.toHaveBeenCalled();
    });

    it('lets a BILLING caller change a role without touching the profile', async () => {
      const { next } = await invokeTeamRoute('updateTeamMember', {
        role: 'BILLING',
        params: { userId: TARGET_USER_ID },
        body: { role: 'BILLING' },
      });

      expect(next).not.toHaveBeenCalled();
      expect(routeMocks.updateTeamMember).toHaveBeenCalledWith(expect.objectContaining({ data: { role: 'BILLING' } }));
      expect(findAuditLogEntry('TEAM_MEMBER_ACCESS_PROFILE_UPDATED')).toBeUndefined();
    });
  });
});

describe('access profile routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('create passes the parsed request to the service and records the new profile', async () => {
    const team = makeTeam();
    routeMocks.createAccessProfile.mockResolvedValue({ team, accessProfile: makeAccessProfile({ isDefault: true }) });

    const { res, next } = await invokeTeamRoute('createAccessProfile', { body: { ...ACCESS_PROFILE_REQUEST, isDefault: true } });

    expect(next).not.toHaveBeenCalled();
    expect(routeMocks.createAccessProfile).toHaveBeenCalledWith({
      runningUserId: RUNNING_USER_ID,
      teamId: TEAM_ID,
      request: { name: 'Read only', description: null, isDefault: true, policy: { tools: ['query'], operations: [], surfaces: [] } },
    });
    expect(routeMocks.sendJson).toHaveBeenCalledWith(res, team);
    expect(findAuditLogEntry('TEAM_ACCESS_PROFILE_CREATED')).toEqual(
      expect.objectContaining({
        teamId: TEAM_ID,
        resourceId: ACCESS_PROFILE_ID,
        metadata: { name: 'Read only', isDefault: true, policy: { v: 1, tools: ['query'], operations: [], surfaces: [] } },
      }),
    );
  });

  it('update passes the profile id from the path and records the before and after', async () => {
    const team = makeTeam();
    routeMocks.updateAccessProfile.mockResolvedValue({
      team,
      previousAccessProfile: makeAccessProfile(),
      accessProfile: makeAccessProfile({ name: 'Renamed', version: 2, memberCount: 3 }),
    });

    const { res, next } = await invokeTeamRoute('updateAccessProfile', {
      params: { id: ACCESS_PROFILE_ID },
      body: { ...ACCESS_PROFILE_REQUEST, name: 'Renamed' },
    });

    expect(next).not.toHaveBeenCalled();
    expect(routeMocks.updateAccessProfile).toHaveBeenCalledWith({
      runningUserId: RUNNING_USER_ID,
      teamId: TEAM_ID,
      id: ACCESS_PROFILE_ID,
      request: expect.objectContaining({ name: 'Renamed' }),
    });
    expect(routeMocks.sendJson).toHaveBeenCalledWith(res, team);
    expect(findAuditLogEntry('TEAM_ACCESS_PROFILE_UPDATED')?.metadata).toEqual(
      expect.objectContaining({ name: 'Renamed', previousName: 'Read only', memberCount: 3 }),
    );
  });

  describe('delete', () => {
    function givenDeleteResult({
      reassignedUserIds = [],
      reassignedInvitationCount = 0,
    }: {
      reassignedUserIds?: string[];
      reassignedInvitationCount?: number;
    }) {
      routeMocks.deleteAccessProfile.mockResolvedValue({
        team: makeTeam(),
        deletedAccessProfile: makeAccessProfile({ id: ACCESS_PROFILE_ID }),
        reassignedUserIds,
        reassignedInvitationCount,
      });
    }

    function getReassignTarget() {
      return routeMocks.deleteAccessProfile.mock.calls[0][0].reassignToAccessProfileId;
    }

    beforeEach(() => {
      givenDeleteResult({});
    });

    it('parses reassignTo=FULL_ACCESS to null', async () => {
      await invokeTeamRoute('deleteAccessProfile', { params: { id: ACCESS_PROFILE_ID }, query: { reassignTo: 'FULL_ACCESS' } });

      expect(routeMocks.deleteAccessProfile).toHaveBeenCalledWith(
        expect.objectContaining({ runningUserId: RUNNING_USER_ID, teamId: TEAM_ID, id: ACCESS_PROFILE_ID }),
      );
      expect(getReassignTarget()).toBeNull();
    });

    it('passes a profile id in reassignTo through unchanged', async () => {
      await invokeTeamRoute('deleteAccessProfile', { params: { id: ACCESS_PROFILE_ID }, query: { reassignTo: OTHER_ACCESS_PROFILE_ID } });

      expect(getReassignTarget()).toBe(OTHER_ACCESS_PROFILE_ID);
    });

    it('leaves the reassignment undefined when reassignTo is omitted', async () => {
      await invokeTeamRoute('deleteAccessProfile', { params: { id: ACCESS_PROFILE_ID } });

      expect(getReassignTarget()).toBeUndefined();
    });

    it('rejects a reassignTo that is neither a profile id nor FULL_ACCESS', async () => {
      const { next } = await invokeTeamRoute('deleteAccessProfile', {
        params: { id: ACCESS_PROFILE_ID },
        query: { reassignTo: 'everyone' },
      });

      expect(next.mock.calls[0][0]).toBeInstanceOf(UserFacingError);
      expect(routeMocks.deleteAccessProfile).not.toHaveBeenCalled();
    });

    it('omits the reassignment destination from the audit entry when nothing was moved', async () => {
      await invokeTeamRoute('deleteAccessProfile', { params: { id: ACCESS_PROFILE_ID }, query: { reassignTo: OTHER_ACCESS_PROFILE_ID } });

      const { metadata } = findAuditLogEntry('TEAM_ACCESS_PROFILE_DELETED');
      expect(metadata).not.toHaveProperty('reassignedToAccessProfileId');
      expect(metadata).not.toHaveProperty('reassignedToAccessProfileName');
      expect(metadata).toEqual(expect.objectContaining({ name: 'Read only', reassignedUserIds: [], reassignedInvitationCount: 0 }));
    });

    it('records the destination profile in the audit entry when members were moved', async () => {
      givenDeleteResult({ reassignedUserIds: [TARGET_USER_ID] });

      await invokeTeamRoute('deleteAccessProfile', { params: { id: ACCESS_PROFILE_ID }, query: { reassignTo: OTHER_ACCESS_PROFILE_ID } });

      expect(findAuditLogEntry('TEAM_ACCESS_PROFILE_DELETED').metadata).toEqual(
        expect.objectContaining({
          reassignedToAccessProfileId: OTHER_ACCESS_PROFILE_ID,
          reassignedToAccessProfileName: 'Data loaders',
          reassignedUserIds: [TARGET_USER_ID],
          reassignedInvitationCount: 0,
        }),
      );
    });

    it('records full access as the destination when only invitations were moved', async () => {
      givenDeleteResult({ reassignedInvitationCount: 2 });

      await invokeTeamRoute('deleteAccessProfile', { params: { id: ACCESS_PROFILE_ID }, query: { reassignTo: 'FULL_ACCESS' } });

      expect(findAuditLogEntry('TEAM_ACCESS_PROFILE_DELETED').metadata).toEqual(
        expect.objectContaining({
          reassignedToAccessProfileId: null,
          reassignedToAccessProfileName: 'Full access',
          reassignedUserIds: [],
          reassignedInvitationCount: 2,
        }),
      );
    });
  });
});
