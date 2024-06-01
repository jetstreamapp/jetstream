import { expect, test } from '../../fixtures/fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/app');
});

test.describe.configure({ mode: 'parallel' });

test.describe('LOAD WITHOUT FILE', () => {
  test('Should allow updating records', async ({ page, loadWithoutFilePage }) => {
    await loadWithoutFilePage.goto();
    await loadWithoutFilePage.selectObject('Account');
    await loadWithoutFilePage.selectField('Account Fax');
    await loadWithoutFilePage.configureStaticField('555-1234');
    await loadWithoutFilePage.validateAndReviewAndSubmit('1');

    await expect(page.getByText(/(In Progress)|(Finished)/)).toBeVisible();
  });

  test('Should allow configuration of single object', async ({ page, loadWithoutFilePage }) => {
    await loadWithoutFilePage.goto();
    await loadWithoutFilePage.selectObject('Account');
    await loadWithoutFilePage.selectField('Account Type');

    await expect(page.getByRole('button', { name: 'Review Changes' })).toBeDisabled();

    await loadWithoutFilePage.configureStaticPicklistField('Installation Partner');
    await page.getByTitle('"Type" will be set to "Installation Partner" on all records').waitFor();
    await expect(page.getByRole('button', { name: 'Validate Results' })).toBeEnabled();

    await loadWithoutFilePage.configureStaticPicklistField('Prospect');
    await page.getByTitle('"Type" will be set to "Prospect" on all records').waitFor();
    await expect(page.getByRole('button', { name: 'Validate Results' })).toBeEnabled();

    await loadWithoutFilePage.configureCriteria('Only if blank');
    await page.getByTitle(`"Type" will be set to "Prospect" on records where "Type" is blank`).waitFor();
    await expect(page.getByRole('button', { name: 'Validate Results' })).toBeEnabled();

    await loadWithoutFilePage.configureCriteria('Only if not blank');
    await page.getByTitle(`"Type" will be set to "Prospect" on records where "Type" is not blank`).waitFor();
    await expect(page.getByRole('button', { name: 'Validate Results' })).toBeEnabled();

    await loadWithoutFilePage.configureCriteria('Custom criteria', 'type = null');
    await page.getByTitle(`"Type" will be set to "Prospect"`).waitFor();
    await page.getByTitle(`type = null`).waitFor();
    await expect(page.getByRole('button', { name: 'Validate Results' })).toBeEnabled();

    await page.getByRole('button', { name: 'Validate Results' }).click();
    await expect(page.getByText(/[0-9]+ records will be updated/)).toBeVisible();

    await expect(page.getByRole('link', { name: 'Review Changes' })).toBeEnabled();
  });

  test('Should allow loading from query results', async ({ page, queryPage }) => {
    await queryPage.goto();
    await queryPage.selectObject('Account');
    await queryPage.selectFields(['Account Name', 'Account Fax']);
    await queryPage.submitQuery();
    await queryPage.clickBulkAction('Bulk update records');

    await page.getByTestId('dropdown-Field to Update').getByPlaceholder('Select an Option').click();
    await page.getByTestId('dropdown-Field to Update').getByPlaceholder('Select an Option').fill('fax');
    await page.getByRole('option', { name: 'Account Fax Fax phone' }).click();

    await page.getByTestId('dropdown-Record update to Apply').getByPlaceholder('Select an Option').click();
    await page.getByRole('option', { name: 'Value from different field' }).click();

    await page.getByTestId('dropdown-Field to use as value').getByPlaceholder('Select an Option').click();
    await page.getByTestId('dropdown-Field to use as value').getByPlaceholder('Select an Option').fill('name');
    await page.getByRole('option', { name: 'Account Name Name' }).click();

    await page.getByTestId('dropdown-Which records should be updated?').getByPlaceholder('Select an Option').click();
    await page.getByRole('option', { name: 'Only if not blank' }).click();

    await page.getByRole('button', { name: /Update [0-9]+ Records?/g }).click();
    await expect(page.getByRole('button', { name: /Update [0-9]+ Records?/g })).toBeDisabled();

    await expect(page.getByText(/(In Progress)|(Finished)/)).toBeVisible();
  });
  /**
   * TODO: Add more tests
   */
});
