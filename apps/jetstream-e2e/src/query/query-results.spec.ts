import { test } from '../fixtures/fixtures';

// test.beforeAll(async ({ page }) => {
//   await page.goto('/');
//   // TODO: figure this out
//   await page.getByPlaceholder('Select an Org').click();
//   await page.getByRole('option', { name: 'austin@atginfo-personal.com' }).click();
// });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('Query builder should work', async ({ queryPage }) => {
  const query = `SELECT Id, BillingAddress, CreatedBy.Id, CreatedBy.Name, CreatedBy.IsActive, Type FROM Account`;
  await queryPage.gotoResults(query);

  // TODO: fetch query results independently to compare what is on the page

  await queryPage.confirmQueryRecords(query);
  // TODO: do some stuff
});
