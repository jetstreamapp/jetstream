import { PASSWORD_MIN_LENGTH } from '@jetstream/types';
import { expect, test } from '../../../fixtures/fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe.configure({ mode: 'parallel' });

// Reset storage state for this file to avoid being authenticated
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Auth Page Navigation', () => {
  test.beforeEach(async ({ page, authenticationPage }) => {
    await page.goto('/');
    await authenticationPage.acceptCookieBanner();
  });

  test('Should be able to navigate between all authentication pages', async ({ page, authenticationPage }) => {
    await authenticationPage.goToSignUp();

    await page.waitForURL(authenticationPage.routes.signup());
    expect(page.url()).toContain(authenticationPage.routes.signup());
    await authenticationPage.signInFromFormLink.click();

    await page.waitForURL(authenticationPage.routes.login());
    expect(page.url()).toContain(authenticationPage.routes.login());
    await authenticationPage.signUpFromFormLink.click();
    await page.waitForURL(authenticationPage.routes.signup());
    expect(page.url()).toContain(authenticationPage.routes.signup());

    // "Forgot password?" is on the login page behind the Continue step — navigate there first
    await authenticationPage.signInFromFormLink.click();
    await page.waitForURL(authenticationPage.routes.login());
    await authenticationPage.emailInput.fill('test@example.com');
    await authenticationPage.continueButton.click();

    await authenticationPage.forgotPasswordLink.click();
    await page.waitForURL(authenticationPage.routes.passwordReset());
    expect(page.url()).toContain(authenticationPage.routes.passwordReset());
    await authenticationPage.loginPageFromPasswordReset.click();
    await page.waitForURL(authenticationPage.routes.login());
    expect(page.url()).toContain(authenticationPage.routes.login());

    await authenticationPage.goToLogin();
    await page.waitForURL(authenticationPage.routes.login());
    expect(page.url()).toContain(authenticationPage.routes.login());
  });

  test('Should not be able to go to password reset form without proper URL parameters', async ({ page, authenticationPage }) => {
    await authenticationPage.goToPasswordResetVerify();
    await page.waitForURL(authenticationPage.routes.login(true));

    await expect(page.getByText('Your reset token is invalid,')).toBeVisible();

    await page.getByRole('button', { name: 'Dismiss' }).click();
    await expect(page.getByText('Your reset token is invalid,')).toHaveCount(0);
  });

  test('Should not be able to go to mfa page without verification session', async ({ page, authenticationPage }) => {
    await authenticationPage.goToMfaVerify();
    await page.waitForURL(authenticationPage.routes.login(true));
    expect(page.url()).toContain(authenticationPage.routes.login());
  });
});

