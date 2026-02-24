import { LoginConfigurationUI, UserProfileUiWithIdentities } from '@jetstream/auth/types';
import { APIRequestContext, expect, Locator, Page } from '@playwright/test';
import { ApiRequestUtils } from '../ApiRequestUtils';

export class TeamDashboardPage {
  readonly apiRequestUtils: ApiRequestUtils;
  readonly page: Page;
  readonly request: APIRequestContext;

  readonly viewAuthActivityButton: Locator;
  readonly viewUserSessionsButton: Locator;
  readonly addTeamMemberButton: Locator;

  readonly loginConfigContainer: Locator;
  readonly loginConfigSaveButton: Locator;
  readonly loginConfigRequireMfaCheckbox: Locator;
  readonly loginConfigAllowIdentityLinkingCheckbox: Locator;
  readonly loginConfigAuthenticatorAppCheckbox: Locator;
  readonly loginConfigEmailCheckbox: Locator;
  readonly loginConfigUsernamePasswordCheckbox: Locator;
  readonly loginConfigGoogleCheckbox: Locator;
  readonly loginConfigSalesforceCheckbox: Locator;

  readonly teamMemberTableContainer: Locator;
  readonly teamMemberTable: Locator;
  readonly teamInviteTable: Locator;

  readonly userSessionModal: Locator;
  readonly teamMemberInviteModal: Locator;
  readonly teamMemberUpdateModal: Locator;
  readonly teamMemberAuthActivityModal: Locator;

  loginConfigurationOverride: LoginConfigurationUI;
  profileOverride: UserProfileUiWithIdentities;

  constructor(page: Page) {
    this.page = page;
    this.viewAuthActivityButton = page.getByRole('button', { name: 'View Auth Activity' });
    this.viewUserSessionsButton = page.getByRole('button', { name: 'View User Sessions' });
    this.addTeamMemberButton = page.getByRole('button', { name: 'Add Team Member' });

    this.loginConfigContainer = page.getByTestId('team-login-configuration-container');
    this.loginConfigSaveButton = this.loginConfigContainer.getByRole('button', { name: 'Save' });
    this.loginConfigRequireMfaCheckbox = this.loginConfigContainer.locator('label').filter({ hasText: 'Require Multi-Factor' });
    this.loginConfigAllowIdentityLinkingCheckbox = this.loginConfigContainer
      .locator('label')
      .filter({ hasText: 'Allow linking additional' });
    this.loginConfigAuthenticatorAppCheckbox = this.loginConfigContainer.locator('label').filter({ hasText: 'Authenticator App (OTP)' });
    this.loginConfigEmailCheckbox = this.loginConfigContainer.locator('label').filter({ hasText: 'Email' });
    this.loginConfigUsernamePasswordCheckbox = this.loginConfigContainer.locator('label').filter({ hasText: 'Username + Password' });
    this.loginConfigGoogleCheckbox = this.loginConfigContainer.locator('label').filter({ hasText: 'Google' });
    this.loginConfigSalesforceCheckbox = this.loginConfigContainer.locator('label').filter({ hasText: 'Salesforce' });

    this.teamMemberTableContainer = page.getByTestId('team-member-table-container');
    this.teamMemberTable = page.getByTestId('team-member-table');
    this.teamInviteTable = page.getByTestId('team-invite-table');

    this.userSessionModal = page.getByTestId('user-session-modal');
    this.teamMemberInviteModal = page.getByTestId('team-member-invite-modal');
    this.teamMemberUpdateModal = page.getByTestId('team-member-update-modal');
    this.teamMemberAuthActivityModal = page.getByTestId('team-member-auth-activity-modal');
  }

  async goToTeamDashboardPage() {
    const navigationPromise = this.page.waitForURL('**/app/teams');
    await this.page.getByRole('button', { name: 'Avatar' }).click();
    await this.page.getByRole('menuitem', { name: 'Team Dashboard' }).click();
    await navigationPromise;
  }

  async updateTeamName(name: string) {
    // TODO:
  }

  async updateUserRole() {
    // TODO:
  }

  async deactivateUser() {
    // TODO:
  }

  async inviteTeamMember(email: string, role?: string) {
    await this.addTeamMemberButton.click();
    await expect(this.teamMemberInviteModal.getByRole('heading', { name: 'Invite Team Member' })).toBeVisible();

    if (role) {
      await this.teamMemberInviteModal.getByPlaceholder('Select an Option').click();
      await this.teamMemberInviteModal.getByRole('option', { name: role }).click();
    }

    await this.teamMemberInviteModal.getByLabel('Email Address').fill(email);
    await this.teamMemberInviteModal.getByRole('button', { name: 'Send Invitation' }).click();
  }

  async viewAuthActivity() {
    // TODO:
  }

  async viewUserSessions() {
    // TODO:
  }

  async revokeUserSession(email: string) {
    await this.viewUserSessionsButton.click();
    await expect(this.userSessionModal.getByRole('heading', { name: 'User Sessions' })).toBeVisible();
    const row = this.userSessionModal.getByRole('row', { name: email }).first();
    await row.getByTestId('user-session-row-actions').click();

    const getByPageBannerPromise = expect(this.page.getByText('Session revoked successfully.')).toBeVisible();
    await row.getByRole('menuitem', { name: 'Revoke Session' }).click();
    await this.userSessionModal.getByRole('button', { name: 'Close' }).click();
    await getByPageBannerPromise;
  }
}
