/* eslint-disable playwright/no-conditional-in-test */
import { prisma } from '@jetstream/api-config';
import { expect, test } from '@playwright/test';
import { parse as parseCookieHeader } from 'cookie';
import { createSign, generateKeyPairSync } from 'crypto';
import { createServer, Server } from 'http';
import { cleanupSsoFixture, createSsoFixture } from '../../../../utils/auth-fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

const ISSUER = 'http://127.0.0.1:5555';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = publicKey.export({ format: 'jwk' }) as any;
jwk.use = 'sig';
jwk.alg = 'RS256';
jwk.kid = 'test-key';
const jwks = { keys: [jwk] };

let currentNonce = 'nonce';
let currentEmail = 'user@example-token.test';

function signIdToken(nonce: string, email: string) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: jwk.kid })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      iss: ISSUER,
      aud: 'client-id',
      sub: 'abc123',
      email,
      email_verified: true,
      preferred_username: 'testuser',
      name: 'Test User',
      given_name: 'Test',
      family_name: 'User',
      role: 'ADMIN',
      nonce,
      iat: Math.floor(Date.now() / 1000) - 5,
      exp: Math.floor(Date.now() / 1000) + 60 * 5,
    }),
  ).toString('base64url');
  const data = `${header}.${payload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(data);
  const signature = signer.sign(privateKey).toString('base64url');
  return `${data}.${signature}`;
}

function startMockOidcServer(): Server {
  const server = createServer((req, res) => {
    if (!req.url) return;
    if (req.url.startsWith('/.well-known/openid-configuration')) {
      const body = {
        issuer: ISSUER,
        authorization_endpoint: `${ISSUER}/auth`,
        token_endpoint: `${ISSUER}/token`,
        userinfo_endpoint: `${ISSUER}/userinfo`,
        jwks_uri: `${ISSUER}/jwks`,
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
      return;
    }
    if (req.url.startsWith('/jwks')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(jwks));
      return;
    }
    if (req.url.startsWith('/token')) {
      const idToken = signIdToken(currentNonce, currentEmail);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ access_token: 'at', token_type: 'Bearer', expires_in: 3600, id_token: idToken }));
      return;
    }
    if (req.url.startsWith('/userinfo')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          sub: 'abc123',
          email: currentEmail,
          email_verified: true,
          preferred_username: 'testuser',
          given_name: 'Test',
          family_name: 'User',
          role: 'ADMIN',
        }),
      );
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(5555);
  return server;
}

function cookieHeaderFromResponse(res: any): string | undefined {
  const setCookies = res
    .headersArray?.()
    ?.filter((h: { name: string }) => h.name.toLowerCase() === 'set-cookie')
    .map((h: { value: string }) => h.value);
  if (!setCookies || setCookies.length === 0) return;
  const simple = setCookies.map((c: string) => c.split(';')[0]).join('; ');
  return simple || undefined;
}

function mergeCookies(...cookieHeaders: Array<string | undefined>): string | undefined {
  const parts = cookieHeaders
    .filter(Boolean)
    .flatMap((hdr) => (hdr as string).split(';').map((p) => p.trim()))
    .filter(Boolean);
  if (parts.length === 0) return;
  // dedupe by key
  const map = new Map<string, string>();
  for (const p of parts) {
    const [k, v] = p.split('=');
    map.set(k, v);
  }
  return Array.from(map.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

async function getCsrf(request: any) {
  const res = await request.get('/api/auth/csrf');
  const json = await safeJson(res);
  return {
    token: json?.data?.csrfToken || json?.csrfToken,
    cookie: cookieHeaderFromResponse(res),
  };
}

async function safeJson(res: any) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

test.describe('OIDC SSO happy path', () => {
  let fixture: Awaited<ReturnType<typeof createSsoFixture>>;
  let mockServer: Server;

  test.beforeAll(async () => {
    mockServer = startMockOidcServer();
    fixture = await createSsoFixture({
      ssoProvider: 'OIDC',
      oidcIssuer: ISSUER,
      oidcClientId: 'client-id',
      oidcClientSecret: 'client-secret',
      seedUser: false,
      addTeamMember: false,
    });
    await prisma.oidcConfiguration.update({
      where: { loginConfigId: fixture.loginConfigId },
      data: { userinfoEndpoint: null },
    });
  });

  test.afterAll(async () => {
    mockServer?.close();
    await cleanupSsoFixture(fixture);
  });

  test('starts OIDC and completes callback with mock IdP', async ({ request, context }) => {
    // 1) get CSRF
    const { token: csrfToken, cookie: csrfCookie } = await getCsrf(request);
    expect(csrfToken).toBeTruthy();

    // 2) start SSO to obtain state/pkce cookies
    const start = await request.post('/api/auth/sso/start?returnUrl=/app/home', {
      data: { email: `user@${fixture.domain}`, csrfToken },
      headers: csrfCookie ? { cookie: csrfCookie } : {},
    });
    expect([200, 302, 303, 307, 308].includes(start.status())).toBeTruthy();
    const startJson = await safeJson(start);
    expect(startJson?.data?.redirectUrl).toBeTruthy();

    // 3) intercept JWKS + token endpoints for this test context
    // not needed since we run a local OIDC mock server

    // 4) call callback reusing cookies from start
    const startCookie = cookieHeaderFromResponse(start);
    const mergedCookies = mergeCookies(csrfCookie, startCookie);
    const cookies = parseCookieHeader(mergedCookies || '');
    currentNonce = cookies['jetstream-auth.nonce'] || cookies['__Secure-jetstream-auth.nonce'] || currentNonce;
    const state = cookies['jetstream-auth.state'] || cookies['__Secure-jetstream-auth.state'] || cookies['jetstream-auth.state'] || '';
    currentEmail = `user@${fixture.domain}`;
    const res = await request.get(`/api/auth/sso/oidc/${fixture.teamId}/callback?code=fakecode&state=${state}`, {
      headers: mergedCookies ? { cookie: mergedCookies } : {},
      maxRedirects: 0,
    });

    const resBody = await safeJson(res);
    expect([302, 303, 307, 308].includes(res.status())).toBeTruthy();

    // 5) ensure membership was provisioned
    const memberCount = await prisma.teamMember.count({ where: { teamId: fixture.teamId } });
    if (memberCount < 1) {
      console.error('OIDC callback debug', { status: res.status(), body: resBody, mergedCookies, state });
    }
    expect(memberCount).toBeGreaterThanOrEqual(1);
  });
});
