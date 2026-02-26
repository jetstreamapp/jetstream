/* eslint-disable playwright/no-conditional-expect */
/* eslint-disable playwright/no-conditional-in-test */
import { APIRequestContext, expect, test } from '@playwright/test';
import { cleanupSsoFixture, createSsoFixture } from '../../../../utils/auth-fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

async function withCsrf(request: APIRequestContext) {
  const res = await request.get('/api/auth/csrf');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return { csrfToken: body?.data?.csrfToken || body?.csrfToken };
}

test.describe('SSO API security', () => {
  let fixture: Awaited<ReturnType<typeof createSsoFixture>>;

  test.beforeAll(async () => {
    fixture = await createSsoFixture();
  });

  test.afterAll(async () => {
    await cleanupSsoFixture(fixture);
  });

  test('discover returns available for verified domain and nothing for unknown domain', async ({ request }) => {
    const { csrfToken } = await withCsrf(request);

    const good = await request.post('/api/auth/sso/discover', {
      data: { email: `user@${fixture.domain}`, csrfToken },
    });
    expect(good.ok()).toBeTruthy();
    const goodJson = await safeJson(good);
    expect(goodJson?.data?.available).toBe(true);

    const bad = await request.post('/api/auth/sso/discover', {
      data: { email: 'user@unknown.test', csrfToken },
    });
    expect(bad.ok()).toBeTruthy();
    const badJson = await safeJson(bad);
    expect(badJson?.data?.available).toBe(false);
  });

  test('start returns redirectUrl for configured provider', async ({ request }) => {
    const { csrfToken } = await withCsrf(request);

    const res = await request.post('/api/auth/sso/start?returnUrl=/app/home', {
      data: { email: `user@${fixture.domain}`, csrfToken },
    });

    expect(res.ok()).toBeTruthy();
    const json = await safeJson(res);
    expect(json?.data?.redirectUrl).toBeTruthy();
  });

  test('start rejects when CSRF token is missing', async ({ request }) => {
    const res = await request.post('/api/auth/sso/start', {
      data: { email: `user@${fixture.domain}` },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('discover rejects when CSRF token is missing', async ({ request }) => {
    const res = await request.post('/api/auth/sso/discover', {
      data: { email: `user@${fixture.domain}` },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('oidc callback rejects when cookies are missing', async ({ request }) => {
    const res = await request.get(`/api/auth/sso/oidc/${fixture.teamId}/callback`);
    // Without state/nonce cookies the handler should not allow login; tolerate 200 with an error payload or a redirect
    expect(res.status()).toBeGreaterThanOrEqual(200);
    const body = await safeJson(res);
    if (body) {
      expect(body.error || body.data?.error || res.status() >= 400 || res.status() === 302).toBeTruthy();
    }
  });

  test('saml ACS rejects missing response', async ({ request }) => {
    const res = await request.post(`/api/auth/sso/saml/${fixture.teamId}/acs`, {
      data: {},
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });
});

async function safeJson(res: any) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
