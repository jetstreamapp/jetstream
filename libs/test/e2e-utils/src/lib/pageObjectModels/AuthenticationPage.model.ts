import { prisma } from '@jetstream/api-config';
import { expect, Locator, Page } from '@playwright/test';
import { randomBytes } from 'crypto';
import {
  getPasswordResetToken,
  getUserSessionByEmail,
  getUserSessionsByEmail,
  hasPasswordResetToken,
  verifyEmailLogEntryExists,
} from '../e2e-database-validation.utils';

export class AuthenticationPage {
  readonly page: Page;

  readonly routes = {
    signup: (wildcard = false) => `/auth/signup/${wildcard ? '*' : ''}`,
    login: (wildcard = false) => `/auth/login/${wildcard ? '*' : ''}`,
    passwordReset: (wildcard = false) => `/auth/password-reset/${wildcard ? '*' : ''}`,
    passwordResetVerify: (wildcard = false) => `/auth/password-reset/verify/${wildcard ? '*' : ''}`,
    mfaVerify: (wildcard = false) => `/auth/verify/${wildcard ? '*' : ''}`,
  } as const;

  readonly signInFromHomePageButton: Locator;
  readonly signUpFromHomePageButton: Locator;
  readonly signUpCtaFromHomePageButton: Locator;

  readonly signInFromFormLink: Locator;
  readonly signUpFromFormLink: Locator;
  readonly loginPageFromPasswordReset: Locator;

  readonly signInButton: Locator;
  readonly signUpButton: Locator;
  readonly submitButton: Locator;
  readonly continueButton: Locator;

  readonly showHidePasswordButton: Locator;
  readonly forgotPasswordLink: Locator;

  readonly googleAuthButton: Locator;
  readonly salesforceAuthButton: Locator;

  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly newPasswordInput: Locator;
  readonly fullNameInput: Locator;
  readonly verificationCodeInput: Locator;
  readonly rememberDeviceInput: Locator;

  readonly mfaTotpMenuButton: Locator;
  readonly mfaEmailMenuButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.signInFromHomePageButton = page.getByRole('link', { name: 'Log in' });
    this.signUpFromHomePageButton = page.getByRole('link', { name: 'Sign up', exact: true });
    this.signUpCtaFromHomePageButton = page.getByRole('link', { name: 'Get started for free' }).first();

    this.signUpFromFormLink = page.getByText('Need to register? Sign up').getByRole('link', { name: 'Sign up' });
    this.signInFromFormLink = page.getByText('Already have an account? Login').getByRole('link', { name: 'Login' });
    this.loginPageFromPasswordReset = page.getByRole('link', { name: 'Go to Login Page' });

    this.signInButton = page.getByRole('button', { name: 'Sign in' });
    this.signUpButton = page.getByRole('button', { name: 'Sign up' });
    this.continueButton = page.getByRole('button', { name: 'Continue' });
    this.submitButton = page.getByRole('button', { name: 'Submit' });

    this.showHidePasswordButton = page.getByRole('button', { name: /(Show|Hide) Password/ });
    this.forgotPasswordLink = page.getByRole('link', { name: 'Forgot password?' });
    this.googleAuthButton = page.getByRole('button', { name: 'Google Logo Google' });
    this.salesforceAuthButton = page.getByRole('button', { name: 'Salesforce Logo Salesforce' });

    this.emailInput = page.getByLabel('Email Address');
    this.fullNameInput = page.getByLabel('Full Name');
    this.passwordInput = page.getByLabel('Password', { exact: true });
    this.newPasswordInput = page.getByLabel('New Password');
    this.confirmPasswordInput = page.getByLabel('Confirm Password');
    this.verificationCodeInput = page.getByLabel('Verification Code');
    this.rememberDeviceInput = page.getByLabel('Remember this device');

