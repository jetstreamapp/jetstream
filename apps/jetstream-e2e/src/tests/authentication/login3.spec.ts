import { expect, test } from '../../fixtures/fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe.configure({ mode: 'parallel' });

// Reset storage state for this file to avoid being authenticated
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login 3', () => {
  test.beforeEach(async ({ page, authenticationPage }) => {
    await page.goto('/');
    await authenticationPage.acceptCookieBanner();
  });

  test('Pending Email Verification should not allow any other activity', async ({ page, authenticationPage, apiRequestUtils }) => {
    const { email, password } = await test.step('Sign up without email verification', async () => {
      return await authenticationPage.signUpWithoutEmailVerification();
    });

    await test.step('Ensure clicking login shows email verification', async () => {
      await page.goto('/');
      await expect(authenticationPage.signInFromHomePageButton).toBeVisible();
      await authenticationPage.signInFromHomePageButton.click();
      await expect(page.getByText('Verify your email address')).toBeVisible();
    });

    await test.step('Ensure clicking sign up shows email verification', async () => {
      await page.goto('/');
      await expect(authenticationPage.signUpFromHomePageButton).toBeVisible();
      await authenticationPage.signUpFromHomePageButton.click();
      await expect(page.getByText('Verify your email address')).toBeVisible();
    });

    await test.step('Ensure clicking sign up from CTA shows email verification', async () => {
      await page.goto('/');
      await expect(authenticationPage.signUpCtaFromHomePageButton).toBeVisible();
      await authenticationPage.signUpCtaFromHomePageButton.click();
      await expect(page.getByText('Verify your email address')).toBeVisible();
    });

    await test.step('Ensure authenticated API fails prior to email verification', async () => {
      const response = await apiRequestUtils.makeRequestRaw('GET', '/api/me', { Accept: 'application/json' });
      expect(response.status()).toBe(401);
    });

    await test.step('Verify email and ensure we can make an authenticated API request', async () => {
      await authenticationPage.verifyEmail(email);
      const response = await apiRequestUtils.makeRequestRaw('GET', '/api/me', { Accept: 'application/json' });
      expect(response.status()).toBe(200);
    });
  });

  test('Should not be able to register with an existing email address', async ({ page, authenticationPage, playwrightPage }) => {
    const { email, password } = await test.step('Sign up, verify, logout', async () => {
      const user = await authenticationPage.signUpAndVerifyEmail();
      await playwrightPage.logout();
      return user;
    });

    await test.step('Attempt to register with same email address', async () => {
      await authenticationPage.fillOutSignUpForm(email, 'test person', password, password);

      // User should be prompted to verify email
      await expect(page.getByText('Verify your email address')).toBeVisible();

      // Verify email
      await authenticationPage.verifyEmail(email, false, authenticationPage.routes.login(true));

      // Should be redirected to login page with error message
      await page.waitForURL(authenticationPage.routes.login(true));
      await expect(page.getByText('This email address is already in use. Log in using an existing method or reset your password.')).toBeVisible();
    });

    await test.step('Attempt to register with same email address, using email with uppercase', async () => {
      await authenticationPage.fillOutSignUpForm(email.toUpperCase(), 'test person', password, password);

      // User should be prompted to verify email
      await expect(page.getByText('Verify your email address')).toBeVisible();

      // Verify email (using original lowercase email for database lookup)
      await authenticationPage.verifyEmail(email, false, authenticationPage.routes.login(true));

      // Should be redirected to login page with error message
      await page.waitForURL(authenticationPage.routes.login(true));
      await expect(page.getByText('This email address is already in use. Log in using an existing method or reset your password.')).toBeVisible();
    });
  });
});
