import * as dotenv from 'dotenv';

import { test as base } from '@playwright/test';
import { z } from 'zod';
import { AuthenticationPage } from '../pageObjectModels/AuthenticationPage.model';
import { LoadSingleObjectPage } from '../pageObjectModels/LoadSingleObjectPage.model';
import { LoadWithoutFilePage } from '../pageObjectModels/LoadWithoutFilePage.model';
import { OrganizationsPage } from '../pageObjectModels/OrganizationsPage';
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

const environmentSchema = z.object({
  E2E_LOGIN_USERNAME: z.string(),
  TEST_ORG_2: z.string().optional().default('support+test2@getjetstream.app'),
  TEST_ORG_3: z.string().optional().default('support+test3@getjetstream.app'),
  TEST_ORG_4: z.string().optional().default('support+test4@getjetstream.app'),
  E2E_LOGIN_PASSWORD: z.string(),
  E2E_LOGIN_URL: z.string(),
  JETSTREAM_SESSION_SECRET: z.string(),
});

type MyFixtures = {
  environment: z.infer<typeof environmentSchema>;
  apiRequestUtils: ApiRequestUtils;
  playwrightPage: PlaywrightPage;
  authenticationPage: AuthenticationPage;
  newUser: Awaited<ReturnType<AuthenticationPage['signUpAndVerifyEmail']>>;
  queryPage: QueryPage;
  loadSingleObjectPage: LoadSingleObjectPage;
  organizationsPage: OrganizationsPage;
  loadWithoutFilePage: LoadWithoutFilePage;
  platformEventPage: PlatformEventPage;
};

export const test = base.extend<MyFixtures>({
  // eslint-disable-next-line no-empty-pattern
  environment: async ({}, use) => {
    await use(environmentSchema.parse(process.env));
  },
  apiRequestUtils: async ({ page, environment }, use) => {
    await use(new ApiRequestUtils(page, environment.E2E_LOGIN_USERNAME));
  },
  playwrightPage: async ({ page }, use) => {
    await use(new PlaywrightPage(page));
  },
  authenticationPage: async ({ page }, use) => {
    await use(new AuthenticationPage(page));
  },
  newUser: async ({ authenticationPage }, use) => {
    await use(await authenticationPage.signUpAndVerifyEmail());
  },
  queryPage: async ({ page, apiRequestUtils, playwrightPage }, use) => {
    await apiRequestUtils.selectDefaultOrg();
    await use(new QueryPage(page, apiRequestUtils, playwrightPage));
  },
  loadSingleObjectPage: async ({ page, apiRequestUtils, playwrightPage }, use) => {
    await apiRequestUtils.selectDefaultOrg();
    await use(new LoadSingleObjectPage(page, apiRequestUtils, playwrightPage));
  },
  loadWithoutFilePage: async ({ page, apiRequestUtils, playwrightPage }, use) => {
    await apiRequestUtils.selectDefaultOrg();
    await use(new LoadWithoutFilePage(page, apiRequestUtils, playwrightPage));
  },
  organizationsPage: async ({ page }, use) => {
    await use(new OrganizationsPage(page));
  },
  platformEventPage: async ({ page, apiRequestUtils, playwrightPage }, use) => {
    await apiRequestUtils.selectDefaultOrg();
    await use(new PlatformEventPage(page, apiRequestUtils, playwrightPage));
  },
});

export { expect } from '@playwright/test';
