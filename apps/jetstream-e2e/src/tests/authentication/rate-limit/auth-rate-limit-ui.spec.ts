import { HTTP } from '@jetstream/shared/constants';
import { AuthenticationPage } from '@jetstream/test/e2e-utils';
import { expect, test } from '@playwright/test';
import { cleanupSsoFixture, createSsoFixture } from '../../../utils/auth-fixtures';

// Reset storage state — each test starts unauthenticated
test.use({ storageState: { cookies: [], origins: [] } });

// Matches the STRICT rate limiter limit in auth.routes.ts (20 req / 5 min)
const STRICT_REAL_LIMIT = 20;

function makeRateLimitHeaders(key: string) {
  return {
    [HTTP.HEADERS.X_DEV_NO_RATE_LIMIT_BYPASS]: '1',
    [HTTP.HEADERS.X_DEV_RATE_LIMIT_KEY]: key,
  };
}

test.describe('Auth rate limit UI behavior', () => {
  test.describe.configure({ mode: 'serial' });

  test.describe('SSO discovery', () => {
    let fixture: Awaited<ReturnType<typeof createSsoFixture>>;

    test.beforeAll(async () => {
      fixture = await createSsoFixture();
    });

    test.afterAll(async () => {
      await cleanupSsoFixture(fixture);
    });

    test('falls back to regular login when SSO discovery is rate limited', async ({ page, request }) => {
      const key = `sso-ui-${Date.now()}`;
      const headers = makeRateLimitHeaders(key);

      // Pre-exhaust the STRICT rate limit for SSO discovery via direct API calls.
      // Uses STRICT limiter which is shared by /sso/discover — isolated by the test key.
      // Errors are swallowed because the server may ECONNRESET requests that exceed the limit.
      await Promise.allSettled(
        Array.from({ length: STRICT_REAL_LIMIT + 1 }, () =>
          request.post('/api/auth/sso/discover', {
            data: { email: `user@${fixture.domain}` },
            headers,
          }),
        ),
      );

      // Intercept browser SSO discover calls to route them through the same exhausted key
      await page.route('**/api/auth/sso/discover', async (route) => {
        await route.continue({ headers: { ...route.request().headers(), ...headers } });
      });

      await page.goto('/');
      const authPage = new AuthenticationPage(page);
      await authPage.acceptCookieBanner();
      await authPage.goToLogin(false);

      await authPage.emailInput.fill(`user@${fixture.domain}`);
      await page.getByRole('button', { name: 'Continue' }).click();

      // checkSso returns null when the response is not ok (including 429), so the UI
      // silently falls back to the regular password login form without showing an error.
      await expect(authPage.passwordInput).toBeVisible();
      await expect(page.getByText('Single Sign-On is available')).toBeHidden();
    });
  });

  test.describe('Email/OTP code verification', () => {
    test('shows error when /api/auth/verify is rate limited', async ({ page, request }) => {
      const key = `verify-ui-${Date.now()}`;
      const headers = makeRateLimitHeaders(key);
      const authPage = new AuthenticationPage(page);

      // Sign up and stop before completing verification — lands on the verify page
      await page.goto('/');
      await authPage.acceptCookieBanner();
      await authPage.signUpWithoutEmailVerification();

      // Intercept verify calls from the browser to use the isolated rate limit key
      await page.route('**/api/auth/verify', async (route) => {
        await route.continue({ headers: { ...route.request().headers(), ...headers } });
      });

      // Pre-exhaust the STRICT limit via direct API. The rate limiter runs before body
      // validation, so the request body does not need to be valid.
      // Errors are swallowed because the server may ECONNRESET requests that exceed the limit.
      await Promise.allSettled(
        Array.from({ length: STRICT_REAL_LIMIT + 1 }, () =>
          request.post('/api/auth/verify', {
            headers: { ...headers, Accept: 'application/json' },
          }),
        ),
      );

      // Submit the form via the UI — the intercepted request hits the exhausted rate limit
      await authPage.verificationCodeInput.fill('000000');
      await authPage.continueButton.click();

      // The UI should surface a "too many attempts" error rather than silently failing
      await expect(page.getByText(/too many attempts/i)).toBeVisible();
    });
  });
});
