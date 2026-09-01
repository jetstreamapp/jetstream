import { expect, test } from '../../fixtures/fixtures';
import { runA11yScan } from './a11y.utils';

test.describe.configure({ mode: 'parallel' });

/**
 * Axe-core scans of interactive states that the page sweep can't see: open menus, populated
 * comboboxes/listboxes and the query results data grid. Page-level scans only evaluate the
 * closed/initial DOM, and most of the historically weak patterns (combobox listboxes, menu
 * roving focus, grid semantics) only exist in the DOM once opened.
 */
test.describe('a11y interactive states', () => {
  test('home page with navigation menu open', async ({ page }, testInfo) => {
    await page.goto('/app');
    await page.getByTestId('header').getByRole('button', { name: 'Load Records', exact: true }).click();
    await expect(page.getByRole('menuitemcheckbox', { name: 'Load Records', exact: true })).toBeVisible();

    await runA11yScan(page, testInfo, 'state-nav-menu-open');
  });

  test('query builder with object list loaded', async ({ page, queryPage }, testInfo) => {
    await queryPage.goto();
    await expect(queryPage.sobjectList.getByTestId('Account')).toBeVisible();

    await runA11yScan(page, testInfo, 'state-query-sobject-list');
  });

  test('query builder with object selected and fields visible', async ({ page, queryPage }, testInfo) => {
    await queryPage.goto();
    await queryPage.selectObject('Account');
    await expect(queryPage.fieldsList.getByText('Account ID', { exact: true })).toBeVisible();

    await runA11yScan(page, testInfo, 'state-query-fields-list');
  });

  test('query results data grid', async ({ page, queryPage }, testInfo) => {
    await queryPage.gotoResults('SELECT Id, Name, CreatedDate FROM Account LIMIT 10');
    await expect(page.getByRole('grid')).toBeVisible();

    await runA11yScan(page, testInfo, 'state-query-results-grid');
  });

  // TODO(a11y): extend with modal-open, date-picker-open and load-wizard step states once the
  // baseline for the sweep + these four states is established.
});
