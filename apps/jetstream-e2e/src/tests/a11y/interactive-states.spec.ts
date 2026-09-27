import { expect, test } from '../../fixtures/fixtures';
import { assertBaselineEntry, runA11yScan } from './a11y.utils';

test.describe.configure({ mode: 'parallel' });

/**
 * Axe-core scans of interactive states that the page sweep can't see: open menus, populated
 * comboboxes/listboxes, open modals and the query results data grid. Page-level scans only
 * evaluate the closed/initial DOM, and most of the historically weak patterns (combobox
 * listboxes, menu roving focus, dialog labelling, grid semantics) only exist in the DOM once
 * opened.
 *
 * Every state needs a `state-<name>` entry in a11y-baseline.json — a new state fails until it is
 * baselined explicitly (see a11y.utils.ts).
 */
test.describe('a11y interactive states', () => {
  test('home page with navigation menu open', async ({ page }, testInfo) => {
    const scanKey = 'state-nav-menu-open';
    assertBaselineEntry(scanKey);

    await page.goto('/app');
    await page.getByTestId('header').getByRole('button', { name: 'Load Records', exact: true }).click();
    await expect(page.getByRole('menuitemcheckbox', { name: 'Load Records', exact: true })).toBeVisible();

    await runA11yScan(page, testInfo, scanKey);
  });

  test('header avatar dropdown menu open', async ({ page }, testInfo) => {
    const scanKey = 'state-header-avatar-menu-open';
    assertBaselineEntry(scanKey);

    await page.goto('/app');
    await page.getByRole('button', { name: 'Avatar' }).click();
    await expect(page.getByRole('menuitem', { name: 'Profile' })).toBeVisible();

    await runA11yScan(page, testInfo, scanKey);
  });

  test('query builder with object list loaded', async ({ page, queryPage }, testInfo) => {
    const scanKey = 'state-query-sobject-list';
    assertBaselineEntry(scanKey);

    await queryPage.goto();
    await expect(queryPage.sobjectList.getByTestId('Account')).toBeVisible();

    await runA11yScan(page, testInfo, scanKey);
  });

  test('query builder with object selected and fields visible', async ({ page, queryPage }, testInfo) => {
    const scanKey = 'state-query-fields-list';
    assertBaselineEntry(scanKey);

    await queryPage.goto();
    await queryPage.selectObject('Account');
    await expect(queryPage.fieldsList.getByText('Account ID', { exact: true })).toBeVisible();

    await runA11yScan(page, testInfo, scanKey);
  });

  test('query results data grid', async ({ page, queryPage }, testInfo) => {
    const scanKey = 'state-query-results-grid';
    assertBaselineEntry(scanKey);

    await queryPage.gotoResults('SELECT Id, Name, CreatedDate FROM Account LIMIT 10');
    await expect(page.getByRole('grid')).toBeVisible();

    await runA11yScan(page, testInfo, scanKey);
  });

  // TODO(a11y): extend with combobox-open (header org list), query-history modal, date-picker-open and
  // load-wizard step states.
});