test.describe('Auth Form Validation', () => {
  test('login form validation', async ({ page, authenticationPage }) => {
    const LOGIN_PASSWORD_MIN_LENGTH = 8;
    await test.step('Invalid email', async () => {
      // With the two-step flow (email → continue → password), an invalid email prevents
      // the form from advancing so only email validation can be tested here.
      await authenticationPage.submitLoginEmailStep('inva lid @email.com');
      await expect(authenticationPage.emailInput).toHaveAttribute('aria-invalid', 'true');
      await expect(authenticationPage.emailInput).toHaveAttribute('aria-describedby');
      await expect(page.getByText('A valid email address is required')).toBeVisible();
    });

    await test.step('Invalid email (with password intent)', async () => {
      await authenticationPage.submitLoginEmailStep('test @email.com');
      await expect(authenticationPage.emailInput).toHaveAttribute('aria-invalid', 'true');
      await expect(authenticationPage.emailInput).toHaveAttribute('aria-describedby');
      await expect(page.getByText('A valid email address is required')).toBeVisible();
    });

    await test.step('Invalid password length', async () => {
      await authenticationPage.fillOutLoginForm('test@email.com', 'pwd');
      await expect(authenticationPage.emailInput).toHaveAttribute('aria-invalid', 'false');
      await expect(authenticationPage.emailInput).not.toHaveAttribute('aria-describedby');
      await expect(page.getByText('A valid email address is required')).toHaveCount(0);
      await expect(page.getByText(`Password must be at least ${LOGIN_PASSWORD_MIN_LENGTH} characters`)).toBeVisible();
    });
  });

  test('Signup form validation', async ({ page, authenticationPage }) => {
    // Invalid email - with the two-step flow (email → continue → registration fields),
    // an invalid email prevents the form from advancing so only email validation can be tested here.
    await authenticationPage.submitSignUpEmailStep('inva lid @email.com');
    await expect(authenticationPage.emailInput).toHaveAttribute('aria-invalid', 'true');
    await expect(authenticationPage.emailInput).toHaveAttribute('aria-describedby');
    await expect(page.getByText('A valid email address is required')).toBeVisible();

    // Invalid password - too short
    await authenticationPage.fillOutSignUpForm('invalid@email.com', 'Test Person', 'pwd', 'pwd');
    await expect(authenticationPage.emailInput).toHaveAttribute('aria-invalid', 'false');
    await expect(authenticationPage.emailInput).not.toHaveAttribute('aria-describedby');
    await expect(authenticationPage.fullNameInput).toHaveAttribute('aria-invalid', 'false');
    await expect(authenticationPage.fullNameInput).not.toHaveAttribute('aria-describedby');
    await expect(page.getByText('A valid email address is required')).toHaveCount(0);
    await expect(page.getByText('Name is required')).toHaveCount(0);
    await expect(page.getByText(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`)).toHaveCount(2);

    // Invalid password - do not match, one too short
    await authenticationPage.fillOutSignUpForm('invalid@email.com', 'Test Person', 'pwd', 'Pwdabc1234533232');
    await expect(authenticationPage.emailInput).toHaveAttribute('aria-invalid', 'false');
    await expect(authenticationPage.emailInput).not.toHaveAttribute('aria-describedby');
    await expect(authenticationPage.fullNameInput).toHaveAttribute('aria-invalid', 'false');
    await expect(authenticationPage.fullNameInput).not.toHaveAttribute('aria-describedby');
    await expect(page.getByText('A valid email address is required')).toHaveCount(0);
    await expect(page.getByText('Name is required')).toHaveCount(0);
    await expect(page.getByText(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`)).toBeVisible();
    await expect(page.getByText('Passwords do not match')).toBeVisible();

    // Invalid password - do not match
    await authenticationPage.fillOutSignUpForm('invalid@email.com', 'Test Person', 'PWDabc1234533232', 'pWdabc1234533232');
    await expect(authenticationPage.emailInput).toHaveAttribute('aria-invalid', 'false');
    await expect(authenticationPage.emailInput).not.toHaveAttribute('aria-describedby');
    await expect(authenticationPage.fullNameInput).toHaveAttribute('aria-invalid', 'false');
    await expect(authenticationPage.fullNameInput).not.toHaveAttribute('aria-describedby');
    await expect(page.getByText('A valid email address is required')).toHaveCount(0);
    await expect(page.getByText('Name is required')).toHaveCount(0);
    await expect(page.getByText(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`)).toHaveCount(0);
    await expect(page.getByText('Passwords do not match')).toBeVisible();
  });

  test('showing and hiding password', async ({ page, authenticationPage }) => {
    const PASSWORD = 'pwd';
    await authenticationPage.fillOutLoginForm('email@test.com', PASSWORD);

    let typeAttribute = authenticationPage.passwordInput;
    await expect(typeAttribute).toHaveAttribute('type', 'password');
    await expect(authenticationPage.passwordInput).toHaveValue(PASSWORD);

    await authenticationPage.showHidePasswordButton.click();
    typeAttribute = authenticationPage.passwordInput;
    await expect(typeAttribute).toHaveAttribute('type', 'text');
    await expect(authenticationPage.passwordInput).toHaveValue(PASSWORD);

    await authenticationPage.showHidePasswordButton.click();
    typeAttribute = authenticationPage.passwordInput;
    await expect(typeAttribute).toHaveAttribute('type', 'password');
    await expect(authenticationPage.passwordInput).toHaveValue(PASSWORD);
  });

  test('Password strength meter on signup', async ({ page, authenticationPage }) => {
    await authenticationPage.goToSignUp();

    const testEmail = 'test@example.com';

    // Fill email and click Continue to reveal the full registration form
    await authenticationPage.emailInput.fill(testEmail);
    await authenticationPage.continueButton.click();

    await test.step('Weak password - missing requirements', async () => {
      await authenticationPage.emailInput.fill(testEmail);
      await authenticationPage.fullNameInput.fill('Test User');
      await authenticationPage.passwordInput.fill('weak');
      await authenticationPage.confirmPasswordInput.fill('weak');

      // Strength indicator should show "Weak"
      await expect(page.getByText('Weak')).toBeVisible();

      // Requirements checklist should show failures
      await expect(page.getByText(`At least ${PASSWORD_MIN_LENGTH} characters`)).toBeVisible();
      await expect(page.getByText('At least one uppercase letter (A-Z)')).toBeVisible();
      await expect(page.getByText('At least one number or special character (0-9 or !@#$%^&*)')).toBeVisible();
    });

    await test.step('Fair password - meets basic requirements', async () => {
      await authenticationPage.passwordInput.fill('Password123');
      await authenticationPage.confirmPasswordInput.fill('Password123');

      // Strength indicator should show "Fair" or better
      const strengthText = page.locator('text=/^(Weak|Fair|Good|Strong)$/');
      await expect(strengthText).toBeVisible();

      // All required checkmarks should be visible
      await expect(page.getByText(`At least ${PASSWORD_MIN_LENGTH} characters`)).toBeVisible();
      await expect(page.getByText('At least one uppercase letter (A-Z)')).toBeVisible();
      await expect(page.getByText('At least one lowercase letter (a-z)')).toBeVisible();
      await expect(page.getByText('At least one number or special character (0-9 or !@#$%^&*)')).toBeVisible();
    });

    await test.step('Good password - longer with variety', async () => {
      await authenticationPage.passwordInput.fill('GoodPassword123!');
      await authenticationPage.confirmPasswordInput.fill('GoodPassword123!');

      // Strength should be "Good" or "Strong"
      const strengthText = page.locator('text=/^(Good|Strong)$/');
      await expect(strengthText).toBeVisible();
    });

    await test.step('Strong password - long with all character types', async () => {
      await authenticationPage.passwordInput.fill('VeryStr0ngP@ssw0rd!2024');
      await authenticationPage.confirmPasswordInput.fill('VeryStr0ngP@ssw0rd!2024');

      // Strength should be "Strong"
      await expect(page.getByText('Strong')).toBeVisible();
    });

    await test.step('Password mismatch validation', async () => {
      await authenticationPage.passwordInput.fill('Password123!');
      await authenticationPage.confirmPasswordInput.fill('DifferentPassword123!');

      // "Passwords Match" requirement should fail
      await expect(page.getByText('Passwords Match')).toBeVisible();
    });

    await test.step('Password with repeating characters', async () => {
      await authenticationPage.passwordInput.fill('Aaaaa123456!');
      await authenticationPage.confirmPasswordInput.fill('Aaaaa123456!');

      // Should show error about repeating characters
      await expect(page.getByText('No more than 3 repeating characters')).toBeVisible();
    });

    await test.step('Password with keyboard pattern warning', async () => {
      await authenticationPage.passwordInput.fill('Qwerty123456!');
      await authenticationPage.confirmPasswordInput.fill('Qwerty123456!');

      // Should show warning about keyboard pattern
      await expect(page.getByText('Password contains a common keyboard pattern')).toBeVisible();
    });

    await test.step('Password contains email validation', async () => {
      const emailUsername = testEmail.split('@')[0]; // "test"
      await authenticationPage.passwordInput.fill(`${emailUsername}Password123!`);
      await authenticationPage.confirmPasswordInput.fill(`${emailUsername}Password123!`);

      // Should show error that password contains email or name (only validates after submit)
      await authenticationPage.signUpButton.click();
      await expect(page.getByText('Password cannot contain your name or email address')).toBeVisible();
    });

    await test.step('Valid password with all requirements met', async () => {
      await authenticationPage.passwordInput.fill('ValidPassword123!');
      await authenticationPage.confirmPasswordInput.fill('ValidPassword123!');

      // All requirements should be met (shown with checkmarks)
      await expect(authenticationPage.passwordInput).toHaveAttribute('aria-invalid', 'false');
      await expect(authenticationPage.confirmPasswordInput).toHaveAttribute('aria-invalid', 'false');

      // No error messages should be visible
      await expect(page.getByText(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long`)).toHaveCount(0);
      await expect(page.getByText('Password must be at most 255 characters')).toHaveCount(0);
      await expect(page.getByText('Password cannot contain your email address')).toHaveCount(0);
    });
  });
});

// test('Password reset form should be validated', async ({ page, authenticationPage }) => {
//   // TODO: ensure invalid password input is not accepted
// });

// test('MFA form should be validated', async ({ page, authenticationPage }) => {
//   // TODO: ensure invalid password input is not accepted
// });
