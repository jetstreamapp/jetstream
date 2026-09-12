import { LoginConfigurationUI, UserProfileUiWithIdentities } from '@jetstream/auth/types';
import { APIRequestContext, expect, Locator, Page } from '@playwright/test';
import { ApiRequestUtils } from '../ApiRequestUtils';

/** Role labels as rendered in the role picklists */
export type TeamMemberRoleLabel = 'Admin' | 'Billing' | 'Member';

export interface SeatSummaryExpectation {
  purchased: number;
  used: number;
  /** Negative when the team is over-allocated */
  available: number;
}

/**
 * The members table footer copy for a seat state. This is the locked contract shared with the client,
 * so it is the primary assertion for the numbers shown on the dashboard.
 */
export function getSeatFooterText({ purchased, used, available }: SeatSummaryExpectation): string {
  if (available < 0) {
    return `Using ${used} of ${purchased} seats (${Math.abs(available)} over).`;
  }
  if (available === 0) {
    return `All ${purchased} seats are in use.`;
  }
  return `${available} of ${purchased} seats available.`;
}

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
  readonly teamMemberStatusUpdateModal: Locator;
  readonly teamMemberAuthActivityModal: Locator;

  readonly teamSeatsCard: Locator;
  readonly manageSeatsButton: Locator;
  readonly manageSeatsModal: Locator;
  readonly seatCountInput: Locator;
  readonly seatPreview: Locator;
  readonly seatsBanner: Locator;
  readonly seatsPendingNotice: Locator;
  readonly seatsUnavailableNotice: Locator;

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
    this.teamMemberStatusUpdateModal = page.getByTestId('team-member-status-update-modal');
    this.teamMemberAuthActivityModal = page.getByTestId('team-member-auth-activity-modal');

    this.teamSeatsCard = page.getByTestId('team-seats-card');
    this.manageSeatsButton = page.getByTestId('team-seats-manage-button');
    this.manageSeatsModal = page.getByTestId('team-seats-manage-modal');
    this.seatCountInput = page.getByTestId('team-seats-count');
    this.seatPreview = page.getByTestId('team-seats-preview');
    this.seatsBanner = page.getByTestId('team-seats-banner');
    this.seatsPendingNotice = page.getByTestId('team-seats-pending');
    this.seatsUnavailableNotice = page.getByTestId('seats-unavailable-notice');
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

  /**
   * Open the row action menu for a member. The menu is portaled, so it is not a descendant of the row —
   * the returned locator is the open menu, tied back to the row through the trigger's expanded state.
   */
  async openMemberActions(email: string): Promise<Locator> {
    const row = this.teamMemberTable.getByTestId(`team-member-row-${email}`);
    const rowActions = row.getByTestId('user-row-actions');
    await rowActions.click();
    await expect(rowActions).toHaveAttribute('aria-expanded', 'true');
    return this.page.getByRole('menu', { name: 'action' });
  }

  async openDeactivateModal(email: string) {
    const menu = await this.openMemberActions(email);
    await menu.getByRole('menuitem', { name: 'Deactivate' }).click();
    await expect(this.teamMemberStatusUpdateModal.getByRole('heading', { name: 'Update Status' })).toBeVisible();
  }

  async deactivateUser(email: string) {
    await this.openDeactivateModal(email);
    await this.teamMemberStatusUpdateModal.getByRole('button', { name: 'Save' }).click();
    await expect(this.page.getByRole('heading', { name: 'Successfully deactivated' })).toBeVisible();
    await expect(this.teamMemberStatusUpdateModal).toBeHidden();
  }

  /** Opens the reactivate modal without saving so the caller can assert on the seat state it shows */
  async openReactivateModal(email: string, role?: TeamMemberRoleLabel) {
    const menu = await this.openMemberActions(email);
    await menu.getByRole('menuitem', { name: 'Reactivate User' }).click();
    await expect(this.teamMemberStatusUpdateModal.getByRole('heading', { name: 'Update Status' })).toBeVisible();
    if (role) {
      await this.selectRole(this.teamMemberStatusUpdateModal, role);
    }
  }

  async reactivateUser(email: string, role?: TeamMemberRoleLabel) {
    await this.openReactivateModal(email, role);
    await this.teamMemberStatusUpdateModal.getByRole('button', { name: 'Save' }).click();
    await expect(this.page.getByRole('heading', { name: 'Successfully reactivated' })).toBeVisible();
    await expect(this.teamMemberStatusUpdateModal).toBeHidden();
  }

  async openUpdateRoleModal(email: string) {
    const menu = await this.openMemberActions(email);
    await menu.getByRole('menuitem', { name: 'Edit' }).click();
    await expect(this.teamMemberUpdateModal.getByRole('heading', { name: 'Update Role' })).toBeVisible();
  }

  async updateUserRole(email: string, role: TeamMemberRoleLabel) {
    await this.openUpdateRoleModal(email);
    await this.selectRole(this.teamMemberUpdateModal, role);
    await this.teamMemberUpdateModal.getByRole('button', { name: 'Save' }).click();
    await expect(this.teamMemberUpdateModal).toBeHidden();
  }

  async openInviteModal() {
    await this.addTeamMemberButton.click();
    await expect(this.teamMemberInviteModal.getByRole('heading', { name: 'Invite Team Member' })).toBeVisible();
  }

  async selectInviteRole(role: TeamMemberRoleLabel) {
    await this.selectRole(this.teamMemberInviteModal, role);
  }

  async inviteTeamMember(email: string, role?: TeamMemberRoleLabel) {
    await this.openInviteModal();

    if (role) {
      await this.selectInviteRole(role);
    }

    await this.teamMemberInviteModal.getByLabel('Email Address').fill(email);
    await this.teamMemberInviteModal.getByRole('button', { name: 'Send Invitation' }).click();
  }

  /**
   * Assert the seat numbers the dashboard shows: the Seats card stats and the members table footer copy
   * (the locked contract shared with the client).
   */
  async expectSeatSummary(expectation: SeatSummaryExpectation) {
    await expect(this.teamSeatsCard).toBeVisible();
    await expect(this.teamSeatsCard.getByTestId('team-seats-purchased')).toHaveText(String(expectation.purchased));
    await expect(this.teamSeatsCard.getByTestId('team-seats-used')).toHaveText(String(expectation.used));
    await expect(this.teamSeatsCard.getByTestId('team-seats-available')).toHaveText(String(expectation.available));
    await expect(this.teamMemberTableContainer).toContainText(getSeatFooterText(expectation));
  }

  async openManageSeats() {
    await this.manageSeatsButton.click();
    await expect(this.manageSeatsModal).toBeVisible();
  }

  /** The stepper clamps on blur, so the input is blurred after filling to mirror a real edit */
  async setSeatCount(count: number) {
    await this.seatCountInput.fill(String(count));
    await this.seatCountInput.blur();
    await expect(this.seatCountInput).toHaveValue(String(count));
  }

  /** Moves the Manage Seats modal from the edit step to the preview step */
  async previewSeatChange() {
    await this.manageSeatsModal.getByTestId('team-seats-preview-button').click();
    await expect(this.seatPreview).toBeVisible();
  }

  /** Confirms the previewed change ("Confirm and pay $X" for increases, "Schedule decrease" for decreases) */
  async confirmSeatChange() {
    await this.manageSeatsModal.getByTestId('team-seats-confirm-button').click();
    await expect(this.manageSeatsModal).toBeHidden();
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

  private async selectRole(modal: Locator, role: TeamMemberRoleLabel) {
    await modal.getByPlaceholder('Select an Option').click();
    await modal.getByRole('option', { name: role }).click();
  }
}
