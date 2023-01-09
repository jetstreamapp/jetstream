import { expect, test } from '../../fixtures/fixtures';
import { join } from 'path';
import { NODE_STREAM_INPUT, parse as parseCsv } from 'papaparse';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe.configure({ mode: 'parallel' });

test.describe('LOAD RECORDS', () => {
  test('Should upload file', async ({ loadSingleObjectPage }) => {
    const csvFile = join(__dirname, `../../assets/records-Product2.csv`);

    const { data } = parseCsv(csvFile, { header: true });

    await loadSingleObjectPage.goto();
    await loadSingleObjectPage.chooseObjectAndFile('Product2', csvFile, 'Update');

    await loadSingleObjectPage.mapFields('Update', 'Product', data.length, 3);

    await loadSingleObjectPage.loadRecords('Batch API');
    await loadSingleObjectPage.loadRecords('Bulk API', true);

    await loadSingleObjectPage.startOver();
  });
});
