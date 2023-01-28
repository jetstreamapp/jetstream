import { expect, test } from '../../fixtures/fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/app');
});

test.describe.configure({ mode: 'parallel' });

test.describe('QUERY RESULTS', async () => {
  test('should work', async ({ queryPage }) => {
    const query = `SELECT Id, BillingAddress, CreatedBy.Id, CreatedBy.Name, CreatedBy.IsActive, Type FROM Account`;
    await queryPage.gotoResults(query);

    // TODO: fetch query results independently to compare what is on the page

    await queryPage.confirmQueryRecords(query);
    // TODO: do some stuff
  });

  // FIXME: state storage has some issues - likely a race condition with storing to indexeddb
  // maybe the solution is to store individual records instead of the whole query results?
  test.skip('history should allow executing query from query results page', async ({ queryPage, page }) => {
    const query1 = `SELECT Id, BillingAddress, CreatedBy.Id, CreatedBy.Name, CreatedBy.IsActive, Type FROM Account`;
    await queryPage.gotoResults(query1);
    await queryPage.waitForQueryResults(query1);

    await queryPage.performQueryHistoryAction(query1, 'EXECUTE');
    await expect(page.url()).toContain('/query/results');
    await queryPage.waitForQueryResults(query1);

    const query2 = `SELECT Id, Name FROM Contact`;
    await queryPage.gotoResults(query2);
    await queryPage.waitForQueryResults(query2);

    await queryPage.performQueryHistoryAction(query2, 'EXECUTE');
    await expect(page.url()).toContain('/query/results');
    await queryPage.waitForQueryResults(query2);

    const query3 = `SELECT Id, Name, IsActive FROM Product2`;
    await queryPage.gotoResults(query3);
    await queryPage.waitForQueryResults(query3);

    await queryPage.performQueryHistoryAction(query3, 'EXECUTE');
    await expect(page.url()).toContain('/query/results');
    await queryPage.waitForQueryResults(query3);
  });

  test('restore should work from changes made on results page', async ({ queryPage, page }) => {
    // const query1 = `SELECT Id, BillingAddress, CreatedBy.Id, CreatedBy.Name, CreatedBy.IsActive, Type FROM Account`;
    // await queryPage.gotoResults(query1);
    // await expect(page.url()).toContain('/query/results');
    // await queryPage.waitForQueryResults(query1);

    // FIXME: this query intermittently does not show up in query history
    const query2 = `SELECT Id, Name, (SELECT Id, Name, AccountId, Email FROM Contacts) FROM Account`;
    await queryPage.gotoResults(query2);
    await expect(page.url()).toContain('/query/results');
    await queryPage.waitForQueryResults(query2);

    // const query3 = `SELECT Id, Name, IsActive FROM Product2`;
    // await queryPage.gotoResults(query3);
    // await expect(page.url()).toContain('/query/results');
    // await queryPage.waitForQueryResults(query3);

    await queryPage.performQueryHistoryAction(query2, 'RESTORE');
    await page.getByTestId('query-builder-page').getByText('Query Records');

    await queryPage.validateQueryByLine([
      'SELECT Id, Name',
      '(',
      'SELECT Id, Name, AccountId, Email',
      'From Contacts',
      ')',
      'FROM Account',
    ]);

    await expect(queryPage.sobjectList.getByTestId('Account')).toHaveAttribute('aria-selected', 'true');

    for (const field of ['Account ID', 'Account Name']) {
      await expect(queryPage.getSelectedField(field)).toHaveAttribute('aria-selected', 'true');
    }

    await queryPage.selectSubqueryObject('Contacts');

    for (const field of ['Contact ID', 'Full Name', 'Account ID', 'Email']) {
      await expect(queryPage.getSelectedField(field)).toHaveAttribute('aria-selected', 'true');
    }
  });
});
