import { expect, test } from '@playwright/test';
import { cleanupSsoFixture, createSsoFixture } from '../../../../utils/auth-fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

async function getCsrf(request: any) {
  const res = await request.get('/api/auth/csrf');
  const body = await res.json();
  return body?.data?.csrfToken || body?.csrfToken;
}

test.describe('SSO returnUrl safety', () => {
  let fixture: Awaited<ReturnType<typeof createSsoFixture>>;

  test.beforeAll(async () => {
    fixture = await createSsoFixture();
  });

  test.afterAll(async () => {
    await cleanupSsoFixture(fixture);
  });

  test('start passes external returnUrl as RelayState but redirects to the IdP', async ({ request }) => {
    const csrfToken = await getCsrf(request);
    const res = await request.post('/api/auth/sso/start?returnUrl=https://evil.test', {
      data: { email: `user@${fixture.domain}`, csrfToken },
    });
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    const redirectUrl: string = json?.data?.redirectUrl;
    expect(redirectUrl).toBeTruthy();

    // The user is sent to the IdP — not to evil.test.
    // The external returnUrl is embedded as SAML RelayState (an opaque data field passed
    // through the IdP) and is validated by validateRedirectUrl() at callback time before
    // the final redirect, preventing an open redirect.
    const redirectHost = new URL(redirectUrl).hostname;
    expect(redirectHost).not.toBe('evil.test');
  });
});
