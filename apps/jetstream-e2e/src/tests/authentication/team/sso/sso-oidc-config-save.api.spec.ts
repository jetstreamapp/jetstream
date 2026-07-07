import { prisma } from '@jetstream/api-config';
import { HTTP } from '@jetstream/shared/constants';
import { randomUUID } from 'crypto';
import { createServer, Server } from 'http';
import { expect, test } from '../../../../fixtures/fixtures';

// Fresh signup per test (mirrors team.spec.ts) so the fixture's admin owns the page session.
test.use({ storageState: { cookies: [], origins: [] } });

// Distinct port from sso-oidc-happy.api.spec.ts (5555) so both mock IdPs can run in parallel workers.
const ISSUER = 'http://127.0.0.1:5556';

/**
 * Minimal mock IdP that serves only the OIDC discovery document. The config-save flow resolves and
 * snapshots the endpoints from discovery; it does not call token/jwks/userinfo at save time.
 */
function startMockOidcServer(): Server {
  const server = createServer((req, res) => {
    if (req.url?.startsWith('/.well-known/openid-configuration')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          issuer: ISSUER,
          authorization_endpoint: `${ISSUER}/auth`,
          token_endpoint: `${ISSUER}/token`,
          userinfo_endpoint: `${ISSUER}/userinfo`,
          jwks_uri: `${ISSUER}/jwks`,
        }),
      );
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(5556);
  return server;
}

test.describe('OIDC SSO configuration save', () => {
  let mockServer: Server;
  let createdLoginConfigId: string | undefined;

  test.beforeAll(() => {
    mockServer = startMockOidcServer();
  });

  test.afterEach(async () => {
    // The OIDC config hangs off the team's login config, which the fixture's team-only cleanup does
    // not delete, so remove it explicitly to avoid leaking rows between runs.
    if (createdLoginConfigId) {
      await prisma.oidcConfiguration.deleteMany({ where: { loginConfigId: createdLoginConfigId } }).catch(() => undefined);
      createdLoginConfigId = undefined;
    }
  });

  test.afterAll(() => {
    mockServer?.close();
  });

  test('derives OIDC endpoints from the issuer when the client omits them', async ({ page, teamCreationUtils1User: teamCreationUtils }) => {
    const { team } = teamCreationUtils;
    const loginConfigId = team.loginConfig.id;
    createdLoginConfigId = loginConfigId;

    await test.step('Seed a verified domain (configuring SSO requires one)', async () => {
      await prisma.domainVerification.create({
        data: {
          teamId: team.id,
          domain: `oidc-${randomUUID().slice(0, 8)}.test`,
          status: 'VERIFIED',
          verificationCode: `jetstream-verification=${randomUUID()}`,
          verifiedAt: new Date(),
        },
      });
    });

    // The /api/teams routes enforce HMAC double-submit CSRF: echo the `jetstream-csrf` cookie set at
    // login back in the X-Csrf-Token header (the app's axios interceptor does this in the real client).
    // The /api/auth/csrf token is a separate legacy token and does NOT satisfy this middleware.
    const cookies = await page.context().cookies();
    const csrfToken = cookies.find(({ name }) => name.endsWith(HTTP.COOKIE.CSRF_SUFFIX))?.value ?? '';
    expect(csrfToken).toBeTruthy();

    await test.step('Save OIDC config with only the issuer + client credentials (no endpoints)', async () => {
      const response = await page.request.post(`/api/teams/${team.id}/sso/oidc/config`, {
        headers: { [HTTP.HEADERS.X_CSRF_TOKEN]: csrfToken },
        data: {
          name: 'Mock OIDC',
          issuer: ISSUER,
          clientId: 'client-id',
          clientSecret: 'client-secret',
          scopes: ['openid', 'email', 'profile'],
          attributeMapping: { email: 'email', userName: 'email', firstName: 'given_name', lastName: 'family_name' },
          // Intentionally NO authorizationEndpoint / tokenEndpoint / jwksUri — this is the exact
          // request shape that previously failed validation with a ZodError.
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      // Secret is encrypted at rest and never returned to the client.
      expect(body?.data?.oidcConfiguration?.clientSecret).toBeNull();
    });

    await test.step('Server discovered and persisted the endpoints from the issuer', async () => {
      const stored = await prisma.oidcConfiguration.findFirstOrThrow({ where: { loginConfigId } });
      expect(stored.authorizationEndpoint).toBe(`${ISSUER}/auth`);
      expect(stored.tokenEndpoint).toBe(`${ISSUER}/token`);
      expect(stored.jwksUri).toBe(`${ISSUER}/jwks`);
      expect(stored.userinfoEndpoint).toBe(`${ISSUER}/userinfo`);
    });
  });
});
