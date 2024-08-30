/* eslint-disable no-empty-pattern */
import { clerkSetup, setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test as setup } from '@playwright/test';

const authFile = 'playwright/.auth.json';

const baseApiURL = 'http://localhost:3333';

setup('global setup', async ({ page, request }) => {
  console.log('GLOBAL SETUP - STARTED');
  console.log('Ensuring E2E org exists');
  await clerkSetup({ publishableKey: process.env.NX_PUBLIC_CLERK_PUBLISHABLE_KEY });

  if (!process.env.E2E_LOGIN_USERNAME || !process.env.E2E_LOGIN_PASSWORD) {
    throw new Error('Provide E2E_LOGIN_USERNAME and E2E_LOGIN_PASSWORD environment variables.');
  }

  await setupClerkTestingToken({ page });

  await page.goto('http://localhost:3333/sign-in');
  await expect(page.locator('h1')).toContainText('Sign in to Jetstream');
  await page.waitForSelector('.cl-signIn-root', { state: 'attached' });
  await page.locator('input[name=identifier]').fill(process.env.E2E_LOGIN_USERNAME!);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator('input[name=password]').fill(process.env.E2E_LOGIN_PASSWORD!);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  await page
    .getByTestId('content')
    .locator('div')
    .filter({ has: page.getByRole('heading', { name: 'QUERY' }) });

  await request.post(`${baseApiURL}/test/e2e-integration-org`, {
    failOnStatusCode: true,
  });

  await page.goto('http://localhost:4200/app');

  await page.getByPlaceholder('Select an Org').click();
  await page.getByRole('option', { name: process.env.E2E_LOGIN_USERNAME }).click();

  await page.context().storageState({ path: authFile });
  console.log('GLOBAL SETUP - FINISHED\n');
});
