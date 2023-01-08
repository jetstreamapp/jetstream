import { APIRequestContext, expect, Locator, Page } from '@playwright/test';
import { QueryFilterOperator } from '@jetstream/types';
import { isNumber } from 'lodash';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { QueryResults } from '@jetstream/api-interfaces';
import { ApiRequestUtils } from '../fixtures/ApiRequestUtils';
import { isRecordWithId } from '@jetstream/shared/utils';

export class LoadPage {
  readonly apiRequestUtils: ApiRequestUtils;
  readonly page: Page;
  readonly request: APIRequestContext;
  readonly sobjectList: Locator;
  readonly fieldsList: Locator;
  readonly soqlQuery: Locator;
  readonly executeBtn: Locator;

  constructor(page: Page, request: APIRequestContext, apiRequestUtils: ApiRequestUtils) {
    this.apiRequestUtils = apiRequestUtils;
    this.page = page;
    this.request = request;
    this.sobjectList = page.getByTestId('sobject-list');
    this.fieldsList = page.getByTestId('sobject-fields');
    this.soqlQuery = page.getByText('Generated SOQL');
    this.executeBtn = page.getByTestId('execute-query-button');
  }

  async goto() {
    await this.page.getByRole('menuitem', { name: 'Load Records' }).click();
    await this.page.waitForURL('**/load');
  }

  async startOver() {
    await this.page.getByRole('button', { name: 'Start Over' }).click();
  }

  async selectObject(sobjectName: string) {
    await this.sobjectList.getByTestId(sobjectName).click();
    await expect(this.fieldsList).toBeVisible();
    await expect(this.soqlQuery).toBeVisible();
  }

  async selectFile() {
    await this.page.getByText('Upload File').click();
  }

  async continueToMapFields() {
    await this.page.getByText('Upload File').click();
    await this.page.waitForURL('**/load');
  }

  // map fields
  // execute load
}
