import { expect, test } from '../../fixtures/fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe.configure({ mode: 'parallel' });

// Reset storage state for this file to avoid being authenticated
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login 3', () => {
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
      await expect(response.status()).toBe(401);
    });

    await test.step('Verify email and ensure we can make an authenticated API request', async () => {
      await authenticationPage.verifyEmail(email);
      const response = await apiRequestUtils.makeRequestRaw('GET', '/api/me', { Accept: 'application/json' });
      await expect(response.status()).toBe(200);
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
      await expect(page.getByText('This email is already registered.')).toBeVisible();
    });
  });
});
