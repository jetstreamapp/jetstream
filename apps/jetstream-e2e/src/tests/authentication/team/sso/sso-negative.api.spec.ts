import { expect, test } from '@playwright/test';
import { cleanupSsoFixture, createSsoFixture } from '../../../../utils/auth-fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('SSO negative security cases', () => {
  let fixture: Awaited<ReturnType<typeof createSsoFixture>>;

  test.beforeAll(async () => {
    fixture = await createSsoFixture();
  });

  test.afterAll(async () => {
    await cleanupSsoFixture(fixture);
  });

  test('SAML ACS rejects invalid assertion payload', async ({ request }) => {
    const res = await request.post(`/api/auth/sso/saml/${fixture.teamId}/acs`, {
      data: { SAMLResponse: 'not-base64' },
      maxRedirects: 0,
    });
    // Callback endpoints redirect (3xx) on auth errors and may also return 4xx for
    // technical errors. Either way it must not be a 2xx success response.
    expect(res.ok()).toBeFalsy();
  });

  test('OIDC callback rejects missing state parameter', async ({ request }) => {
    const res = await request.get(`/api/auth/sso/oidc/${fixture.teamId}/callback?code=abc`, { maxRedirects: 0 });
    // Callback endpoints redirect (3xx) on auth errors like InvalidSession.
    // Either way it must not be a 2xx success response.
    expect(res.ok()).toBeFalsy();
  });
});
