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
  test('Allowed providers is enforced', async ({ page, authenticationPage, playwrightPage }) => {
    await test.step('Username/password is not allowed for example.com', async () => {
      const password = authenticationPage.generateTestPassword();
      await authenticationPage.fillOutSignUpForm('test@example.com', authenticationPage.generateTestName(), password, password);
      await expect(page.getByText('method is not allowed')).toBeVisible();
    });

    const existingUser = await test.step('Other domains can sign up and login', async () => {
      const user = await authenticationPage.signUpAndVerifyEmail();

      await playwrightPage.logout();
      await expect(page.getByTestId('home-hero-container')).toBeVisible();

      await authenticationPage.loginAndVerifyEmail(user.email, user.password, true);
      await page.waitForURL(`**/app`);
      expect(page.url()).toContain('/app');

      await playwrightPage.logout();
      await expect(page.getByTestId('home-hero-container')).toBeVisible();

      return user;
    });

    await test.step('Add domain restriction to existing users', async () => {
      const { email, name, password } = existingUser;
      const newEmail = email.replace('@', '@test.');
      const user = await prisma.user.findFirstOrThrow({ where: { email } });
      await prisma.user.update({ where: { id: user.id }, data: { email: newEmail } });
      await prisma.loginConfiguration.create({
        data: {
          allowedMfaMethods: ['email'],
          allowedProviders: ['salesforce'],
          domains: ['test.getjetstream.app'],
          requireMfa: false,
        },
      });

      await authenticationPage.fillOutLoginForm('test@example.com', password);
      await expect(page.getByText('method is not allowed')).toBeVisible();
    });
  });
});
