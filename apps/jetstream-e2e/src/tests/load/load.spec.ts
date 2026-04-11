import { expect } from '@playwright/test';
import { parse as parseCsv } from 'papaparse';
import { join } from 'path';
import { test } from '../../fixtures/fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/app');
});

test.describe.configure({ mode: 'parallel' });

test.describe('LOAD RECORDS', () => {
  // eslint-disable-next-line playwright/expect-expect
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

    // Switching API mode resets run state, so this is treated as a first load (no confirmation dialog)
    await loadSingleObjectPage.loadRecords('Bulk API');

    await loadSingleObjectPage.startOver();
  });

  test('Should retry failed batch API records', async ({ loadSingleObjectPage, page }) => {
    const csvFile = join(__dirname, `../../assets/records-Product2.csv`);
    const NUM_FAILURES = 3;

    await loadSingleObjectPage.goto();
    await loadSingleObjectPage.chooseObjectAndFile('Product2', csvFile, 'Update');
    await loadSingleObjectPage.mapFields('Update', 'Product', 0, 3);

    // Intercept the composite/sobjects batch API call and inject failures for the first N records
    let shouldInjectFailures = true;
    await page.route('**/api/request', async (route) => {
      const request = route.request();
      const postData = request.postDataJSON();
      if (request.method() !== 'POST' || !postData?.url?.includes('/composite/sobjects') || !shouldInjectFailures) {
        return route.continue();
      }

      const response = await route.fetch();
      const responseJson = await response.json();

      if (Array.isArray(responseJson.data)) {
        responseJson.data = responseJson.data.map((result: Record<string, unknown>, i: number) => {
          if (i < NUM_FAILURES) {
            return {
              success: false,
              errors: [{ statusCode: 'FIELD_CUSTOM_VALIDATION_EXCEPTION', message: 'Test validation error', fields: [] }],
            };
          }
          return result;
        });
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(responseJson),
      });
    });

    await loadSingleObjectPage.loadRecords('Batch API');

    // Verify retry button is visible with the failure count
    const retryButton = page.getByRole('button', { name: /Retry Failed Records/ });
    await expect(retryButton).toBeVisible();

    // Stop injecting failures so the retry succeeds
    shouldInjectFailures = false;

    // Click retry and wait for it to finish
    await loadSingleObjectPage.retryFailedRecords();

    // After retry, there should be two run tabs visible
    await expect(page.getByText('Run 1')).toBeVisible();
    await expect(page.getByText('Retry 1')).toBeVisible();

    await loadSingleObjectPage.startOver();
  });
});
