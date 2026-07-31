import {
  countEmailLogEntries,
  countExternalTokensForUser,
  getLatestEmailChangeRequest,
  getPendingEmailChangeRequest,
  getUserByEmail,
  getUserSessionsByEmail,
  ProfilePage,
  verifyEmailLogEntryExists,
} from '@jetstream/test/e2e-utils';
import { expect, test } from '../../fixtures/fixtures';

test.describe.configure({ mode: 'parallel' });

// Every test here signs up its own user, so the stored authenticated session must be cleared -
// otherwise the landing page renders logged-in and the sign-up link is never present.
test.use({ storageState: { cookies: [], origins: [] } });

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
}

/**
 * Covers the wiring only - HTTP routes, the step-up prompt, the landing pages, session revocation
 * and the outbound emails. The state machine itself (expiry, single use, address taken, the
 * once-per-24-hours rule, SSO policy) is exercised far more cheaply in
 * libs/auth/server/src/lib/__tests__/email-change.db.service.spec.ts, so it is deliberately not
 * repeated here - each of these tests costs a full sign-up.
 *
 * ProfilePage is constructed directly rather than taken from the `profilePage` fixture: that fixture
 * calls selectDefaultOrg(), which needs the shared E2E account and a connected Salesforce org. These
 * tests sign up a brand new user who has neither - and the profile page does not need an org anyway.
 */
