import { LoginConfigurationUI, UserProfileUiWithIdentities } from '@jetstream/auth/types';
import { APIRequestContext, Locator, Page } from '@playwright/test';
import { ApiRequestUtils } from '../ApiRequestUtils';
import { PlaywrightPage } from './PlaywrightPage.model';

export function getDefaultProfile() {
  const defaultProfile: UserProfileUiWithIdentities = {
    id: 'aaaaaaaa-0000-0000-0000-aaaaaaaaaaaa',
    userId: 'test|AAAAAAAA-0000-0000-0000-AAAAAAAAAAAA',
    name: 'Test User',
    email: 'test@example.com',
    emailVerified: true,
    picture: null,
    preferences: {
      id: '89311d69-04d9-4dde-9731-e85035f49d97',
      userId: 'aaaaaaaa-0000-0000-0000-aaaaaaaaaaaa',
      skipFrontdoorLogin: false,
      recordSyncEnabled: true,
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

  loginConfigurationOverride: LoginConfigurationUI;
  profileOverride: UserProfileUiWithIdentities;

  constructor(page: Page, playwrightPage: PlaywrightPage) {
    this.page = page;
    this.playwrightPage = playwrightPage;
    this.addOrgButton = page.getByRole('button', { name: 'Add Org' });
    this.orgDropdownContainer = page.getByTestId('orgs-combobox-container');
    this.orgDropdown = page.getByPlaceholder('Select an Org');
  }

  async goToProfilePage() {
    const navigationPromise = this.page.waitForURL('/app/profile');
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
