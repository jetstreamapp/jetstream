import { APIRequestContext, Locator, Page } from '@playwright/test';
import { ApiRequestUtils } from '../fixtures/ApiRequestUtils';
import { PlaywrightPage } from './PlaywrightPage.model';

export class LoadWithoutFilePage {
  readonly apiRequestUtils: ApiRequestUtils;
  readonly playwrightPage: PlaywrightPage;
  readonly page: Page;
  readonly request: APIRequestContext;
  readonly sobjectList: Locator;

  constructor(page: Page, request: APIRequestContext, apiRequestUtils: ApiRequestUtils, playwrightPage: PlaywrightPage) {
    this.apiRequestUtils = apiRequestUtils;
    this.playwrightPage = playwrightPage;
    this.page = page;
    this.request = request;
    this.sobjectList = page.getByTestId('sobject-list');
  }

  async goto() {
    await this.page.getByRole('link', { name: 'Update Records Without a File' }).first().click();
    await this.page.waitForURL('**/update-records');
  }

  async selectObject(name: string) {
    await this.page.getByTestId(name).click();
  }

  async selectField(name: string) {
    await this.playwrightPage.selectDropdownItem('Field to Update', name, { searchForValue: true });
  }

  async validateAndReviewAndSubmit(batchSize?: string) {
    await this.page.getByRole('button', { name: 'Validate Results' }).click();
    await this.page.getByText(/[0-9]+ records will be updated/).waitFor();

    await this.page.getByRole('link', { name: 'Review Changes' }).click();

    if (batchSize) {
      await this.page.getByRole('button', { name: 'Advanced Options' }).click();
      await this.page.getByPlaceholder('Set batch size').fill('1');
    }

    await this.page.getByRole('button', { name: /(Update [0-9]+ Records?)|(Update Records)/g }).click();
  }

  async configureStaticField(value: string) {
    await this.playwrightPage.selectDropdownItem('Record update to Apply', 'Provided value');
    await this.page.getByPlaceholder('Value to set on each record').fill(value);
  }

  async configureStaticPicklistField(fieldName: string) {
    await this.playwrightPage.selectDropdownItem('Record update to Apply', 'Provided value');
    await this.playwrightPage.selectDropdownItem('Provided Value', fieldName);
  }

  async configureCriteria(type: 'All records' | 'Only if blank' | 'Only if not blank' | 'Custom criteria', customCriteria?: string) {
    await this.playwrightPage.selectDropdownItem('Which records should be updated?', type);
    if (type === 'Custom criteria' && customCriteria) {
      await this.page.getByLabel('Custom WHERE clause').fill(customCriteria);
    }
  }
}