    this.mfaTotpMenuButton = page.getByTestId('mfa-totp-menu-button');
    this.mfaEmailMenuButton = page.getByTestId('mfa-email-menu-button');
  }

  async acceptCookieBanner(page = this.page) {
    const cookieBanner = page.getByText('We use cookies to improve');
    const cookieBannerAcceptButton = page.getByRole('button', { name: 'Accept' });

    if (await cookieBanner.isVisible()) {
      await cookieBannerAcceptButton.click();
    } else {
      console.log('Element not visible, skipping click.');
    }
  }

  async goToSignUp(viaHomePage = true) {
    if (viaHomePage) {
      await this.page.goto('/');
      await this.signUpFromHomePageButton.click();
    } else {
      await this.page.goto(this.routes.signup());
    }
  }

  async goToLogin(viaHomePage = true) {
    if (viaHomePage) {
      await this.page.goto('/');
      await this.signInFromHomePageButton.click();
    } else {
      await this.page.goto(this.routes.login());
    }
  }

  async goToPasswordReset() {
    await this.page.goto(this.routes.passwordReset());
  }

  async goToPasswordResetVerify(params?: { email: string; code: string }) {
    await this.page.goto(`${this.routes.passwordResetVerify()}?${new URLSearchParams(params).toString()}`);
  }

  async goToMfaVerify() {
    await this.page.goto(this.routes.mfaVerify());
  }

  generateTestEmail(domain = 'playwright.getjetstream.app') {
    return `test-${new Date().getTime()}.${randomBytes(8).toString('hex')}@${domain}`;
  }

  generateTestName() {
    return `Test User ${new Date().getTime()}${randomBytes(8).toString('hex')}`;
  }

  generateTestPassword() {
    return `PWD-${new Date().getTime()}!${randomBytes(8).toString('hex')}`;
  }

  async signUpWithoutEmailVerification(emailOverride?: string, initialLoginPage?: string) {
    const email = emailOverride || this.generateTestEmail();
    const name = this.generateTestName();
    const password = this.generateTestPassword();

    await this.fillOutSignUpForm(email, name, password, password, initialLoginPage);

    await expect(this.page.getByText('Verify your email address')).toBeVisible();

    // ensure email verification was sent
    await verifyEmailLogEntryExists(email, 'Verify your email');

    return {
      email,
      name,
      password,
    };
  }

  async signUpAndVerifyEmail(emailOverride?: string, initialLoginPage?: string) {
    const { email, name, password } = await this.signUpWithoutEmailVerification(emailOverride, initialLoginPage);

    // ensure email verification was sent
    await verifyEmailLogEntryExists(email, 'Verify your email');

    // Get token from session
    const sessions = await getUserSessionsByEmail(email);
    const pendingVerification = sessions.find((session) => session.pendingVerification?.length)?.pendingVerification || [];

    await expect(pendingVerification).toHaveLength(1);

    if (pendingVerification[0].type !== 'email') {
      throw new Error('Expected email verification');
    }
    const { token } = pendingVerification[0];

    await this.verificationCodeInput.fill(token);
    await this.continueButton.click();

    await this.page.waitForURL(`**/app/**`);

    await verifyEmailLogEntryExists(email, 'Welcome to Jetstream');

    return {
      email,
      name,
      password,
    };
  }

  async signUpAndVerifyEmailPauseBeforeEnrollInOtp(emailOverride?: string, initialLoginPage?: string) {
    const { email, name, password } = await this.signUpWithoutEmailVerification(emailOverride, initialLoginPage);

    // ensure email verification was sent
    await verifyEmailLogEntryExists(email, 'Verify your email');

    // Get token from session
    const sessions = await getUserSessionsByEmail(email);
    const pendingVerification = sessions.find((session) => session.pendingVerification?.length)?.pendingVerification || [];

    await expect(pendingVerification).toHaveLength(1);

    if (pendingVerification[0].type !== 'email') {
      throw new Error('Expected email verification');
    }
    const { token } = pendingVerification[0];

    await this.verificationCodeInput.fill(token);
    await this.continueButton.click();

    // user should be prompted to enroll in TOTP
    await expect(this.page.getByRole('heading', { name: 'Scan the QR code with your' })).toBeVisible();

    return {
      email,
      name,
      password,
    };
  }

  async enrollInOtpForLoggedInUser() {
    const { decodeBase32IgnorePadding } = await import('@oslojs/encoding');
    const { generateTOTP } = await import('@oslojs/otp');
    // go to profile page
    await this.page.getByRole('button', { name: 'Avatar' }).click();
    await this.page.getByRole('menuitem', { name: 'Profile' }).click();
    // Setup TOTP MFA
    await this.page.getByRole('button', { name: 'Set Up' }).click();
    const secret = await this.page.getByTestId('totp-secret').innerText();
    // save a valid token
    await this.page.getByTestId('settings-page').getByRole('textbox').click();
    const code = await generateTOTP(decodeBase32IgnorePadding(secret), 30, 6);
    await this.page.getByTestId('settings-page').getByRole('textbox').fill(code);
    await this.page.getByRole('button', { name: 'Save' }).click();
    await expect(this.page.getByRole('heading', { name: 'Authenticator App Active' }).locator('span')).toBeVisible();

    return secret;
  }

  async enrollInOtp(email: string) {
    const { decodeBase32IgnorePadding } = await import('@oslojs/encoding');
    const { generateTOTP } = await import('@oslojs/otp');

    await expect(this.page.getByRole('heading', { name: 'Scan the QR code with your' })).toBeVisible();
    const { pendingMfaEnrollment } = await getUserSessionByEmail(email);
    expect(pendingMfaEnrollment?.factor).toBeTruthy();

    const secret = await this.page.getByTestId('totp-secret').textContent();
    const code = await generateTOTP(decodeBase32IgnorePadding(secret), 30, 6);

    await this.verificationCodeInput.fill(code);
    await this.continueButton.click();

    await this.page.waitForURL(`**/app/**`);

    return { secret };
  }

  async signUpAndVerifyEmailAndEnrollInOtp(emailOverride?: string, initialLoginPage?: string) {
    const { email, name, password } = await this.signUpAndVerifyEmailPauseBeforeEnrollInOtp(emailOverride, initialLoginPage);

    const { secret } = await this.enrollInOtp(email);

    await verifyEmailLogEntryExists(email, 'Welcome to Jetstream');

    return {
      email,
      name,
      password,
      secret,
    };
  }

  async loginAndVerifyEmail(email: string, password: string, rememberMe = false, waitForPage = '**/app/**') {
    await this.fillOutLoginForm(email, password);

    await expect(this.page.getByText('Enter verification code')).toBeVisible();
    await expect(this.page.getByText(email)).toBeVisible();

    // ensure email verification was sent
    await verifyEmailLogEntryExists(email, 'Verify your identity');

    await this.verifyEmail(email, rememberMe, waitForPage);
  }

  async loginAndVerifyTotp(email: string, password: string, secret: string, rememberMe = false) {
    await this.fillOutLoginForm(email, password);

    await expect(this.page.getByText('Enter your verification code from your authenticator app')).toBeVisible();

    await this.verifyTotp(email, secret, rememberMe);
  }

  async verifyEmail(email: string, rememberMe = false, waitForPage = '**/app/**') {
    // Get token from session
    const sessions = await getUserSessionsByEmail(email);
    const pendingVerification = sessions.find((session) => session.pendingVerification?.length)?.pendingVerification || [];

    await expect(pendingVerification).toHaveLength(1);

    if (pendingVerification.some(({ type }) => type !== '2fa-email' && type !== 'email')) {
      throw new Error('Expected email verification');
    }

    const { token } = pendingVerification[0] as { token: string };

    await this.verificationCodeInput.fill(token);
    if (rememberMe) {
      await this.rememberDeviceInput.check();
    }
    await this.continueButton.click();

    await this.page.waitForURL(waitForPage);
  }

  async verifyTotp(email: string, secret: string, rememberMe = false) {
    const { decodeBase32IgnorePadding } = await import('@oslojs/encoding');
    const { generateTOTP } = await import('@oslojs/otp');

    const code = await generateTOTP(decodeBase32IgnorePadding(secret), 30, 6);

    // Get token from session
    const sessions = await getUserSessionsByEmail(email);
    const pendingVerification = sessions.find((session) => session.pendingVerification?.length)?.pendingVerification || [];
    const pendingVerificationLength = pendingVerification.length;

    await expect(pendingVerificationLength).toBeGreaterThanOrEqual(1);

    if (pendingVerification[0].type !== '2fa-otp') {
      throw new Error('Expected totp verification as primary');
    }

    await this.verificationCodeInput.fill(code);

    if (rememberMe) {
      await this.rememberDeviceInput.check();
    } else {
      await this.rememberDeviceInput.uncheck();
    }

    await this.continueButton.click();

    await this.page.waitForURL(`**/app/**`);
  }

  async resetPassword(email: string) {
    const password = this.generateTestPassword();

    await this.goToPasswordReset();
    await this.fillOutResetPasswordForm(email);
    await expect(
      this.page.getByText('You will receive an email with instructions if an account exists and is eligible for password reset.'),
    ).toBeVisible();

    // ensure email verification was sent
    await prisma.emailActivity.findFirstOrThrow({ where: { email, subject: { contains: 'Reset your password' } } });
    const { token: code } = await getPasswordResetToken(email);

    await this.goToPasswordResetVerify({ email, code });

    await this.fillOutResetPasswordVerifyForm(password, password);

    const passwordResetToken = await hasPasswordResetToken(email, code);
    await expect(passwordResetToken).toBeFalsy();

    await this.fillOutLoginForm(email, password);
    // TODO: what about 2fa?

    await this.page.waitForURL(`**/app/**`);
  }

  async fillOutLoginForm(email: string, password: string) {
    await this.goToLogin();

    await expect(this.signUpFromFormLink).toBeVisible();
    await expect(this.forgotPasswordLink).toBeVisible();
    await expect(this.signInButton).toBeVisible();
    await expect(this.googleAuthButton).toBeVisible();
    await expect(this.salesforceAuthButton).toBeVisible();

    await this.emailInput.click();
    await this.emailInput.fill(email);

    await this.passwordInput.click();
    await this.passwordInput.fill(password);

    await this.signInButton.click();
  }

  async fillOutSignUpForm(email: string, name: string, password: string, confirmPassword: string, initialLoginPage?: string) {
    await this.goToSignUp();

    await this.page.goto(initialLoginPage || '/');
    await this.signUpFromHomePageButton.click();

    await expect(this.signInFromFormLink).toBeVisible();
    await expect(this.forgotPasswordLink).toBeVisible();
    await expect(this.signUpButton).toBeVisible();
    await expect(this.googleAuthButton).toBeVisible();
    await expect(this.salesforceAuthButton).toBeVisible();

    await this.emailInput.click();
    await this.emailInput.fill(email);

    await this.fullNameInput.click();
    await this.fullNameInput.fill(name);

    await this.passwordInput.click();
    await this.passwordInput.fill(password);

    await this.confirmPasswordInput.click();
    await this.confirmPasswordInput.fill(confirmPassword);

    await this.signUpButton.click();
  }

  async fillOutVerification(email: string, name: string, password: string, confirmPassword: string) {
    await this.passwordInput.click();
    await this.passwordInput.fill(password);

    await this.signUpButton.click();
  }

  async fillOutResetPasswordForm(email: string) {
    await this.page.goto('/');
    await this.signInFromHomePageButton.click();

    await this.forgotPasswordLink.click();

    await expect(this.loginPageFromPasswordReset).toBeVisible();
    await expect(this.submitButton).toBeVisible();

    await this.emailInput.click();
    await this.emailInput.fill(email);

    await this.submitButton.click();
  }

  async fillOutResetPasswordVerifyForm(password: string, confirmPassword: string) {
    await this.newPasswordInput.click();
    await this.newPasswordInput.fill(password);

    await this.confirmPasswordInput.click();
    await this.confirmPasswordInput.fill(confirmPassword);

    await this.submitButton.click();
  }

  async loginOrGoToAppIfLoggedIn(email: string, password: string) {
    const alreadyLoggedInBtn = this.page.getByRole('link', { name: 'Go to Jetstream' });

    if (await alreadyLoggedInBtn.isVisible()) {
      await alreadyLoggedInBtn.click();
    } else {
      await this.fillOutLoginForm(email, password);
    }
  }
}