test.describe('Email Address Change', () => {
  test.beforeEach(async ({ page, authenticationPage }) => {
    await page.goto('/');
    await authenticationPage.acceptCookieBanner();
  });

  test('changes the email address end to end', async ({ page, authenticationPage, playwrightPage }) => {
    const { email: oldEmail, password } = await authenticationPage.signUpAndVerifyEmail();
    const newEmail = uniqueEmail('changed');
    const { id: userId } = await getUserByEmail(oldEmail);
    const profilePage = new ProfilePage(page, playwrightPage);

    const { confirmToken } = await test.step('Request the change', async () => {
      await profilePage.goToProfilePage();
      const tokens = await profilePage.requestEmailChangeAndCaptureTokens(newEmail, password);
      expect(tokens.confirmToken).toBeTruthy();

      // Both mailboxes are notified: the new one to prove ownership, the old one so the account
      // holder can spot - and stop - a change they did not make.
      await verifyEmailLogEntryExists(newEmail, 'Confirm your new Jetstream email address');
      await verifyEmailLogEntryExists(oldEmail, 'A change to your Jetstream email address was requested');

      const pending = await getPendingEmailChangeRequest(userId);
      expect(pending?.newEmail).toBe(newEmail.toLowerCase());
      // Only hashes are persisted - a database or backup disclosure must not hand over live tokens.
      expect(pending?.confirmTokenHash).toHaveLength(64);
      expect(pending?.confirmTokenHash).not.toBe(tokens.confirmToken);

      await expect(profilePage.pendingEmailChangeBanner).toBeVisible();
      return tokens;
    });

    await test.step('Confirm from the emailed link', async () => {
      // The emailed link lands on a page that only renders; nothing changes until an explicit click,
      // so a mail scanner following the URL cannot complete the change.
      await page.goto(`/auth/email-change/confirm?code=${encodeURIComponent(confirmToken)}`);
      expect((await getUserByEmail(oldEmail)).email).toBe(oldEmail.toLowerCase());

      await page.getByRole('button', { name: 'Confirm email change' }).click();
      await expect(page.getByRole('link', { name: 'Go to sign in' })).toBeVisible();
    });

    await test.step('Change is applied and every session is revoked', async () => {
      const updated = await getUserByEmail(newEmail);
      expect(updated.id).toBe(userId);
      expect(updated.emailVerified).toBe(true);
      await expect(getUserByEmail(oldEmail)).rejects.toBeTruthy();

      expect(await getUserSessionsByEmail(newEmail)).toHaveLength(0);
      expect(await countExternalTokensForUser(userId)).toBe(0);

      const completed = await getLatestEmailChangeRequest(userId);
      expect(completed?.status).toBe('COMPLETED');
      expect(completed?.resolvedVia).toBe('EMAIL_LINK');
      // The factor that authorized the request is recorded for the audit trail.
      expect(completed?.stepUpMethod).toBe('password');
    });

    await test.step('The account is intact under the new address', async () => {
      await authenticationPage.goToLogin();
      await authenticationPage.loginAndVerifyEmail(newEmail, password);
    });
  });

  test('cancels a pending change from the link sent to the old address', async ({ page, authenticationPage, playwrightPage }) => {
    const { email: oldEmail, password } = await authenticationPage.signUpAndVerifyEmail();
    const newEmail = uniqueEmail('cancelled');
    const { id: userId } = await getUserByEmail(oldEmail);
    const profilePage = new ProfilePage(page, playwrightPage);

    await profilePage.goToProfilePage();
    const { confirmToken, cancelToken } = await profilePage.requestEmailChangeAndCaptureTokens(newEmail, password);

    await page.goto(`/auth/email-change/cancel?code=${encodeURIComponent(cancelToken)}`);
    await page.getByRole('button', { name: 'Cancel email change' }).click();
    await expect(page.getByRole('link', { name: 'Go to sign in' })).toBeVisible();

    expect((await getLatestEmailChangeRequest(userId))?.status).toBe('CANCELLED');
    expect((await getUserByEmail(oldEmail)).email).toBe(oldEmail.toLowerCase());

    // The confirm token is dead once the request is cancelled.
    await page.goto(`/auth/email-change/confirm?code=${encodeURIComponent(confirmToken)}`);
    await page.getByRole('button', { name: 'Confirm email change' }).click();
    expect((await getUserByEmail(oldEmail)).email).toBe(oldEmail.toLowerCase());
    expect((await getLatestEmailChangeRequest(userId))?.status).toBe('CANCELLED');
  });

  test('cancels a pending change from the profile page', async ({ page, authenticationPage, playwrightPage }) => {
    const { email: oldEmail, password } = await authenticationPage.signUpAndVerifyEmail();
    const newEmail = uniqueEmail('ui-cancel');
    const { id: userId } = await getUserByEmail(oldEmail);
    const profilePage = new ProfilePage(page, playwrightPage);

    await profilePage.goToProfilePage();
    await profilePage.requestEmailChangeAndCaptureTokens(newEmail, password);
    await expect(profilePage.pendingEmailChangeBanner).toBeVisible();

    await profilePage.cancelEmailChangeButton.click();
    await page.getByRole('button', { name: 'Cancel change' }).click();

    await expect(profilePage.pendingEmailChangeBanner).toBeHidden();
    expect((await getLatestEmailChangeRequest(userId))?.status).toBe('CANCELLED');
  });

  test('does not reveal that the target address is already registered', async ({ page, authenticationPage, playwrightPage }) => {
    // The response must be indistinguishable from success and no mail may be sent, otherwise the
    // endpoint becomes an oracle for whether an address has an account.
    const { email: takenEmail } = await authenticationPage.signUpAndVerifyEmail();
    await playwrightPage.logout();

    const { email: attackerEmail, password } = await authenticationPage.signUpAndVerifyEmail();
    const { id: attackerId } = await getUserByEmail(attackerEmail);
    const profilePage = new ProfilePage(page, playwrightPage);

    await profilePage.goToProfilePage();
    const { confirmToken } = await profilePage.requestEmailChangeAndCaptureTokens(takenEmail, password);

    expect(confirmToken).toBeFalsy();
    expect(await getPendingEmailChangeRequest(attackerId)).toBeNull();

    const failed = await getLatestEmailChangeRequest(attackerId);
    expect(failed?.status).toBe('FAILED');
    expect(failed?.failureReason).toBe('EMAIL_IN_USE');

    // The victim's mailbox is untouched.
    expect(await countEmailLogEntries(takenEmail, 'Confirm your new Jetstream email address')).toBe(0);
  });
});
