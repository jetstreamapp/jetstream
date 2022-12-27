import { expect, test } from '@playwright/test';

test('should start page', async ({ page }) => {
  await page.goto('/');

  page.getByPlaceholder('Select an Org');

  await page.getByPlaceholder('Select an Org').click();
  await page.getByRole('option', { name: 'austin@atginfo-personal.com' }).click();

  expect(true).toBeTruthy();
});
