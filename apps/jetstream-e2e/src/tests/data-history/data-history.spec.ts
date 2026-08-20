import { expect } from '@playwright/test';
import { join } from 'path';
import { test } from '../../fixtures/fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/app');
});

/**
 * Smoke coverage for Data History capture end-to-end. The storage backends are only reachable in a
 * real browser — OPFS needs `FileSystemSyncAccessHandle`, which jsdom does not implement — and
 * capture deliberately swallows its own errors, so a broken worker bundle, a broken user/org path
 * scope, or broken page wiring is invisible to unit tests and to the user. This asserts the whole
 * chain: a load writes an entry, the page renders it, and its saved payload reads back off the
 * storage backend as a real file.
 */
test.describe('DATA HISTORY', () => {
  test('captures a load and makes its saved results downloadable', async ({ loadSingleObjectPage, dataHistoryPage }) => {
    const csvFile = join(__dirname, `../../assets/records-Product2.csv`);

    await loadSingleObjectPage.goto();
    // NOTE: `chooseObjectAndFile`/`mapFields` never actually apply the load type — both lines that
    // would select it build a locator and never click it — so the load runs as the default, Insert.
    await loadSingleObjectPage.chooseObjectAndFile('Product2', csvFile, 'Insert');
    await loadSingleObjectPage.mapFields('Insert', 'Product', 0, 3);
    await loadSingleObjectPage.loadRecords('Batch API');

    await dataHistoryPage.goto();
    await dataHistoryPage.waitForEntry('Load Records');

    const row = dataHistoryPage.getRowByFeature('Load Records');
    await expect(row).toContainText('Product2');
    await expect(row).toContainText(/\d+ of \d+ succeeded/);

    await dataHistoryPage.openDetail('Load Records');
    // Counts are derived from the captured results payload, so a real count proves the results file
    // was written and read back — not merely that a row was created
    await expect(dataHistoryPage.detailDialog).toContainText(/\d+ of \d+ succeeded/);
    await expect(dataHistoryPage.detailDialog).toContainText('Insert');

    const download = await dataHistoryPage.downloadFirstPayload();
    // Name is built from the entry itself (`<source>_<objects>_<date>_<file>`), so this also
    // confirms the download resolved against the right entry
    expect(download.suggestedFilename()).toContain('load-records');
    expect(download.suggestedFilename()).toContain('Product2');
  });
});
