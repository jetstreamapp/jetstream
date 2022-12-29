import { test } from '@playwright/test';
import { QueryPage } from '../pageObjectModels/QueryPage.model';

test.beforeAll(async ({ page }) => {
  await page.goto('/');
  // TODO: figure this out
  await page.getByPlaceholder('Select an Org').click();
  await page.getByRole('option', { name: 'austin@atginfo-personal.com' }).click();
});

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('Query builder should work', async ({ page }) => {
  const queryPage = new QueryPage(page);
  const query = `SELECT Id, CreatedBy.Id, CreatedBy.Name, CreatedBy.AccountId, CreatedBy.Address, CreatedBy.IsActive FROM Account`;
  await queryPage.gotoResults(query);

  await queryPage.confirmQueryRecords();
  // TODO: do some stuff
});
