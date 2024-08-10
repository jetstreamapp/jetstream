import * as dotenv from 'dotenv';

import { test as base } from '@playwright/test';
import { LoadSingleObjectPage } from '../pageObjectModels/LoadSingleObjectPage.model';
import { LoadWithoutFilePage } from '../pageObjectModels/LoadWithoutFilePage.model';
import { PlatformEventPage } from '../pageObjectModels/PlatformEventPage.model';
import { PlaywrightPage } from '../pageObjectModels/PlaywrightPage.model';
import { QueryPage } from '../pageObjectModels/QueryPage.model';
import { ApiRequestUtils } from './ApiRequestUtils';

globalThis.__IS_CHROME_EXTENSION__ = false;

// Ensure tests run via VSCode debugger are run from the root of the repo
if (process.cwd().endsWith('/apps/jetstream-e2e')) {
  process.chdir('../../');
}

dotenv.config();

type MyFixtures = {
  apiRequestUtils: ApiRequestUtils;
  playwrightPage: PlaywrightPage;
  queryPage: QueryPage;
  loadSingleObjectPage: LoadSingleObjectPage;
  loadWithoutFilePage: LoadWithoutFilePage;
  platformEventPage: PlatformEventPage;
};

export const test = base.extend<MyFixtures>({
  apiRequestUtils: async ({ page, request }, use) => {
    await page.goto('/app');
    // TODO: figure this out
    // TODO: this should be e2e org
    await page.getByPlaceholder('Select an Org').click();
    await page.getByRole('option', { name: process.env.E2E_LOGIN_USERNAME }).click();

    const selectedOrgId = await page.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return window.atob(localStorage.getItem('SELECTED_ORG')!);
    });

    await use(new ApiRequestUtils(selectedOrgId, request));
  },
  playwrightPage: async ({ page, request, apiRequestUtils }, use) => {
    await use(new PlaywrightPage(page, request, apiRequestUtils));
  },
  queryPage: async ({ page, request, apiRequestUtils, playwrightPage }, use) => {
    await use(new QueryPage(page, request, apiRequestUtils, playwrightPage));
  },
  loadSingleObjectPage: async ({ page, request, apiRequestUtils, playwrightPage }, use) => {
    await use(new LoadSingleObjectPage(page, request, apiRequestUtils, playwrightPage));
  },
  loadWithoutFilePage: async ({ page, request, apiRequestUtils, playwrightPage }, use) => {
    await use(new LoadWithoutFilePage(page, request, apiRequestUtils, playwrightPage));
  },
  platformEventPage: async ({ page, request, apiRequestUtils, playwrightPage }, use) => {
    await use(new PlatformEventPage(page, request, apiRequestUtils, playwrightPage));
  },
});

export { expect } from '@playwright/test';
