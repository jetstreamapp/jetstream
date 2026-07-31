import { LoginConfigurationUI, UserProfileUiWithIdentities } from '@jetstream/auth/types';
import { SoqlQueryFormatOptionsSchema } from '@jetstream/types';
import { APIRequestContext, Locator, Page } from '@playwright/test';
import { ApiRequestUtils } from '../ApiRequestUtils';
import { PlaywrightPage } from './PlaywrightPage.model';

export function getDefaultProfile() {
  const defaultProfile: UserProfileUiWithIdentities = {
    id: 'aaaaaaaa-0000-0000-0000-aaaaaaaaaaaa',
    userId: 'test|aaaaaaaa-0000-0000-0000-aaaaaaaaaaaa',
    name: 'Test User',
    email: 'test@example.com',
    emailVerified: true,
    picture: null,
    preferences: {
      id: '89311d69-04d9-4dde-9731-e85035f49d97',
      userId: 'aaaaaaaa-0000-0000-0000-aaaaaaaaaaaa',
      skipFrontdoorLogin: false,
      recordSyncEnabled: true,
      soqlQueryFormatOptions: SoqlQueryFormatOptionsSchema.parse({}),
      createdAt: new Date('2025-06-13T14:42:53.022Z'),
      updatedAt: new Date('2025-06-13T14:42:53.022Z'),
    },
    identities: [],
    authFactors: [
      { type: '2fa-email', enabled: true },
      { type: '2fa-otp', enabled: true },
    ],
    createdAt: new Date('2025-06-13T14:42:53.022Z'),
    updatedAt: new Date('2025-06-17T04:02:55.993Z'),
    hasPasswordSet: true,
    pendingEmailChange: null,
  };
  return defaultProfile;
}

export class ProfilePage {
  readonly apiRequestUtils: ApiRequestUtils;
  readonly playwrightPage: PlaywrightPage;
  readonly page: Page;
  readonly request: APIRequestContext;

  readonly addOrgButton: Locator;
  readonly orgDropdownContainer: Locator;
  readonly orgDropdown: Locator;
  readonly sobjectList: Locator;

  readonly emailChangeModal: Locator;
  readonly emailInput: Locator;
  readonly emailSendConfirmationButton: Locator;
  readonly pendingEmailChangeBanner: Locator;
  readonly cancelEmailChangeButton: Locator;
  readonly stepUpModal: Locator;
  readonly stepUpPasswordInput: Locator;
  readonly stepUpCodeInput: Locator;
  readonly stepUpVerifyButton: Locator;

  loginConfigurationOverride: LoginConfigurationUI;
  profileOverride: UserProfileUiWithIdentities;

  constructor(page: Page, playwrightPage: PlaywrightPage) {
    this.page = page;
    this.playwrightPage = playwrightPage;
    this.addOrgButton = page.getByRole('button', { name: 'Add Org' });
    this.orgDropdownContainer = page.getByTestId('orgs-combobox-container');
    this.orgDropdown = page.getByPlaceholder('Select an Org');

    this.emailChangeModal = page.getByTestId('email-change-modal');
    this.emailInput = page.locator('#new-email');
    this.emailSendConfirmationButton = page.getByRole('button', { name: 'Send confirmation' });
    this.pendingEmailChangeBanner = page.getByTestId('pending-email-change');
    this.cancelEmailChangeButton = page.getByRole('button', { name: 'Cancel request' });
    this.stepUpModal = page.getByTestId('step-up-auth-modal');
    this.stepUpPasswordInput = page.locator('#step-up-password');
    this.stepUpCodeInput = page.locator('#step-up-code');
    this.stepUpVerifyButton = page.getByRole('button', { name: 'Verify' });
  }

  /** The Email field only exposes an edit affordance when the account is allowed to change it. */
  async startEmailChange() {
    await this.page.getByRole('button', { name: 'Edit Email' }).click();
    await this.emailChangeModal.waitFor();
  }

  async submitNewEmail(newEmail: string) {
    await this.emailInput.fill(newEmail);
    await this.emailSendConfirmationButton.click();
  }

  async completeStepUpWithPassword(password: string) {
    await this.stepUpModal.waitFor();
    await this.stepUpPasswordInput.fill(password);
    await this.stepUpVerifyButton.click();
  }

  async completeStepUpWithCode(code: string) {
    await this.stepUpModal.waitFor();
    await this.stepUpCodeInput.fill(code);
    await this.stepUpVerifyButton.click();
  }

  /**
   * Requests a change and returns the plaintext tokens.
   *
   * The tokens are only ever stored hashed, so unlike getPasswordResetToken they cannot be read back
   * from the database - the API echoes them in the response body outside of production for exactly
   * this reason.
   */
  async requestEmailChangeAndCaptureTokens(newEmail: string, password: string) {
    // The request is POSTed twice: the first attempt has no step-up grant and is answered with a 403
    // that opens the prompt, then it is retried with the nonce. Match only the successful retry -
    // matching on method + url alone would resolve on the 403 and yield no tokens.
    const responsePromise = this.page.waitForResponse(
      (response) =>
        response.url().includes('/api/me/profile/email-change') && response.request().method() === 'POST' && response.status() === 200,
    );
    await this.startEmailChange();
    await this.submitNewEmail(newEmail);
    await this.completeStepUpWithPassword(password);
    const response = await responsePromise;
    const body = (await response.json()) as { data?: { confirmToken?: string; cancelToken?: string } };
    return { confirmToken: body.data?.confirmToken ?? '', cancelToken: body.data?.cancelToken ?? '' };
  }

  async goToProfilePage() {
    const navigationPromise = this.page.waitForURL('**/app/profile');
    this.playwrightPage.goToProfile();
    await navigationPromise;
  }

  async overrideProfile(bodyOverride: UserProfileUiWithIdentities) {
    this.profileOverride = bodyOverride;
    await this.page.route('**/api/me/profile', async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        json: { data: this.profileOverride },
      });
    });
  }

  async overrideLoginConfiguration(bodyOverride: LoginConfigurationUI) {
    this.loginConfigurationOverride = bodyOverride;
    await this.page.route('**/api/me/profile/login-configuration', async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        json: { data: this.loginConfigurationOverride },
      });
    });
  }
}
