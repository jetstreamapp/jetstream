/* eslint-disable playwright/no-standalone-expect */
import { ENV } from '@jetstream/api-config';
import { join } from 'path';
import { z } from 'zod';
import { expect, test as setup } from '../fixtures/fixtures';

const environment = z
  .object({
    E2E_LOGIN_URL: z.string(),
    E2E_LOGIN_USERNAME: z.string(),
    E2E_LOGIN_PASSWORD: z.string(),
  })
  .parse(process.env);

const baseApiURL = ENV.JETSTREAM_SERVER_URL!;
const baseAppURL = ENV.JETSTREAM_CLIENT_URL!;
const authFile = join('playwright/.auth/web-ext-user.json');

// FIXME: this does not seem to work - storageState is saved, but we are not logged in to Salesforce
setup('authenticate', async ({ page, context, extensionId, authenticationPage, webExtensionPage }) => {
  console.log('GLOBAL SETUP - STARTED');

  console.log('Logging in to Salesforce');
  await webExtensionPage.loginToSalesforce(environment.E2E_LOGIN_URL, environment.E2E_LOGIN_USERNAME, environment.E2E_LOGIN_PASSWORD);
  await page.context().storageState({ path: authFile });

  const alreadyLoggedIn = await page.getByRole('link', { name: 'Go to Jetstream' }).isVisible();

  if (!alreadyLoggedIn) {
    console.log('Logging in to Jetstream');
    const user = ENV.EXAMPLE_USER;

    await page.goto(baseApiURL);

    await authenticationPage.loginOrGoToAppIfLoggedIn(user.email, ENV.EXAMPLE_USER_PASSWORD as string);

    await expect(page.getByRole('button', { name: 'Avatar' })).toBeVisible();
  }

  console.log('GLOBAL SETUP - FINISHED\n');

  console.log(`Saving storage state: ${authFile}\n`);

  context.storageState({ path: authFile });
});
