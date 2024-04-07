import { APIRequestContext, Page } from '@playwright/test';
import { ApiRequestUtils } from '../fixtures/ApiRequestUtils';

export class PlaywrightPage {
  readonly apiRequestUtils: ApiRequestUtils;
  readonly page: Page;
  readonly request: APIRequestContext;

  constructor(page: Page, request: APIRequestContext, apiRequestUtils: ApiRequestUtils) {
    this.apiRequestUtils = apiRequestUtils;
    this.page = page;
    this.request = request;
  }

  async selectDropdownItem(
    label: string,
    value: string,
    options: {
      searchForValue?: boolean;
    } = {}
  ) {
    const { searchForValue } = options;
    const dropdown = this.page.getByTestId(`dropdown-${label}`);
    await dropdown.getByLabel(label).click();
    if (searchForValue) {
      await dropdown.getByLabel(label).fill(value);
    }
    await dropdown.getByRole('option', { name: value }).click();
    return dropdown;
  }
}
