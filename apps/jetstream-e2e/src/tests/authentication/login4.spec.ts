import { prisma } from '@jetstream/api-config';
import { delay } from '@jetstream/shared/utils';
import { AuthenticationPage } from '@jetstream/test/e2e-utils';
import { expect, test } from '../../fixtures/fixtures';

test.beforeAll(async () => {
  await prisma.loginConfiguration.deleteMany({
    where: {
      domains: {
        hasSome: ['playwright.getjetstream.app', 'test.getjetstream.app', 'test2.getjetstream.app', 'mfa-required.getjetstream.app'],
      },
    },
  });
  await prisma.loginConfiguration.createMany({
    data: [
      {
        allowedMfaMethods: ['email'],
        allowedProviders: ['salesforce'],
        domains: ['test.getjetstream.app'],
        requireMfa: false,
      },
      {
        allowedMfaMethods: ['email'],
        allowedProviders: ['salesforce'],
        domains: ['test2.getjetstream.app'],
        requireMfa: false,
      },
      {
        allowedMfaMethods: ['otp'],
        allowedProviders: ['credentials'],
        domains: ['mfa-required.getjetstream.app'],
        requireMfa: true,
      },
    ],
  });
});

test.afterAll(async () => {
  await prisma.loginConfiguration.deleteMany({
    where: {
      domains: {
        hasSome: ['playwright.getjetstream.app', 'test.getjetstream.app', 'test2.getjetstream.app', 'mfa-required.getjetstream.app'],
      },
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
    await test.step('Username/password is not allowed for test.getjetstream.app', async () => {
      const password = authenticationPage.generateTestPassword();
      await authenticationPage.fillOutSignUpForm('test@test.getjetstream.app', authenticationPage.generateTestName(), password, password);
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
      const newEmail = email.replace('@', '@test2.');
      const user = await prisma.user.findFirstOrThrow({ where: { email } });
      await prisma.user.update({ where: { id: user.id }, data: { email: newEmail } });

      await authenticationPage.fillOutLoginForm('test@test2.getjetstream.app', password);
      await expect(page.getByText('method is not allowed')).toBeVisible();
    });
  });

  test('OTP MFA enrollment is enforced for new users', async ({ browser, page, authenticationPage }) => {
    const { email, name, password, secret } =
      await test.step('OTP enrollment is required when signing up after email verification', async () => {
        const email = authenticationPage.generateTestEmail('mfa-required.getjetstream.app');
        const { name, password, secret } = await authenticationPage.signUpAndVerifyEmailAndEnrollInOtp(email);
        expect(page.url()).toContain('/app');
        return { email, name, password, secret };
      });

    await test.step('OTP should be enforced on next login', async () => {
      const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      const page = await context.newPage();
      const authenticationPage = new AuthenticationPage(page);
      await authenticationPage.loginAndVerifyTotp(email, password, secret, true);
      expect(page.url()).toContain('/app');
    });
  });

  test('OTP MFA enrollment is continued if user abandons process', async ({ browser, page, authenticationPage }) => {
    const { email, name, password } = await test.step('Sign up and abandon OTP enrollment', async () => {
      const email = authenticationPage.generateTestEmail('mfa-required.getjetstream.app');
      const { name, password } = await authenticationPage.signUpAndVerifyEmailPauseBeforeEnrollInOtp(email);
      expect(page.url()).toContain('/auth/mfa-enroll');
      return { email, name, password };
    });

    await test.step('Try to go to app with pending MFA enrollment', async () => {
      await page.goto('/');
      await page.goto('/app');
      expect(page.url()).toContain('/auth/mfa-enroll/');
      await expect(page.getByRole('heading', { name: 'Scan the QR code with your' })).toBeVisible();
    });

    await test.step('Sign in with new context and ensure enrollment is continued', async () => {
      const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      const page = await context.newPage();
      const authenticationPage = new AuthenticationPage(page);
      await authenticationPage.fillOutLoginForm(email, password);

      await delay(1000); // ensure session is initialized
      await authenticationPage.verifyEmail(email, false, '**/auth/mfa-enroll/');

      await expect(page.getByRole('heading', { name: 'Scan the QR code with your' })).toBeVisible();
      await page.getByRole('link', { name: 'Logout' }).click();
    });

    await test.step('Log out and log back in and ensure MFA enrollment is continued - and finish enrollment', async () => {
      await page.goto('/auth/mfa-enroll/');
      expect(page.url()).toContain('/auth/mfa-enroll/');
      await expect(page.getByRole('heading', { name: 'Scan the QR code with your' })).toBeVisible();
      await page.getByRole('link', { name: 'Logout' }).click();

      await authenticationPage.fillOutLoginForm(email, password);
      await delay(1000); // ensure session is initialized
      await authenticationPage.verifyEmail(email, false, '**/auth/mfa-enroll/');
      await expect(page.getByRole('heading', { name: 'Scan the QR code with your' })).toBeVisible();
      await authenticationPage.enrollInOtp(email);
      expect(page.url()).toContain('/app');
    });
  });
});
