import { parse as parseCsv } from 'papaparse';
import { join } from 'path';
import { test } from '../../fixtures/fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/app');
});

test.describe.configure({ mode: 'parallel' });

test.describe('LOAD RECORDS', () => {
  test('Should upload file', async ({ loadSingleObjectPage, page }) => {
    const csvFile = join(__dirname, `../../assets/records-Product2.csv`);

    const { data } = parseCsv(csvFile, { header: true });

    await loadSingleObjectPage.goto();
    await loadSingleObjectPage.chooseObjectAndFile('Product2', csvFile, 'Update');

    await loadSingleObjectPage.mapFields('Update', 'Product', data.length, 3);

    await loadSingleObjectPage.loadRecords('Batch API');

    // TODO: mock failures so we can test the UI for them
    // TODO: should this be moved to POM?
    /**
     * Sometimes bulk API is queued for a while
     * the response is mocked to make it finish much faster
     * The API order of operations is:
     * POST request
     * GET job details
     * DELETE request
     * GET job details <-- this is the response that is mocked
     */
    let readyToFulfill = false;
    await page.route('**/api/bulk/750*', async (route) => {
      if (route.request().method() === 'DELETE') {
        readyToFulfill = true;
      }
      if (route.request().method() !== 'GET' || !readyToFulfill) {
        route.continue();
        return;
      }

      readyToFulfill = false;
      const response = await route.fetch();
      const responseJson = await response.json();

      responseJson.data.numberBatchesQueued = 0;
      responseJson.data.numberBatchesInProgress = 0;
      responseJson.data.numberBatchesCompleted = 1;
      responseJson.data.numberRecordsFailed = 0;
      responseJson.data.numberRecordsProcessed = data.length;
      responseJson.data.batches[0].state = 'Completed';
      responseJson.data.batches[0].numberRecordsProcessed = data.length;
      responseJson.data.batches[0].numberRecordsFailed = 0;

      return route.fulfill({
        status: 200,
        body: JSON.stringify(responseJson),
      });
    });

    await loadSingleObjectPage.loadRecords('Bulk API', true);

    await loadSingleObjectPage.startOver();
  });
});
