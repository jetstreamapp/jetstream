import { prisma } from '@jetstream/api-config';
import { getPasswordResetToken } from '@jetstream/test/e2e-utils';
import { expect, test } from '../../fixtures/fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe.configure({ mode: 'parallel' });

// Reset storage state for this file to avoid being authenticated
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login 2', () => {
  test.beforeEach(async ({ page, authenticationPage }) => {
    await page.goto('/');
    await authenticationPage.acceptCookieBanner();
  });

  test('Should SignUp, Log Out, Reset Password, and Login with new password', async ({ page, authenticationPage, playwrightPage }) => {
    const { email } = await authenticationPage.signUpAndVerifyEmail();
    const password = authenticationPage.generateTestPassword();

    await playwrightPage.logout();

    await authenticationPage.goToPasswordReset();
    // Use uppercase email to ensure case insensitivity
    await authenticationPage.fillOutResetPasswordForm(email.toUpperCase());
    await expect(
      page.getByText('You will receive an email with instructions if an account exists and is eligible for password reset.'),
    ).toBeVisible();

    // ensure email verification was sent
    await prisma.emailActivity.findFirstOrThrow({ where: { email, subject: { contains: 'Reset your password' } } });
    const { token: code } = await getPasswordResetToken(email);

    await authenticationPage.goToPasswordResetVerify({ email, code });

    await authenticationPage.fillOutResetPasswordVerifyForm(password, password);

    await expect(page.getByText('Login with your new password')).toBeVisible();

    // Use uppercase email to ensure case insensitivity
    await authenticationPage.loginAndVerifyEmail(email.toUpperCase(), password);

    await authenticationPage.page.waitForURL(`**/app`);
  });

  test('Should SignUp, Add TOTP MFA, logout, login', async ({ page, authenticationPage, playwrightPage }) => {
    const { decodeBase32IgnorePadding } = await import('@oslojs/encoding');
    const { generateTOTP } = await import('@oslojs/otp');

    const { email, password } = await authenticationPage.signUpAndVerifyEmail();

    await playwrightPage.goToProfile();

    // Setup TOTP MFA
    await page.getByRole('button', { name: 'Set Up' }).click();
    const secret = await page.getByTestId('totp-secret').innerText();

    // attempt to save invalid token
    await page.getByTestId('settings-page').getByRole('textbox').click();
    await page.getByTestId('settings-page').getByRole('textbox').fill('123456');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Your verification code is invalid or has expired. Please try again.')).toBeVisible();
    await page.getByTestId('toast-notify-container').getByRole('button', { name: 'Close' }).click();

    // save a valid token
    await page.getByTestId('settings-page').getByRole('textbox').click();
    const code = await generateTOTP(decodeBase32IgnorePadding(secret), 30, 6);
    await page.getByTestId('settings-page').getByRole('textbox').fill(code);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('heading', { name: 'Authenticator App Active' }).locator('span')).toBeVisible();

    // TODO: validate that email was sent for adding/removing 2fa (probably disabling as well?)

    await playwrightPage.logout();

    await authenticationPage.loginAndVerifyTotp(email, password, secret);
    expect(page.url()).toContain('/app');

    await playwrightPage.goToProfile();

    // Disable all MFA
    await authenticationPage.mfaTotpMenuButton.click();
    await page.getByRole('menuitem', { name: 'Disable' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();

    await authenticationPage.mfaEmailMenuButton.click();
    await page.getByRole('menuitem', { name: 'Disable' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByText("You don't have two-factor")).toBeVisible();

    await playwrightPage.logout();
    await expect(page.getByTestId('home-hero-container')).toBeVisible();

    // Should not need 2fa since device is remembered
    await authenticationPage.fillOutLoginForm(email, password);
    await page.waitForURL(`**/app`);
    expect(page.url()).toContain('/app');

    // re-enable TOTP to make sure that works
    await playwrightPage.goToProfile();
    await authenticationPage.mfaTotpMenuButton.click();
    await page.getByRole('menuitem', { name: 'Enable' }).click();
    await expect(page.getByRole('heading', { name: 'Authenticator App Active' }).locator('span')).toBeVisible();

    await playwrightPage.logout();

    // Ensure 2fa is reactivated on logout and login
    await authenticationPage.loginAndVerifyTotp(email, password, secret);
    expect(page.url()).toContain('/app');

    // Delete TOTP and ensure that logout/login works successfully
    await playwrightPage.goToProfile();
    await authenticationPage.mfaTotpMenuButton.click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByText("You don't have two-factor")).toBeVisible();

    await playwrightPage.logout();

    await authenticationPage.fillOutLoginForm(email, password);
    await page.waitForURL(`**/app`);
    expect(page.url()).toContain('/app');
  });
});
