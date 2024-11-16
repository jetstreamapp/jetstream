import { APIRequestContext, Locator, Page, expect } from '@playwright/test';
import { ApiRequestUtils } from '../fixtures/ApiRequestUtils';
import { PlaywrightPage } from './PlaywrightPage.model';

export class OrganizationsPage {
  readonly apiRequestUtils: ApiRequestUtils;
  readonly playwrightPage: PlaywrightPage;
  readonly page: Page;
  readonly request: APIRequestContext;

  readonly addOrgButton: Locator;
  readonly orgDropdownContainer: Locator;
  readonly orgDropdown: Locator;
  readonly sobjectList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addOrgButton = page.getByRole('button', { name: 'Add Org' });
    this.orgDropdownContainer = page.getByTestId('orgs-combobox-container');
    this.orgDropdown = page.getByPlaceholder('Select an Org');
  }

  async goToJetstreamOrganizationsPage() {
    await this.page.goto('/app/home');
    const navigationPromise = this.page.waitForURL('/app/organizations');
    await this.page.getByRole('link', { name: 'Manage Organizations' }).click();
    await navigationPromise;
  }

  async addSalesforceOrg(
    username: string,
    password: string,
    method: { type: 'production' } | { type: 'pre-release' } | { type: 'sandbox' } | { type: 'custom'; domain: string }
  ) {
    await this.page.getByRole('button', { name: 'Add Org' }).click();

    const salesforcePagePromise = this.page.waitForEvent('popup');

    switch (method.type) {
      case 'production': {
        await this.page.getByText('Production / Developer').click();
        break;
      }
      case 'sandbox': {
        await this.page.getByText('Production / Developer').click();
        break;
      }
      case 'pre-release': {
        await this.page.getByText('Pre-release').click();
        break;
      }
      case 'custom': {
        await this.page.getByText('Custom Login URL').click();
        await this.page.getByPlaceholder('org-domain').click();
        await this.page.getByPlaceholder('org-domain').fill(method.domain);
        break;
      }
    }

    await this.page.getByRole('button', { name: 'Continue' }).click();

    const salesforcePage = await salesforcePagePromise;

    await salesforcePage.getByLabel('Username').click();
    await salesforcePage.getByLabel('Username').fill(username);

    await salesforcePage.getByLabel('Password').click();
    await salesforcePage.getByLabel('Password').fill(password);

    const pageClosePromise = salesforcePage.waitForEvent('close', { timeout: 30000 });

    await salesforcePage.getByRole('button', { name: 'Log In' }).click();

    try {
      const allowLocator = salesforcePage.getByRole('button', { name: 'Allow' });
      await expect(allowLocator).toBeVisible({ timeout: 1000 });
      await allowLocator.click();
    } catch {
      // ignore error - this is expected if the org is already authorized
    }

    await pageClosePromise;
  }

  async selectSalesforceOrg(username: string) {
    //
  }

  async removeSalesforceOrg(username: string) {
    //
  }

  async addJetstreamOrganization(name: string, description: string) {
    await this.page.getByRole('button', { name: 'Create New Organization' }).click();
    await this.page.locator('#organization-name').click();
    await this.page.locator('#organization-name').fill(name);
    await this.page.locator('#organization-description').click();
    await this.page.locator('#organization-description').fill(description);
    await this.page.getByRole('button', { name: 'Save' }).click();
    await expect(this.page.getByTestId(`organization-card-${name}`)).toBeVisible();
  }

  async dragOrgToOrganization(jetstreamOrgName: string, salesforceOrgLabel: string) {
    await this.page
      .getByTestId(`salesforce-organization-${salesforceOrgLabel}`)
      .dragTo(this.page.getByTestId(`organization-card-${jetstreamOrgName}`));

    await expect(
      this.page
        .getByTestId(`organization-card-${jetstreamOrgName}`)
        .locator(this.page.getByTestId(`salesforce-organization-${salesforceOrgLabel}`))
    ).toBeVisible();
  }

  async makeActiveJetstreamOrganization(jetstreamOrgName: string) {
    const locator = this.page.getByTestId(`organization-card-${jetstreamOrgName}`);
    await locator.getByRole('button', { name: 'Make Active' }).click();
  }

  async deleteJetstreamOrganization(jetstreamOrgName: string) {
    const locator = this.page.getByTestId(`organization-card-${jetstreamOrgName}`);
    await locator.getByRole('button', { name: 'action' }).click();
    await locator.getByRole('menuitem', { name: 'Delete' }).click();
    await this.page.getByRole('button', { name: 'Continue' }).click();
  }
}
