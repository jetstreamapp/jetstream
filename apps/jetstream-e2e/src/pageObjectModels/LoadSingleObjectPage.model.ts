import { APIRequestContext, Locator, Page } from '@playwright/test';
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
    await this.page.getByRole('button', { name: 'Start Over' }).click();
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

  // map fields
  // execute load
}
