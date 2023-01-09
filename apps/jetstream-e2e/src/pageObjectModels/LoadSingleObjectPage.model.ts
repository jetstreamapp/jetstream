import { APIRequestContext, expect, Locator, Page } from '@playwright/test';
import { ApiRequestUtils } from '../fixtures/ApiRequestUtils';

export class LoadSingleObjectPage {
  readonly apiRequestUtils: ApiRequestUtils;
  readonly page: Page;
  readonly request: APIRequestContext;
  readonly sobjectList: Locator;

  constructor(page: Page, request: APIRequestContext, apiRequestUtils: ApiRequestUtils) {
    this.apiRequestUtils = apiRequestUtils;
    this.page = page;
    this.request = request;
    this.sobjectList = page.getByTestId('sobject-list');
  }

  async goto() {
    await this.page.getByRole('button', { name: 'Load Records' }).click();
    await this.page.getByRole('menuitemcheckbox', { name: 'Load Records to Single Object' }).click();
    await this.page.waitForURL('**/load');
  }

  async startOver() {
    await this.page.getByTestId('start-over-button').click();
    await this.validateHeaderButtonState(false, false, false);
  }

  async selectObject(sobjectName: string) {
    await this.sobjectList.getByTestId(sobjectName).click();
  }

  async selectFile(
    filePathOrFile:
      | string
      | {
          name: string;
          mimeType: string;
          buffer: Buffer;
        }
  ) {
    const fileChooserPromise = this.page.waitForEvent('filechooser');
    await this.page.getByText('Upload File').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(filePathOrFile);
  }

  async continueToMapFields() {
    await this.page.getByText('Upload File').click();
    await this.page.waitForURL('**/load');
  }

  async validateHeaderButtonState(startOver: boolean, goBack: boolean, continueToMapFields: boolean) {
    async function validate(enabled: boolean, locator: Locator) {
      (await enabled) ? expect(locator).toBeEnabled() : expect(locator).toBeDisabled();
    }
    validate(startOver, this.page.getByTestId('start-over-button'));
    validate(goBack, this.page.getByTestId('prev-step-button'));
    validate(continueToMapFields, this.page.getByTestId('next-step-button'));
  }

  async chooseObjectAndFile(objectType: string, filename: string, loadType: 'Update' | 'Insert' | 'Upsert' | 'Delete') {
    await this.validateHeaderButtonState(false, false, false);

    await this.selectFile(filename);

    await expect(this.page.getByText('Select an object from the list on the left to continue')).toBeVisible();
    await this.validateHeaderButtonState(false, false, false);

    await this.selectObject(objectType);

    await this.page.locator('label').filter({ hasText: 'Update' });
    await this.page.getByTestId('load-type').getByText(loadType);

    await this.validateHeaderButtonState(false, false, true);

    await this.page.getByTestId('next-step-button').click();
  }

  async mapFields(operation: 'Update' | 'Insert' | 'Upsert' | 'Delete', object: string, recordCount: number, mappedFieldCount: number) {
    await this.validateHeaderButtonState(true, true, true);
    // TODO: validate
    // await expect(
    //   this.page.getByText(
    //     new RegExp(
    //       `${operation} • Object: ${object} • ${formatNumber(recordCount)} records impacted • ${formatNumber(
    //         mappedFieldCount
    //       )} of [0-9,]+ fields mapped`
    //     )
    //   )
    // ).toBeVisible();

    await this.page.getByTestId('next-step-button').click();

    // TODO: test mapping page stuff
    // auto-mapping
    // resetting fields
    // auto-map related fields
    // choose non-ext id
    // polymorphic fields
    // getByRole('button', { name: 'Continue to Load Records' })
  }

  async loadRecords(apiType: 'Bulk API' | 'Batch API', isSubsequentLoad = false) {
    // TODO: validate stuff on the page

    this.page.getByText(apiType).nth(1).click();

    await this.validateHeaderButtonState(true, true, false);
    await this.page.getByTestId('start-load').click();

    if (isSubsequentLoad) {
      await expect(this.page.getByRole('heading', { name: 'Are you sure?' })).toBeVisible();
      await this.page.getByRole('button', { name: 'Continue' }).click();
    }

    // ensure page is in loading state
    await expect(this.page.getByRole('heading', { name: 'Processing Data' })).toBeVisible();
    await this.validateHeaderButtonState(false, false, false);

    await expect(this.page.getByRole('heading', { name: 'Finished' })).toBeVisible();
    await this.validateHeaderButtonState(true, true, false);
  }
}
