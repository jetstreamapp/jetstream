/* eslint-disable playwright/no-skipped-test */
import { expect, test } from '../../fixtures/fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/app');
});

test.describe.configure({ mode: 'parallel' });

test.describe('QUERY RESULTS', () => {
  // eslint-disable-next-line playwright/expect-expect
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
    expect(page.url()).toContain('/query/results');
    await queryPage.waitForQueryResults(query1);

    const query2 = `SELECT Id, Name FROM Contact`;
    await queryPage.gotoResults(query2);
    await queryPage.waitForQueryResults(query2);

    await queryPage.performQueryHistoryAction(query2, 'EXECUTE');
    expect(page.url()).toContain('/query/results');
    await queryPage.waitForQueryResults(query2);

    const query3 = `SELECT Id, Name, IsActive FROM Product2`;
    await queryPage.gotoResults(query3);
    await queryPage.waitForQueryResults(query3);

    await queryPage.performQueryHistoryAction(query3, 'EXECUTE');
    expect(page.url()).toContain('/query/results');
    await queryPage.waitForQueryResults(query3);
  });

  test.skip('Query history should work for tooling queries', async ({ queryPage, page }) => {
    const query = 'SELECT Id, FullName FROM CustomField LIMIT 1';
    await queryPage.gotoResults(query, true);
    expect(page.url()).toContain('/query/results');
    await queryPage.waitForQueryResults(query, true);

    await queryPage.performQueryHistoryAction(query, 'EXECUTE');
    expect(page.url()).toContain('/query/results');
  });

  test('restore should work from changes made on results page', async ({ queryPage, page }) => {
    // const query1 = `SELECT Id, BillingAddress, CreatedBy.Id, CreatedBy.Name, CreatedBy.IsActive, Type FROM Account`;
    // await queryPage.gotoResults(query1);
    // await expect(page.url()).toContain('/query/results');
    // await queryPage.waitForQueryResults(query1);

    // FIXME: this query intermittently does not show up in query history
    const query2 = `SELECT Id, Name, (SELECT Id, Name, AccountId, Email FROM Contacts) FROM Account`;
    await queryPage.gotoResults(query2);
    expect(page.url()).toContain('/query/results');
    await queryPage.waitForQueryResults(query2);

    // const query3 = `SELECT Id, Name, IsActive FROM Product2`;
    // await queryPage.gotoResults(query3);
    // await expect(page.url()).toContain('/query/results');
    // await queryPage.waitForQueryResults(query3);

    await queryPage.performQueryHistoryAction(query2, 'RESTORE');
    page.getByTestId('query-builder-page').getByText('Query Records');

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

  test('Bulk record update should work from query results', async ({ queryPage, page }) => {
    const query = `SELECT Id, Name, Fax FROM Account LIMIT 1`;
    await queryPage.gotoResults(query);
    await queryPage.waitForQueryResults(query);

    await page.getByRole('button', { name: 'Record actions' }).click();
    await page.getByRole('menuitem', { name: 'Bulk update records' }).click();

    const bulkUpdateModal = page.getByTestId('bulk-update-query-results-modal');

    await expect(bulkUpdateModal).toBeVisible();

    await bulkUpdateModal.getByTestId('dropdown-Field to Update').getByPlaceholder('Select an Option').click();
    await bulkUpdateModal.getByTestId('dropdown-Field to Update').getByPlaceholder('Select an Option').fill('fax');

    const value = `test-value-${new Date().getTime()}`;
    await bulkUpdateModal.getByTestId('dropdown-Field to Update').getByText('Account Fax').click();
    await bulkUpdateModal.getByPlaceholder('Value to set on each record').fill(value);

    await bulkUpdateModal.getByRole('button', { name: /Update [0-9]+ Record(s)?/ }).click();

    // TODO: add mock API response to speed test up and ensure it is not flaky
    await expect(bulkUpdateModal.getByText('Finished')).toBeVisible({ timeout: 60_000 });

    // View and then Download from teh view modal
    await bulkUpdateModal.getByRole('button', { name: 'View' }).click();
    const loadRecordResultsModal = page.getByTestId('load-records-results-modal');
    await loadRecordResultsModal.getByRole('button', { name: 'Download' }).click();

    const downloadRecordsModal = page.getByTestId('record-download-modal');
    await downloadRecordsModal.locator('label').filter({ hasText: 'CSV' }).locator('span').first().click();
    const downloadPromise = page.waitForEvent('download');
    await downloadRecordsModal.getByRole('button', { name: 'Download' }).click();
    const download = await downloadPromise;
    expect(download).toBeTruthy();

    // Download the updated records results
    await bulkUpdateModal.getByRole('button', { name: 'Download' }).click();
    await downloadRecordsModal.locator('label').filter({ hasText: 'CSV' }).locator('span').first().click();
    const download1Promise = page.waitForEvent('download');
    await downloadRecordsModal.getByRole('button', { name: 'Download' }).click();
    const download1 = await download1Promise;

    expect(download1).toBeTruthy();

    await bulkUpdateModal.getByRole('contentinfo').getByRole('button', { name: 'Close' }).click();
  });
});
