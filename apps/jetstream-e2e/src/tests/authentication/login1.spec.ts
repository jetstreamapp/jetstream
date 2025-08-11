import { expect, test } from '../../fixtures/fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe.configure({ mode: 'parallel' });

// Reset storage state for this file to avoid being authenticated
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login 1', () => {
  test('Sign up, login, disable 2fa, login again', async ({ page, authenticationPage, request, playwrightPage }) => {
    const { email, password, name } = await test.step('Sign up and verify email', async () => {
      const { email, password, name } = await authenticationPage.signUpAndVerifyEmail();

      // Verify user profile
      const profileResponse = await page.request.get('/api/me', { headers: { Accept: 'application/json' }, failOnStatusCode: true });
      expect(profileResponse.ok()).toBeTruthy();
      const userProfile = await profileResponse.json().then(({ data }) => data);
      expect(userProfile).toBeTruthy();
      expect(userProfile.id).toBeTruthy();
      expect(userProfile.name).toContain('Test User');
      expect(userProfile.email).toContain('test-');
      expect(userProfile.emailVerified).toEqual(true);
      expect(userProfile).toHaveProperty('picture');
      expect(userProfile.preferences).toBeTruthy();
      expect(userProfile.preferences.skipFrontdoorLogin).toEqual(false);
      expect(userProfile.entitlements).toBeTruthy();
      expect(userProfile.entitlements.chromeExtension).toEqual(false);
      expect(userProfile.entitlements.googleDrive).toEqual(false);
      expect(userProfile.entitlements.desktop).toEqual(false);
      expect(userProfile.entitlements.recordSync).toEqual(false);
      expect(userProfile.subscriptions).toBeTruthy();
      expect(userProfile.subscriptions).toHaveLength(0);

      await playwrightPage.logout();
      await expect(page.getByTestId('home-hero-container')).toBeVisible();
      return { email, password, name };
    });

    await test.step('Login and verify email and logout', async () => {
      await authenticationPage.loginAndVerifyEmail(email, password);
      expect(page.url()).toContain('/app');
      await playwrightPage.goToProfile();
      await expect(page.getByText(name)).toBeVisible();
      await expect(page.getByText(email)).toBeVisible();
    });

    await test.step('Disable MFA and logout', async () => {
      // Disable MFA and login again to confirm it is no longer required
      await authenticationPage.mfaEmailMenuButton.click();
      await page.getByRole('menuitem', { name: 'Disable' }).click();
      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page.getByText("You don't have two-factor")).toBeVisible();

      await playwrightPage.logout();
      await expect(page.getByTestId('home-hero-container')).toBeVisible();
    });

    await test.step('Login without MFA', async () => {
      await authenticationPage.fillOutLoginForm(email, password);
      await page.waitForURL(`**/app`);
      expect(page.url()).toContain('/app');
    });
  });

  test('Sign up, login, enable remember me and login', async ({ page, authenticationPage, playwrightPage }) => {
    const { email, password } = await test.step('Sign up and verify email', async () => {
      const { email, password, name } = await authenticationPage.signUpAndVerifyEmail();
      await playwrightPage.logout();
      await expect(page.getByTestId('home-hero-container')).toBeVisible();
      return { email, password, name };
    });

    await test.step('Login with remembered device', async () => {
      await authenticationPage.loginAndVerifyEmail(email, password, true);
      expect(page.url()).toContain('/app');
      await playwrightPage.logout();
      await expect(page.getByTestId('home-hero-container')).toBeVisible();
    });

    await test.step('Should not need 2fa since device is remembered', async () => {
      await authenticationPage.fillOutLoginForm(email, password);
      await page.waitForURL(`**/app`);
      expect(page.url()).toContain('/app');
      await playwrightPage.logout();
      await expect(page.getByTestId('home-hero-container')).toBeVisible();
    });

    await test.step('Email address should be case-insensitive', async () => {
      await authenticationPage.fillOutLoginForm(email.toUpperCase(), password);
      await page.waitForURL(`**/app`);
      expect(page.url()).toContain('/app');
    });
  });
});
