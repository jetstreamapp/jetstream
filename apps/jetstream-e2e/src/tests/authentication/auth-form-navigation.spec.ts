import { expect, test } from '../../fixtures/fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe.configure({ mode: 'parallel' });

// Reset storage state for this file to avoid being authenticated
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Auth Page Navigation', () => {
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
    // Invalid email and password
    await authenticationPage.fillOutLoginForm('inva lid @email.com', '');
    await expect(authenticationPage.emailInput).toHaveAttribute('aria-invalid', 'true');
    await expect(authenticationPage.emailInput).toHaveAttribute('aria-describedby');
    await expect(page.getByText('A valid email address is required')).toBeVisible();
    await expect(authenticationPage.passwordInput).toHaveAttribute('aria-invalid', 'true');
    await expect(authenticationPage.passwordInput).toHaveAttribute('aria-describedby');
    await expect(page.getByText('Password is required')).toBeVisible();

    // Invalid email
    await authenticationPage.fillOutLoginForm('test @email.com', 'password123');
    await expect(authenticationPage.emailInput).toHaveAttribute('aria-invalid', 'true');
    await expect(authenticationPage.emailInput).toHaveAttribute('aria-describedby');
    await expect(page.getByText('A valid email address is required')).toBeVisible();
    await expect(authenticationPage.passwordInput).toHaveAttribute('aria-invalid', 'false');
    await expect(authenticationPage.passwordInput).not.toHaveAttribute('aria-describedby');
    await expect(page.getByText('Password must be at least 8 characters')).toHaveCount(0);
    await expect(page.getByText('Password must be at least 8 characters')).toHaveCount(0);
    await expect(page.getByText('Password must be at most 255 characters')).toHaveCount(0);

    // Invalid password
    await authenticationPage.fillOutLoginForm('test@email.com', 'pwd');
    await expect(authenticationPage.emailInput).toHaveAttribute('aria-invalid', 'false');
    await expect(authenticationPage.emailInput).not.toHaveAttribute('aria-describedby');
    await expect(page.getByText('A valid email address is required')).toHaveCount(0);
    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();
  });

  test('Signup form validation', async ({ page, authenticationPage }) => {
    // Invalid email and password
    await authenticationPage.fillOutSignUpForm('inva lid @email.com', '', '', '');
    await expect(authenticationPage.emailInput).toHaveAttribute('aria-invalid', 'true');
    await expect(authenticationPage.emailInput).toHaveAttribute('aria-describedby');
    await expect(page.getByText('A valid email address is required')).toBeVisible();
    await expect(authenticationPage.fullNameInput).toHaveAttribute('aria-invalid', 'true');
    await expect(authenticationPage.fullNameInput).toHaveAttribute('aria-describedby');
    await expect(page.getByText('Name is required')).toBeVisible();
    await expect(authenticationPage.passwordInput).toHaveAttribute('aria-invalid', 'true');
    await expect(authenticationPage.passwordInput).toHaveAttribute('aria-describedby');
    await expect(page.getByText('Password is required')).toHaveCount(2);
    await expect(authenticationPage.confirmPasswordInput).toHaveAttribute('aria-invalid', 'true');
    await expect(authenticationPage.confirmPasswordInput).toHaveAttribute('aria-describedby');
    await expect(page.getByText('Password is required')).toHaveCount(2);

    // Invalid email
    await authenticationPage.fillOutSignUpForm('inva lid @email.com', 'Test Person', 'password123', 'password123');
    await expect(authenticationPage.emailInput).toHaveAttribute('aria-invalid', 'true');
    await expect(authenticationPage.emailInput).toHaveAttribute('aria-describedby');
    await expect(page.getByText('A valid email address is required')).toBeVisible();
    await expect(authenticationPage.fullNameInput).toHaveAttribute('aria-invalid', 'false');
    await expect(authenticationPage.fullNameInput).not.toHaveAttribute('aria-describedby');
    await expect(authenticationPage.passwordInput).toHaveAttribute('aria-invalid', 'false');
    await expect(authenticationPage.passwordInput).not.toHaveAttribute('aria-describedby');
    await expect(authenticationPage.confirmPasswordInput).toHaveAttribute('aria-invalid', 'false');
    await expect(authenticationPage.confirmPasswordInput).not.toHaveAttribute('aria-describedby');
    await expect(page.getByText('Name is required')).toHaveCount(0);
    await expect(page.getByText('Password must be at least 8 characters')).toHaveCount(0);
    await expect(page.getByText('Password must be at most 255 characters')).toHaveCount(0);

    // Invalid password - too short
    await authenticationPage.fillOutSignUpForm('invalid@email.com', 'Test Person', 'pwd', 'pwd');
    await expect(authenticationPage.emailInput).toHaveAttribute('aria-invalid', 'false');
    await expect(authenticationPage.emailInput).not.toHaveAttribute('aria-describedby');
    await expect(authenticationPage.fullNameInput).toHaveAttribute('aria-invalid', 'false');
    await expect(authenticationPage.fullNameInput).not.toHaveAttribute('aria-describedby');
    await expect(page.getByText('A valid email address is required')).toHaveCount(0);
    await expect(page.getByText('Name is required')).toHaveCount(0);
    await expect(page.getByText('Password must be at least 8 characters')).toHaveCount(2);

    // Invalid password - do not match, one too short
    await authenticationPage.fillOutSignUpForm('invalid@email.com', 'Test Person', 'pwd', 'pwdabc1234533232');
    await expect(authenticationPage.emailInput).toHaveAttribute('aria-invalid', 'false');
    await expect(authenticationPage.emailInput).not.toHaveAttribute('aria-describedby');
    await expect(authenticationPage.fullNameInput).toHaveAttribute('aria-invalid', 'false');
    await expect(authenticationPage.fullNameInput).not.toHaveAttribute('aria-describedby');
    await expect(page.getByText('A valid email address is required')).toHaveCount(0);
    await expect(page.getByText('Name is required')).toHaveCount(0);
    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();
    await expect(page.getByText('Passwords do not match')).toBeVisible();

    // Invalid password - do not match
    await authenticationPage.fillOutSignUpForm('invalid@email.com', 'Test Person', 'PWDabc1234533232', 'pwdabc1234533232');
    await expect(authenticationPage.emailInput).toHaveAttribute('aria-invalid', 'false');
    await expect(authenticationPage.emailInput).not.toHaveAttribute('aria-describedby');
    await expect(authenticationPage.fullNameInput).toHaveAttribute('aria-invalid', 'false');
    await expect(authenticationPage.fullNameInput).not.toHaveAttribute('aria-describedby');
    await expect(page.getByText('A valid email address is required')).toHaveCount(0);
    await expect(page.getByText('Name is required')).toHaveCount(0);
    await expect(page.getByText('Password must be at least 8 characters')).toHaveCount(0);
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
});

// test('Password reset form should be validated', async ({ page, authenticationPage }) => {
//   // TODO: ensure invalid password input is not accepted
// });

// test('MFA form should be validated', async ({ page, authenticationPage }) => {
//   // TODO: ensure invalid password input is not accepted
// });
