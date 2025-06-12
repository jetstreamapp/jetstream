import { prisma } from '@jetstream/api-config';
import { expect, test } from '../../fixtures/fixtures';

test.beforeAll(async () => {
  await prisma.loginConfiguration.create({
    data: {
      allowedMfaMethods: ['email'],
      allowedProviders: ['salesforce'],
      domains: ['example.com'],
      requireMfa: false,
    },
  });
});

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe.configure({ mode: 'parallel' });

// Reset storage state for this file to avoid being authenticated
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login 4 - login configuration', () => {
  test('Allowed providers is enforced', async ({ page, authenticationPage, apiRequestUtils }) => {
    await test.step('Username/password is not allowed for example.com', async () => {
      await authenticationPage.fillOutSignUpForm(
        'test@example.com',
        authenticationPage.generateTestName(),
        authenticationPage.generateTestPassword(),
        authenticationPage.generateTestPassword()
      );
      await expect(page.getByText('method is not allowed')).toBeVisible();
    });

    await test.step('Other domains can sign up', async () => {
      await authenticationPage.signUpAndVerifyEmail();
    });
  });
});
