import { MAX_VERIFICATION_ATTEMPTS } from '@jetstream/auth/server';
import { getPasswordResetToken, getUserSessionsByEmail, hasPasswordResetToken } from '@jetstream/test/e2e-utils';
import { expect, test } from '../../../fixtures/fixtures';

test.describe.configure({ mode: 'parallel' });

// Reset storage state for this file to avoid being authenticated
test.use({ storageState: { cookies: [], origins: [] } });

const BAD_CODE = '000000';
const BAD_RESET_TOKEN = '00000000-0000-0000-0000-000000000000';

const invalidVerificationMessage = 'Your verification token is invalid.';
const tooManyVerificationAttemptsMessage = 'Too many incorrect attempts. Please sign in again to request a new code.';
const invalidResetTokenMessage = 'Your reset token is invalid, Restart the reset process.';

test.describe('Verification attempt limits', () => {
  test.beforeEach(async ({ page, authenticationPage }) => {
    await page.goto('/');
    await authenticationPage.acceptCookieBanner();
  });

  test('Destroys session after MAX failed codes on /auth/verify', async ({ page, authenticationPage }) => {
    const { email } = await authenticationPage.signUpWithoutEmailVerification();

    // Sanity check: a pending verification exists for this user
    const sessionsBefore = await getUserSessionsByEmail(email);
    const pendingBefore = sessionsBefore.find((session) => session.pendingVerification?.length)?.pendingVerification || [];
    expect(pendingBefore.length).toBeGreaterThan(0);

    // Submit MAX-1 bad codes — each should show the generic invalid-token message.
    for (let attempt = 1; attempt < MAX_VERIFICATION_ATTEMPTS; attempt++) {
      await authenticationPage.verificationCodeInput.fill(BAD_CODE);
      await authenticationPage.continueButton.click();
      await expect(page.getByText(invalidVerificationMessage)).toBeVisible();
    }

    // Final attempt trips the session-scoped budget: session is destroyed and the
    // TooManyVerificationAttempts message is surfaced.
    await authenticationPage.verificationCodeInput.fill(BAD_CODE);
    await authenticationPage.continueButton.click();
    await expect(page.getByText(tooManyVerificationAttemptsMessage)).toBeVisible();

    // Session should no longer carry a pendingVerification for this user.
    const sessionsAfter = await getUserSessionsByEmail(email);
    const pendingAfter = sessionsAfter.flatMap((session) => session.pendingVerification || []);
    expect(pendingAfter).toHaveLength(0);
  });

  test('Resending a verification code resets the attempt counter', async ({ page, authenticationPage }) => {
    await authenticationPage.signUpWithoutEmailVerification();

    // Burn MAX-1 attempts — one more would lock out the session.
    for (let attempt = 1; attempt < MAX_VERIFICATION_ATTEMPTS; attempt++) {
      await authenticationPage.verificationCodeInput.fill(BAD_CODE);
      await authenticationPage.continueButton.click();
      await expect(page.getByText(invalidVerificationMessage)).toBeVisible();
    }

    // Resend should reset pendingVerificationAttempts back to 0. The resend CTA hides itself
    // after a successful send (the component's hasResent state gates the form) — we use that
    // as the signal that the request completed.
    const resendButton = page.getByRole('button', { name: 'Send a new code' });
    await resendButton.click();
    await expect(resendButton).toBeHidden();

    // The next bad code should still show the generic message — not the lockout — because
    // the counter was reset. Previously this attempt would have been the "nth failure" that
    // destroyed the session.
    await authenticationPage.verificationCodeInput.fill(BAD_CODE);
    await authenticationPage.continueButton.click();
    await expect(page.getByText(invalidVerificationMessage)).toBeVisible();
    await expect(page.getByText(tooManyVerificationAttemptsMessage)).toBeHidden();
  });

  test('Invalidates reset token after MAX failed password-reset submissions', async ({ page, authenticationPage, playwrightPage }) => {
    const { email } = await authenticationPage.signUpAndVerifyEmail();
    await playwrightPage.logout();

    await authenticationPage.goToPasswordReset();
    await authenticationPage.fillOutResetPasswordForm(email);
    // Wait for the confirmation message so the POST that creates the reset-token row has
    // completed before we query the DB — otherwise the read races the request.
    await expect(
      page.getByText('You will receive an email with instructions if an account exists and is eligible for password reset.'),
    ).toBeVisible();

    // A reset token row should exist in the DB at this point.
    const issuedToken = await getPasswordResetToken(email);
    expect(issuedToken).toBeTruthy();

    const password = authenticationPage.generateTestPassword();

    // Submit MAX-1 bad tokens. Each submission reloads the verify page with the bad code so the
    // form defaults are a fresh non-matching token. After submit, the page redirects back to the
    // verify URL with an `error=` query param — we wait for the redirect each iteration.
    for (let attempt = 1; attempt < MAX_VERIFICATION_ATTEMPTS; attempt++) {
      await authenticationPage.goToPasswordResetVerify({ email, code: BAD_RESET_TOKEN });
      await authenticationPage.fillOutResetPasswordVerifyForm(password, password);
      // After a bad-token error the form clears the email/code query params, leaving only ?error=…
      await page.waitForURL(/\/auth\/(password-reset\/verify|login).*[?&]error=/);
      // Token row must still exist until the final attempt trips the budget.
      expect(await hasPasswordResetToken(email, issuedToken!.token)).toBe(true);
    }

    // Final submission trips the DB-level attempt budget and deletes the row.
    await authenticationPage.goToPasswordResetVerify({ email, code: BAD_RESET_TOKEN });
    await authenticationPage.fillOutResetPasswordVerifyForm(password, password);
    await page.waitForURL(/\/auth\/(password-reset\/verify|login).*[?&]error=/);

    expect(await hasPasswordResetToken(email, issuedToken!.token)).toBe(false);

    // Even the correct token no longer works — the row is gone, so the server treats it as invalid.
    await authenticationPage.goToPasswordResetVerify({ email, code: issuedToken!.token });
    await authenticationPage.fillOutResetPasswordVerifyForm(password, password);
    await expect(page.getByText(invalidResetTokenMessage)).toBeVisible();
  });
});
