import { APIRequestContext, Locator, Page, expect } from '@playwright/test';
import { ApiRequestUtils } from '../ApiRequestUtils';
import { PlaywrightPage } from './PlaywrightPage.model';

export class OrgGroupPage {
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

  async goToOrgGroupPage() {
    await this.page.goto('/app/home');
    const navigationPromise = this.page.waitForURL('**/app/org-groups');
    await this.page.getByRole('link', { name: 'Manage Org Groups' }).click();
    await navigationPromise;
  }

  async addSalesforceOrg(
    username: string,
    password: string,
    method: { type: 'production' } | { type: 'pre-release' } | { type: 'sandbox' } | { type: 'custom'; domain: string },
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

    // Sometimes SFDC clears the values from the form if they are typed in too quickly
    await salesforcePage.waitForTimeout(1000);

    await salesforcePage.getByLabel('Username').click();
    await salesforcePage.getByLabel('Username').fill(username);

    await salesforcePage.getByLabel('Password').click();
    await salesforcePage.getByLabel('Password').fill(password);

    const pageClosePromise = salesforcePage.waitForEvent('close', { timeout: 30000 });

    await salesforcePage.getByRole('button', { name: 'Log In' }).click();

    try {
      const allowLocator = salesforcePage.getByRole('button', { name: 'Allow' });
      await allowLocator.waitFor({ state: 'visible', timeout: 20000 });
      await allowLocator.click();
    } catch {
      // ignore error - this is expected if the org has already consented
    }
    await pageClosePromise;
  }

  async selectSalesforceOrg(username: string) {
    //
  }

  async removeSalesforceOrg(username: string) {
    //
  }

  async addOrgGroup(name: string, description: string) {
    await this.page.getByRole('button', { name: 'Create New Group' }).click();
    await this.page.locator('#group-name').click();
    await this.page.locator('#group-name').fill(name);
    await this.page.locator('#group-description').click();
    await this.page.locator('#group-description').fill(description);
    await this.page.getByRole('button', { name: 'Save' }).click();
    await expect(this.page.getByTestId(`org-group-card-${name}`)).toBeVisible();
    await expect(this.page.getByTestId(`org-group-card-${name}`).getByText(description)).toBeVisible();
  }

  async dragOrgToGroup(jetstreamOrgName: string, salesforceOrgLabel: string) {
    await this.page.getByTestId(`salesforce-org-${salesforceOrgLabel}`).dragTo(this.page.getByTestId(`org-group-card-${jetstreamOrgName}`));

    await expect(
      this.page.getByTestId(`org-group-card-${jetstreamOrgName}`).locator(this.page.getByTestId(`salesforce-org-${salesforceOrgLabel}`)),
    ).toBeVisible();
  }

  async makeActiveOrgGroup(jetstreamOrgName: string) {
    const locator = this.page.getByTestId(`org-group-card-${jetstreamOrgName}`);
    await locator.getByRole('button', { name: 'Make Active' }).click();
  }

  async editOrgGroup(jetstreamOrgName: string, newName: string, newDescription: string) {
    const locator = this.page.getByTestId(`org-group-card-${jetstreamOrgName}`);
    await locator.getByRole('button', { name: 'Edit' }).click();
    await this.page.locator('#group-name').fill(newName);
    await this.page.locator('#group-description').fill(newDescription);
    await this.page.getByRole('button', { name: 'Save' }).click();
    await expect(this.page.getByTestId(`org-group-card-${newName}`)).toBeVisible();
    await expect(this.page.getByTestId(`org-group-card-${newName}`).getByText(newDescription)).toBeVisible();
  }

  async deleteOrgGroup(jetstreamOrgName: string) {
    const locator = this.page.getByTestId(`org-group-card-${jetstreamOrgName}`);
    await locator.getByRole('button', { name: 'action' }).click();
    await locator.getByRole('menuitem', { name: 'Delete Group (Keep Orgs)' }).click();
    await this.page.getByRole('button', { name: 'Delete' }).click();
  }
}
