import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://localhost:4200/');
  await page.goto('http://localhost:4200/app');
  await page.goto('http://localhost:4200/app/query');
  await page.getByPlaceholder('Select an Org').click();
  await page.getByRole('option', { name: 'austin@atginfo-personal.com' }).click();
});
