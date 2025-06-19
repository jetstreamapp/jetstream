import { getDefaultProfile } from '@jetstream/test/e2e-utils';
import { expect, test } from '../../fixtures/fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/app');
});

test.describe.configure({ mode: 'serial' });

test.describe('Profile', () => {
  test('Login Options', async ({ page, profilePage }) => {
    await test.step('Default configuration when 2fa is not enabled', async () => {
      const profile = getDefaultProfile();
      profile.authFactors = [];
      profile.identities = [];
      profile.hasPasswordSet = true;
      await profilePage.overrideProfile(profile);

      await profilePage.goToProfilePage();

      await expect(page.getByRole('button', { name: 'Password Options' })).toBeVisible();

      await expect(page.getByRole('button', { name: 'Google Link Google Account' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Salesforce Link Salesforce' })).toBeVisible();
    });

    await test.step('Default configuration when 2fa is enabled', async () => {
      const profile = getDefaultProfile();
      profile.authFactors = [
        { type: '2fa-email', enabled: true },
        { type: '2fa-otp', enabled: true },
      ];
      profile.identities = [];
      profile.hasPasswordSet = true;
      await profilePage.overrideProfile(profile);

      await profilePage.overrideLoginConfiguration({
        isPasswordAllowed: true,
        isGoogleAllowed: true,
        isSalesforceAllowed: true,
        requireMfa: false,
        allowIdentityLinking: true,
        allowedMfaMethods: {
          email: true,
          otp: true,
        },
      });

      page.reload();
      await expect(page.getByText('Test User')).toBeVisible();

      await expect(page.getByRole('button', { name: 'Password Options' })).toBeVisible();

      await expect(page.getByRole('heading', { name: 'Authenticator App Active' }).locator('span')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Email Active' }).locator('span')).toBeVisible();

      await page.getByTestId('mfa-email-menu-button').click();
      await expect(page.getByRole('menuitem', { name: 'Disable' })).toBeVisible();
      await page.getByTestId('mfa-email-menu-button').click();

      await page.getByTestId('mfa-totp-menu-button').click();
      await expect(page.getByRole('menuitem', { name: 'Disable' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
      await page.getByTestId('mfa-totp-menu-button').click();

      await expect(page.getByRole('button', { name: 'Google Link Google Account' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Salesforce Link Salesforce' })).toBeVisible();
    });

    await test.step('Email 2FA is disabled + login with Salesforce is required', async () => {
      const profile = getDefaultProfile();
      profile.authFactors = [{ type: '2fa-otp', enabled: true }];
      await profilePage.overrideProfile(profile);
      await profilePage.overrideLoginConfiguration({
        isPasswordAllowed: false,
        isGoogleAllowed: false,
        isSalesforceAllowed: true,
        requireMfa: true,
        allowIdentityLinking: true,
        allowedMfaMethods: {
          email: false,
          otp: true,
        },
      });

      page.reload();
      await expect(page.getByText('Test User')).toBeVisible();

      // eslint-disable-next-line playwright/prefer-web-first-assertions
      expect(await page.getByRole('button', { name: 'Password Options' }).isVisible()).toBe(false);

      await expect(page.getByText('This authentication factor is')).toHaveCount(1);

      await expect(page.getByRole('heading', { name: 'Linked Accounts' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Salesforce Link Salesforce' })).toBeVisible();
      // eslint-disable-next-line playwright/prefer-web-first-assertions
      expect(await page.getByRole('button', { name: 'Google Link Google Account' }).isVisible()).toBe(false);
    });

    await test.step('Email 2FA is disabled + login with Google is required', async () => {
      const profile = getDefaultProfile();
      profile.authFactors = [{ type: '2fa-otp', enabled: true }];
      await profilePage.overrideProfile(profile);
      await profilePage.overrideLoginConfiguration({
        isPasswordAllowed: false,
        isGoogleAllowed: true,
        isSalesforceAllowed: false,
        requireMfa: true,
        allowIdentityLinking: true,
        allowedMfaMethods: {
          email: false,
          otp: true,
        },
      });

      page.reload();
      await expect(page.getByText('Test User')).toBeVisible();

      // eslint-disable-next-line playwright/prefer-web-first-assertions
      expect(await page.getByRole('button', { name: 'Password Options' }).isVisible()).toBe(false);

      await expect(page.getByText('This authentication factor is')).toHaveCount(1);

      await expect(page.getByRole('heading', { name: 'Linked Accounts' })).toBeVisible();
      // eslint-disable-next-line playwright/prefer-web-first-assertions
      expect(await page.getByRole('button', { name: 'Salesforce Link Salesforce' }).isVisible()).toBe(false);
      await expect(page.getByRole('button', { name: 'Google Link Google Account' })).toBeVisible();
    });

    await test.step('Identity linking is disabled', async () => {
      const profile = getDefaultProfile();
      profile.authFactors = [{ type: '2fa-otp', enabled: true }];
      await profilePage.overrideProfile(profile);
      await profilePage.overrideLoginConfiguration({
        isPasswordAllowed: false,
        isGoogleAllowed: true,
        isSalesforceAllowed: true,
        requireMfa: true,
        allowIdentityLinking: false,
        allowedMfaMethods: {
          email: false,
          otp: true,
        },
      });

      page.reload();
      await expect(page.getByText('Test User')).toBeVisible();

      // eslint-disable-next-line playwright/prefer-web-first-assertions
      expect(await page.getByRole('button', { name: 'Password Options' }).isVisible()).toBe(false);

      await expect(page.getByText('This authentication factor is')).toHaveCount(1);

      // eslint-disable-next-line playwright/prefer-web-first-assertions
      expect(await page.getByRole('heading', { name: 'Linked Accounts' }).isVisible()).toBe(false);
      // eslint-disable-next-line playwright/prefer-web-first-assertions
      expect(await page.getByRole('button', { name: 'Salesforce Link Salesforce' }).isVisible()).toBe(false);
      // eslint-disable-next-line playwright/prefer-web-first-assertions
      expect(await page.getByRole('button', { name: 'Google Link Google Account' }).isVisible()).toBe(false);
    });

    await test.step('Email 2FA is disabled + login with Password is required', async () => {
      const profile = getDefaultProfile();
      profile.authFactors = [{ type: '2fa-otp', enabled: true }];
      await profilePage.overrideProfile(profile);
      await profilePage.overrideLoginConfiguration({
        isPasswordAllowed: true,
        isGoogleAllowed: false,
        isSalesforceAllowed: false,
        requireMfa: true,
        allowIdentityLinking: true,
        allowedMfaMethods: {
          email: false,
          otp: true,
        },
      });

      page.reload();
      await expect(page.getByText('Test User')).toBeVisible();

      // eslint-disable-next-line playwright/prefer-web-first-assertions
      expect(await page.getByRole('button', { name: 'Password Options' }).isVisible()).toBe(false);

      await expect(page.getByText('This authentication factor is')).toHaveCount(1);

      // eslint-disable-next-line playwright/prefer-web-first-assertions
      expect(await page.getByRole('heading', { name: 'Linked Accounts' }).isVisible()).toBe(false);
      // eslint-disable-next-line playwright/prefer-web-first-assertions
      expect(await page.getByRole('button', { name: 'Salesforce Link Salesforce' }).isVisible()).toBe(false);
      // eslint-disable-next-line playwright/prefer-web-first-assertions
      expect(await page.getByRole('button', { name: 'Google Link Google Account' }).isVisible()).toBe(false);
    });
  });

  // test('Sessions', async ({ page, profilePage }) => {});
  // test('Recent Activity', async ({ page, profilePage }) => {});
});
