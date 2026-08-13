import { Page } from '@playwright/test';

/**
 * Fill in the username and password on a Salesforce login page.
 *
 * Salesforce serves two variants of this page. `login.salesforce.com` renders the username and password
 * fields together, but My Domain login pages are identity-first: the username has to be submitted before
 * the password field is rendered at all.
 *
 * Submitting the completed form is left to the caller so that it can register navigation or popup
 * listeners before the login is triggered.
 */
export async function fillSalesforceLoginForm(page: Page, username: string, password: string) {
  const usernameInput = page.getByLabel('Username');
  const passwordInput = page.getByLabel('Password');

  await usernameInput.click();
  await usernameInput.fill(username);

  // Both fields ship in the same response on the combined page, so a missing password field here means
  // Salesforce served the identity-first page and is waiting on the username before revealing it.
  if ((await passwordInput.count()) === 0) {
    await page.getByRole('button', { name: 'Log In' }).click();
  }

  await passwordInput.click();
  await passwordInput.fill(password);
}
