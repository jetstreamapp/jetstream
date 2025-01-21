import { ENV } from '@jetstream/api-config';
import { QueryPage } from '@jetstream/test/e2e-utils';
import { z } from 'zod';
import { expect, test } from '../fixtures/fixtures';

const environment = z
  .object({
    E2E_LOGIN_URL: z.string(),
    E2E_LOGIN_USERNAME: z.string(),
    E2E_LOGIN_PASSWORD: z.string(),
  })
  .parse(process.env);

test('Ensure we can login and logout of the extension', async ({ page, extensionId, webExtensionPage }) => {
  const user = ENV.EXAMPLE_USER;

  await webExtensionPage.loginToJetstream(user.email, ENV.EXAMPLE_USER_PASSWORD as string);
  await expect(page.getByText(/Logged in as/i)).toBeVisible();

  await webExtensionPage.logout();
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
});

test('Ensure extension shows up on Salesforce', async ({ page, webExtensionPage }) => {
  const user = ENV.EXAMPLE_USER;

  await test.step('Login to Salesforce and Extension', async () => {
    await webExtensionPage.loginToJetstream(user.email, ENV.EXAMPLE_USER_PASSWORD as string);
    await expect(page.getByText(/Logged in as/i)).toBeVisible();

    await webExtensionPage.loginToSalesforce(environment.E2E_LOGIN_URL, environment.E2E_LOGIN_USERNAME, environment.E2E_LOGIN_PASSWORD);
  });

  await test.step('Ensure page extension is visible in salesforce', async () => {
    await expect(webExtensionPage.sfdcButton).toBeVisible();
    webExtensionPage.openPopup();

    await expect(webExtensionPage.sfdcButtonPopupHeader).toBeVisible();
    await expect(webExtensionPage.sfdcButtonPopupBody).toBeVisible();

    await webExtensionPage.closePopup();
  });
});

test('Query page can be accessed and used', async ({ page, webExtensionPage, apiRequestUtils }) => {
  const user = ENV.EXAMPLE_USER;

  await test.step('Login to Salesforce and Extension', async () => {
    await webExtensionPage.loginToJetstream(user.email, ENV.EXAMPLE_USER_PASSWORD as string);
    await expect(page.getByText(/Logged in as/i)).toBeVisible();

    await webExtensionPage.loginToSalesforce(environment.E2E_LOGIN_URL, environment.E2E_LOGIN_USERNAME, environment.E2E_LOGIN_PASSWORD);
  });

  await test.step('Ensure page extension is visible in salesforce', async () => {
    await expect(webExtensionPage.sfdcButton).toBeVisible();
  });

  await test.step('Execute SOQL query', async () => {
    const extensionPagePromise = page.waitForEvent('popup');

    await webExtensionPage.goToAction('query');
    const extensionPage = await extensionPagePromise;

    const queryPage = new QueryPage(extensionPage, apiRequestUtils);

    await queryPage.selectObject('Account');
    await queryPage.selectFields(['Account Name', 'Account Description', 'Owner ID']);
    await queryPage.executeBtn.click();
    await expect(extensionPage.getByText(/Showing [0-9,]+ of [0-9,]+ records/)).toBeVisible();
  });
});

test('Record actions are available', async ({ page, webExtensionPage }) => {
  const user = ENV.EXAMPLE_USER;

  await test.step('Login to Salesforce and Extension', async () => {
    await webExtensionPage.loginToJetstream(user.email, ENV.EXAMPLE_USER_PASSWORD as string);
    await expect(page.getByText(/Logged in as/i)).toBeVisible();

    await webExtensionPage.loginToSalesforce(environment.E2E_LOGIN_URL, environment.E2E_LOGIN_USERNAME, environment.E2E_LOGIN_PASSWORD);
  });

  await test.step('Ensure page extension is visible in salesforce', async () => {
    await expect(webExtensionPage.sfdcButton).toBeVisible();
  });

  await test.step('Go to salesforce record page', async () => {
    await page.getByRole('button', { name: 'App Launcher' }).click();
    await page.getByPlaceholder('Search apps and items...').fill('accounts');
    await page.getByRole('option', { name: 'Accounts' }).click();

    await page.getByLabel('Search', { exact: true }).click();
    await page.getByPlaceholder('Search...').fill('burlington');
    await page.getByRole('dialog').getByTitle('Burlington Textiles Corp of').last().click();

    await page.waitForURL((url) => url.pathname.includes('/Account/001'));
  });

  await test.step('View record in Jetstream', async () => {
    await expect(webExtensionPage.sfdcButton).toBeVisible();
    webExtensionPage.openPopup();

    await expect(webExtensionPage.sfdcButtonPopupRecordAction).toBeVisible();

    const extensionPagePromise = page.waitForEvent('popup');
    await webExtensionPage.goToAction('viewRecord');
    const extensionPage = await extensionPagePromise;

    await expect(extensionPage.getByText(/View Record/)).toBeVisible();
    await expect(extensionPage.getByText(/Account - Burlington Textiles Corp of America/)).toBeVisible();
  });

  await test.step('Edit record in Jetstream', async () => {
    await expect(webExtensionPage.sfdcButton).toBeVisible();
    webExtensionPage.openPopup();

    await expect(webExtensionPage.sfdcButtonPopupRecordAction).toBeVisible();

    const extensionPagePromise = page.waitForEvent('popup');
    await webExtensionPage.goToAction('editRecord');
    const extensionPage = await extensionPagePromise;

    await expect(extensionPage.getByText(/Edit Record/)).toBeVisible();
    await expect(extensionPage.getByText(/Account - Burlington Textiles Corp of America/)).toBeVisible();
  });
});
