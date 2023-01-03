import { test as base } from '@playwright/test';
import { QueryPage } from '../pageObjectModels/QueryPage.model';
import { ApiRequestUtils } from './ApiRequestUtils';
import * as dotenv from 'dotenv';

// Ensure tests run via VSCode debugger are run from the root of the repo
if (process.cwd().endsWith('/apps/jetstream-e2e')) {
  process.chdir('../../');
}

dotenv.config();

type MyFixtures = {
  apiRequestUtils: ApiRequestUtils;
  queryPage: QueryPage;
};

// Extend basic test by providing a "todoPage" fixture.
export const test = base.extend<MyFixtures>({
  apiRequestUtils: async ({ page, request }, use) => {
    await page.goto('/');
    // TODO: figure this out
    // TODO: this should be e2e org
    await page.getByPlaceholder('Select an Org').click();
    await page.getByRole('option', { name: process.env.E2E_LOGIN_USERNAME }).click();

    const selectedOrgId = await page.evaluate(async () => {
      return window.atob(localStorage.getItem('SELECTED_ORG'));
    });

    await use(new ApiRequestUtils(selectedOrgId, request));
  },
  queryPage: async ({ page, request, apiRequestUtils }, use) => {
    await use(new QueryPage(page, request, apiRequestUtils));
  },
});

export { expect } from '@playwright/test';
