import { expect, test } from '../../fixtures/fixtures';
import { join } from 'path';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe.configure({ mode: 'parallel' });

test.describe('LOAD RECORDS', () => {
  test('should load basic file', async ({ loadSingleObjectPage }) => {
    // TODO:

    await loadSingleObjectPage.goto();
    const csv = join(__dirname, '../../assets/records-Product2.csv');
    await loadSingleObjectPage.selectFile(csv);

    /**
     * ensure warning shows up if file is added before object
     * "Select an object from the list on the left to continue"
     *
     * test other mapping basics
     */
  });
});
