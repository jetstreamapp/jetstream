import { expect, test } from '@playwright/test';
import { cleanupSsoFixture, createSsoFixture } from '../../../../utils/auth-fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

async function getCsrf(request: any) {
  const res = await request.get('/api/auth/csrf');
  const body = await res.json();
  return body?.data?.csrfToken || body?.csrfToken;
}

test.describe('SSO domain verification gating', () => {
  let pendingFixture: Awaited<ReturnType<typeof createSsoFixture>>;
  let verifiedFixture: Awaited<ReturnType<typeof createSsoFixture>>;

  test.beforeAll(async () => {
    pendingFixture = await createSsoFixture({ domainStatus: 'PENDING' });
    verifiedFixture = await createSsoFixture({ domainStatus: 'VERIFIED' });
  });

  test.afterAll(async () => {
    await cleanupSsoFixture(pendingFixture);
    await cleanupSsoFixture(verifiedFixture);
  });

  test('discover hides SSO when domain is not verified', async ({ request }) => {
    const csrfToken = await getCsrf(request);
    const res = await request.post('/api/auth/sso/discover', {
      data: { email: `user@${pendingFixture.domain}`, csrfToken },
    });
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json?.data?.available).toBe(false);
  });

  test('discover returns available when domain is verified', async ({ request }) => {
    const csrfToken = await getCsrf(request);
    const res = await request.post('/api/auth/sso/discover', {
      data: { email: `user@${verifiedFixture.domain}`, csrfToken },
    });
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json?.data?.available).toBe(true);
  });

  test('start blocks SSO when domain is not verified', async ({ request }) => {
    const csrfToken = await getCsrf(request);
    const res = await request.post('/api/auth/sso/start', {
      data: { email: `user@${pendingFixture.domain}`, csrfToken },
      maxRedirects: 0,
    });
    // startSso returns 200 JSON on success; any other status means access was denied.
    // The auth error handler may redirect (3xx) or return a JSON error (4xx).
    expect(res.ok()).toBeFalsy();
  });
});
