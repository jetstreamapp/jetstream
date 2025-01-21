import { Locator, Page, expect } from '@playwright/test';
import { AuthenticationPage } from './AuthenticationPage.model';

const ButtonAction = {
  query: 'Query Records',
  load: 'Load Records',
  automationControl: 'Automation Control',
  managePermissions: 'Manage Permissions',
  deploy: 'Deploy and View Metadata',
  apex: 'Anonymous Apex',
  editRecord: 'Edit Current Record',
  viewRecord: 'View Current Record',
};

export class WebExtensionPage {
  readonly page: Page;
  readonly extensionId: string;

  readonly sfdcButton: Locator;
  readonly sfdcButtonPopupHeader: Locator;
  readonly sfdcButtonPopupBody: Locator;
  readonly sfdcButtonPopupRecordAction: Locator;
  readonly sfdcAppLauncherBtn: Locator;

  constructor(page: Page, extensionId: string) {
    this.page = page;
    this.extensionId = extensionId;

    this.sfdcButton = page.getByTestId('jetstream-ext-page-button');
    this.sfdcButtonPopupHeader = page.getByTestId('jetstream-ext-popup-header');
    this.sfdcButtonPopupBody = page.getByTestId('jetstream-ext-popup-body');
    this.sfdcButtonPopupRecordAction = page.getByTestId('jetstream-ext-popup-body').getByText('Record Actions');
    this.sfdcAppLauncherBtn = this.page.getByRole('button', { name: 'App Launcher' });
  }

  get baseExtensionUrl() {
    return `chrome-extension://${this.extensionId}`;
  }

  async gotoPopup() {
    await this.page.goto(`${this.baseExtensionUrl}/popup.html`);
  }

  async loginToSalesforce(url: string, username: string, password: string) {
    await this.page.goto(url);

    await this.page.getByLabel('Username').click();
    await this.page.getByLabel('Username').fill(username);

    await this.page.getByLabel('Password').click();
    await this.page.getByLabel('Password').fill(password);

    await this.page.getByRole('button', { name: 'Log In' }).click();

    await expect(this.page.getByRole('button', { name: 'App Launcher' })).toBeVisible();
  }

  async loginToJetstream(email: string, password: string) {
    await this.gotoPopup();

    const jetstreamExtAuthPagePromise = this.page.waitForEvent('popup');

    await this.page.getByRole('link', { name: 'Sign in' }).click();

    const jetstreamExtAuthPage = await jetstreamExtAuthPagePromise;

    const tempAuthPage = new AuthenticationPage(jetstreamExtAuthPage);
    await tempAuthPage.fillOutLoginForm(email, password);

    await expect(jetstreamExtAuthPage.getByText(/successfully authenticated/i)).toBeVisible();
    await jetstreamExtAuthPage.close();
  }

  async logout() {
    await this.gotoPopup();
    await this.page.getByRole('button', { name: 'Log Out' }).click();
  }

  async openPopup() {
    this.sfdcButton.click();
  }

  async closePopup() {
    await this.sfdcAppLauncherBtn.click();
  }

  async goToAction(action: keyof typeof ButtonAction) {
    await this.sfdcButton.click();
    await this.page.getByRole('link', { name: ButtonAction[action] }).click();
  }
}
