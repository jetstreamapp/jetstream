import * as dotenv from 'dotenv';

import {
  ApiRequestUtils,
  AuthenticationPage,
  LoadSingleObjectPage,
  LoadWithoutFilePage,
  OrganizationsPage,
  PlatformEventPage,
  PlaywrightPage,
  ProfilePage,
  QueryPage,
  TeamCreationUtils,
  TeamDashboardPage,
} from '@jetstream/test/e2e-utils';
import { test as base } from '@playwright/test';
import { z } from 'zod';

globalThis.__IS_BROWSER_EXTENSION__ = false;

// Ensure tests run via VSCode debugger are run from the root of the repo
if (process.cwd().endsWith('/apps/jetstream-e2e')) {
  process.chdir('../../');
}

dotenv.config();

const environmentSchema = z.object({
  E2E_LOGIN_USERNAME: z.string(),
  TEST_ORG_2: z.string().optional().prefault('support+test2@getjetstream.app'),
  TEST_ORG_3: z.string().optional().prefault('support+test3@getjetstream.app'),
  TEST_ORG_4: z.string().optional().prefault('support+test4@getjetstream.app'),
  E2E_LOGIN_PASSWORD: z.string(),
  E2E_LOGIN_URL: z.string(),
  JETSTREAM_SESSION_SECRET: z.string(),
  PLAYWRIGHT_KEEP_DATA: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
});

type MyFixtures = {
  environment: z.infer<typeof environmentSchema>;
  apiRequestUtils: ApiRequestUtils;
  teamCreationUtils1User: TeamCreationUtils;
  teamCreationUtils3Users: TeamCreationUtils;
  playwrightPage: PlaywrightPage;
  authenticationPage: AuthenticationPage;
  newUser: Awaited<ReturnType<AuthenticationPage['signUpAndVerifyEmail']>>;
  queryPage: QueryPage;
  loadSingleObjectPage: LoadSingleObjectPage;
  organizationsPage: OrganizationsPage;
  loadWithoutFilePage: LoadWithoutFilePage;
  platformEventPage: PlatformEventPage;
  profilePage: ProfilePage;
  teamDashboardPage: TeamDashboardPage;
};

export const test = base.extend<MyFixtures>({
  // eslint-disable-next-line no-empty-pattern
  environment: async ({}, use) => {
    await use(environmentSchema.parse(process.env));
  },
  teamCreationUtils1User: async ({ browser, page, environment }, use) => {
    const teamCreationUtils = new TeamCreationUtils();
    try {
      await teamCreationUtils.createTestTeamWithoutMembers({ page });
      await use(teamCreationUtils);
    } catch (ex) {
      console.error('Error in teamSetup', ex);
      throw ex;
    } finally {
      if (environment.PLAYWRIGHT_KEEP_DATA) {
        console.log('Skipping team cleanup based on PLAYWRIGHT_KEEP_DATA env var');
        teamCreationUtils.debug();
        return;
      }
      await teamCreationUtils.cleanup();
    }
  },
  teamCreationUtils3Users: async ({ browser, page, environment }, use) => {
    const teamCreationUtils = new TeamCreationUtils();
    try {
      await teamCreationUtils.createTestTeamAndUsers({ browser, page });
      await use(teamCreationUtils);
    } catch (ex) {
      console.error('Error in teamSetup', ex);
      throw ex;
    } finally {
      if (environment.PLAYWRIGHT_KEEP_DATA) {
        console.log('Skipping team cleanup based on PLAYWRIGHT_KEEP_DATA env var');
        teamCreationUtils.debug();
        return;
      }
      await teamCreationUtils.cleanup();
    }
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
  queryPage: async ({ page, apiRequestUtils }, use) => {
    await apiRequestUtils.selectDefaultOrg();
    await use(new QueryPage(page, apiRequestUtils));
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
  profilePage: async ({ page, apiRequestUtils, playwrightPage }, use) => {
    await apiRequestUtils.selectDefaultOrg();
    await use(new ProfilePage(page, playwrightPage));
  },
  teamDashboardPage: async ({ page, playwrightPage }, use) => {
    await use(new TeamDashboardPage(page));
  },
});

export { expect } from '@playwright/test';
