import { ENV } from '@jetstream/api-config';
import { expect, test as setup } from '@playwright/test';
import { join } from 'path';

const baseApiURL = 'http://localhost:3333';

const authFile = join('playwright/.auth/user.json');

setup('login and ensure org exists', async ({ page, request }) => {
  console.log('GLOBAL SETUP - STARTED');

  console.log('Ensuring E2E org exists');
  await request.post(`${baseApiURL}/test/e2e-integration-org`, {
    failOnStatusCode: true,
  });

  console.log('Logging in as example user');
  const user = ENV.EXAMPLE_USER;

  await page.goto(baseApiURL);
  await page.getByRole('link', { name: 'Log in' }).click();
  await page.getByLabel('Email Address').click();
  await page.getByLabel('Email Address').fill(user.email);
  await page.getByLabel('Password').click();
  await page.getByLabel('Password').fill(ENV.EXAMPLE_USER_PASSWORD as string);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await page.waitForURL(`${baseApiURL}/app`);

  await expect(page.getByRole('button', { name: 'Avatar' })).toBeVisible();

  await page.evaluate(async () => {
    localStorage.setItem('TEST_USER_AGENT', navigator.userAgent);
  });

  await request.dispose();
  console.log('GLOBAL SETUP - FINISHED\n');

  console.log(`Saving storage state: ${authFile}\n`);

  await page.context().storageState({ path: authFile });
});
