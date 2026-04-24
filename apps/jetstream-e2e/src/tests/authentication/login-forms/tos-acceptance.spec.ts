import { CURRENT_TOS_VERSION } from '@jetstream/auth/server';
import { clearUserTosAcceptance, getUserByEmail, getUserSessionsByEmail, verifyEmailLogEntryExists } from '@jetstream/test/e2e-utils';
import { expect, test } from '../../../fixtures/fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe.configure({ mode: 'parallel' });

// Reset storage state for this file to avoid being authenticated
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('TOS Acceptance', () => {
  test.beforeEach(async ({ page, authenticationPage }) => {
    await page.goto('/');
    await authenticationPage.acceptCookieBanner();
  });

  test('Sign up TOS checkbox is required and tosAcceptedVersion is stored on registration', async ({ page, authenticationPage }) => {
    const email = authenticationPage.generateTestEmail();
    const name = authenticationPage.generateTestName();
    const password = authenticationPage.generateTestPassword();

    await test.step('Navigate to sign up and fill form without accepting TOS', async () => {
      await page.goto('/');
      await authenticationPage.signUpFromHomePageButton.click();

      await authenticationPage.emailInput.fill(email);
      await authenticationPage.continueButton.click();

      await expect(authenticationPage.signUpButton).toBeVisible();
      await authenticationPage.fullNameInput.fill(name);
      await authenticationPage.passwordInput.fill(password);
      await authenticationPage.confirmPasswordInput.fill(password);

      // Submit without accepting TOS — expect client-side validation error
      await authenticationPage.signUpButton.click();
      await expect(page.getByText('You must accept the Terms of Service and Privacy Policy to continue')).toBeVisible();
    });

    await test.step('Accept TOS and complete sign up', async () => {
      await authenticationPage.tosCheckbox.check();
      await authenticationPage.signUpButton.click();

      await expect(page.getByText('Verify your email address')).toBeVisible();
      await verifyEmailLogEntryExists(email, 'Verify your email');
    });

    await test.step('Complete email verification', async () => {
      const sessions = await getUserSessionsByEmail(email);
      const pendingVerification = sessions.find((session) => session.pendingVerification?.length)?.pendingVerification || [];

      expect(pendingVerification).toHaveLength(1);

      if (pendingVerification[0].type !== 'email') {
        throw new Error('Expected email verification');
      }

      await authenticationPage.verificationCodeInput.fill(pendingVerification[0].token);
      await authenticationPage.continueButton.click();

      await page.waitForURL(`**/app/**`);
    });

    await test.step('Verify tosAcceptedVersion is stored in DB', async () => {
      const user = await getUserByEmail(email);
      expect(user.tosAcceptedVersion).toEqual(CURRENT_TOS_VERSION);
      expect(user.tosAcceptedAt).not.toBeNull();
    });
  });

  test('Existing user with pending TOS acceptance is gated until they accept', async ({ page, authenticationPage, playwrightPage }) => {
    const { email, password } = await test.step('Create new user and remember device to bypass 2FA on next login', async () => {
      const { email, password } = await authenticationPage.signUpAndVerifyEmail();

      // Logout and log back in with remember device so subsequent logins won't require 2FA
      await playwrightPage.logout();
      await expect(page.getByTestId('home-hero-container')).toBeVisible();

      await authenticationPage.loginAndVerifyEmail(email, password, true);
      expect(page.url()).toContain('/app');

      await playwrightPage.logout();
      await expect(page.getByTestId('home-hero-container')).toBeVisible();

      return { email, password };
    });

    await test.step('Clear TOS acceptance to simulate existing user who has not accepted', async () => {
      await clearUserTosAcceptance(email);
    });

    await test.step('Login and get redirected to TOS acceptance gate', async () => {
      // Device is remembered so no 2FA is required — server redirects directly to /auth/accept-terms
      await authenticationPage.fillOutLoginForm(email, password);
      await page.waitForURL(`**/auth/accept-terms**`);

      await expect(page.getByRole('heading', { name: 'Updated Terms of Service' })).toBeVisible();
      // Accept button should be disabled until the checkbox is checked
      await expect(authenticationPage.acceptTermsButton).toBeDisabled();
    });

    await test.step('Pending TOS session cannot call protected APIs', async () => {
      const heartbeatResponse = await page.request.get('/api/heartbeat', { headers: { Accept: 'application/json' } });
      expect(heartbeatResponse.status()).toBe(401);
    });

    await test.step('Accept TOS and verify redirect to app', async () => {
      await authenticationPage.acceptTosGatePage();
      expect(page.url()).toContain('/app');
    });

    await test.step('Verify tosAcceptedVersion is stored in DB and session TOS gate is cleared', async () => {
      const user = await getUserByEmail(email);
      expect(user.tosAcceptedVersion).toEqual(CURRENT_TOS_VERSION);
      expect(user.tosAcceptedAt).not.toBeNull();

      const sessions = await getUserSessionsByEmail(email);
      const activeSessions = sessions.filter((s) => s.user);
      expect(activeSessions.every((s) => !s.pendingTosAcceptance)).toBeTruthy();
    });
  });
});
