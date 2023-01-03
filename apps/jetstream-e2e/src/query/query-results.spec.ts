import { expect, test } from '../fixtures/fixtures';

// test.beforeAll(async ({ page }) => {
//   await page.goto('/');
//   // TODO: figure this out
//   await page.getByPlaceholder('Select an Org').click();
//   await page.getByRole('option', { name: 'austin@atginfo-personal.com' }).click();
// });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('Query results should work', async ({ queryPage }) => {
  const query = `SELECT Id, BillingAddress, CreatedBy.Id, CreatedBy.Name, CreatedBy.IsActive, Type FROM Account`;
  await queryPage.gotoResults(query);

  // TODO: fetch query results independently to compare what is on the page

  await queryPage.confirmQueryRecords(query);
  // TODO: do some stuff
});

test('Query history should work from query results page', async ({ queryPage, page }) => {
  const query1 = `SELECT Id, BillingAddress, CreatedBy.Id, CreatedBy.Name, CreatedBy.IsActive, Type FROM Account`;
  await queryPage.gotoResults(query1);
  await queryPage.waitForQueryResults(query1);

  const query2 = `SELECT Id, Name FROM Contact`;
  await queryPage.gotoResults(query2);
  await queryPage.waitForQueryResults(query2);

  const query3 = `SELECT Id, Name, IsActive FROM Product2`;
  await queryPage.gotoResults(query3);
  await queryPage.waitForQueryResults(query3);

  await queryPage.performQueryHistoryAction(query2, 'EXECUTE');
  await expect(page.url()).toContain('/query/results');

  // await page.getByRole('button', { name: 'History' }).click();
  // await page.getByRole('link', { name: 'Execute' }).click();
});
