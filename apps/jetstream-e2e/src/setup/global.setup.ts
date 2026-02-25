/* eslint-disable playwright/no-standalone-expect */
import { ENV } from '@jetstream/api-config';
import { expect, test as setup } from '@playwright/test';
import { join } from 'path';

const baseApiURL = process.env.NX_PUBLIC_SERVER_URL || process.env.JETSTREAM_SERVER_URL || 'http://localhost:3333';

const authFile = join('playwright/.auth/user.json');

setup('login and ensure org exists', async ({ page, request }) => {
  console.log('GLOBAL SETUP - STARTED');

  console.log('Ensuring E2E org exists');
  await request.post(`${baseApiURL}/test/e2e-integration-org`, {
    failOnStatusCode: true,
  });

  console.log('Logging in as example user');
  const user = ENV.EXAMPLE_USER;

  const cookieBannerAcceptButton = page.getByRole('button', { name: 'Accept' });

  await page.goto(baseApiURL);

  try {
    await cookieBannerAcceptButton.waitFor({ state: 'visible', timeout: 5000 });
    await cookieBannerAcceptButton.click();
  } catch {
    console.log('Cookie banner not visible, skipping click.');
  }

  await page.getByRole('link', { name: 'Log in' }).click();
  await page.getByLabel('Email Address').click();
  await page.getByLabel('Email Address').fill(user.email);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Password').click();
  await page.getByLabel('Password').fill(ENV.EXAMPLE_USER_PASSWORD as string);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await page.waitForURL(`${baseApiURL}/app`);

  await expect(page.getByRole('button', { name: 'Avatar' })).toBeVisible();

  await page.evaluate(async () => {
    localStorage.setItem('TEST_USER_AGENT', navigator.userAgent);
  });

  await request.dispose();
  console.log('GLOBAL SETUP - FINISHED\n');

  console.log(`Saving storage state: ${authFile}\n`);

  await page.context().storageState({ path: authFile });
  await page.close();
});
