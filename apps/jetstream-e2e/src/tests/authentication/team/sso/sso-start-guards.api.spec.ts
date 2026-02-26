import { expect, test } from '@playwright/test';
import { cleanupSsoFixture, createSsoFixture } from '../../../../utils/auth-fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

async function safeJson(res: any) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function getCsrf(request: any) {
  const res = await request.get('/api/auth/csrf');
  const body = await res.json();
  return body?.data?.csrfToken || body?.csrfToken;
}

test.describe('SSO start guardrails', () => {
  let enabledFixture: Awaited<ReturnType<typeof createSsoFixture>>;
  let disabledFixture: Awaited<ReturnType<typeof createSsoFixture>>;

  test.beforeAll(async () => {
    enabledFixture = await createSsoFixture();
    disabledFixture = await createSsoFixture({ ssoEnabled: false });
  });

  test.afterAll(async () => {
    await cleanupSsoFixture(enabledFixture);
    await cleanupSsoFixture(disabledFixture);
  });

  test('start rejects unknown domain', async ({ request }) => {
    const csrfToken = await getCsrf(request);
    const res = await request.post('/api/auth/sso/start', {
      data: { email: 'user@unknown-domain.test', csrfToken },
      maxRedirects: 0,
    });
    const json = await safeJson(res);
    expect(json?.data?.redirectUrl).toBeFalsy();
    expect(res.ok()).toBeFalsy();
  });

  test('start rejects when SSO is disabled for the domain', async ({ request }) => {
    const csrfToken = await getCsrf(request);
    const res = await request.post('/api/auth/sso/start', {
      data: { email: `user@${disabledFixture.domain}`, csrfToken },
      maxRedirects: 0,
    });
    const json = await safeJson(res);
    expect(json?.data?.redirectUrl).toBeFalsy();
    expect(res.ok()).toBeFalsy();
  });
});
