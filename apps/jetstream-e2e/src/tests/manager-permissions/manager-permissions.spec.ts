/* eslint-disable playwright/no-conditional-expect */
/* eslint-disable playwright/no-conditional-in-test */
import { expect, test } from '../../fixtures/fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/app');
});

test.describe.configure({ mode: 'parallel' });

test.describe('MANAGE PERMISSIONS', () => {
  const continueButtonTestCases = [
    {
      profileNames: ['Standard User'],
      permissionSetNames: [],
      sobjectNames: [],
      enabled: false,
    },
    {
      profileNames: ['Standard User'],
      permissionSetNames: ['Jetstream'],
      sobjectNames: [],
      enabled: false,
    },
    {
      profileNames: [],
      permissionSetNames: [],
      sobjectNames: ['Account'],
      enabled: false,
    },
    {
      profileNames: ['Standard User'],
      permissionSetNames: [],
      sobjectNames: ['Account'],
      enabled: true,
    },
    {
      profileNames: [],
      permissionSetNames: ['Jetstream'],
      sobjectNames: ['Account'],
      enabled: true,
    },
  ];

  for (const testCase of continueButtonTestCases) {
    test(`Should test the continue button for profiles: ${testCase.profileNames.join()}, permSets: ${testCase.permissionSetNames.join(
      ','
    )}, objects:${testCase.sobjectNames}`, async ({ page, managePermissionPage }) => {
      await managePermissionPage.goto();
      await managePermissionPage.selectProfilesPermissionSetsAndObjects(testCase);
      if (testCase.enabled) {
        await expect(managePermissionPage.continueButton).toBeVisible();
      } else {
        await expect(managePermissionPage.continueButtonDisabled).toBeVisible();
        await expect(managePermissionPage.continueButtonDisabled).toBeDisabled();
      }
    });
  }

  test('Should allow selecting profiles, permission sets and objects', async ({ page, managePermissionPage }) => {
    await managePermissionPage.goto();
    await managePermissionPage.selectProfilesPermissionSetsAndObjects({
      profileNames: ['Standard User'],
      permissionSetNames: ['Jetstream'],
      sobjectNames: ['Account', 'Contact', 'Opportunity'],
    });

    await expect(managePermissionPage.continueButton).toBeVisible();

    await managePermissionPage.gotoEditor();

    await test.step('Validate field dependencies work', async () => {
      const read = managePermissionPage.getCheckboxLocator('Account', 'AccountNumber', 'profile', 'read');
      const edit = managePermissionPage.getCheckboxLocator('Account', 'AccountNumber', 'profile', 'edit');

      await read.uncheck();
      await expect(read).toBeChecked({ checked: false });
      await expect(edit).toBeChecked({ checked: false });

      await read.check();
      await expect(read).toBeChecked();
      await expect(edit).toBeChecked({ checked: false });

      await read.uncheck();
      await edit.check();
      await expect(read).toBeChecked();
      await expect(edit).toBeChecked();
    });

    await test.step('bulk edit row with dependencies', async () => {
      await page.getByPlaceholder('Filter...').click();
      await page.getByPlaceholder('Filter...').fill('level__c');
      await page.getByTestId('row-action-button-Contact.Level__c').click();

      await page.getByTestId('row-action-popover').locator('label').filter({ hasText: 'Edit' }).check();
      await expect(page.getByTestId('row-action-popover').locator('label').filter({ hasText: 'Read' })).toBeChecked();

      await page.getByRole('button', { name: 'Apply to Row' }).click();
      await expect(page.locator('[id="Contact\\.Level__c-0PSDn000003RK82OAG-read"]')).toBeChecked();
      await expect(page.locator('[id="Contact\\.Level__c-0PSDn000003RK82OAG-edit"]')).toBeChecked();
      await expect(page.locator('[id="Contact\\.Level__c-0PSDn000001M6CFOA0-read"]')).toBeChecked();
      await expect(page.locator('[id="Contact\\.Level__c-0PSDn000001M6CFOA0-edit"]')).toBeChecked();

      await page.getByTestId('row-action-popover').locator('label').filter({ hasText: 'Read' }).uncheck();
      await expect(page.getByTestId('row-action-popover').locator('label').filter({ hasText: 'Edit' })).toBeChecked({ checked: false });

      await page.getByRole('button', { name: 'Apply to Row' }).click();
      await expect(page.locator('[id="Contact\\.Level__c-0PSDn000003RK82OAG-read"]')).toBeChecked({ checked: false });
      await expect(page.locator('[id="Contact\\.Level__c-0PSDn000003RK82OAG-edit"]')).toBeChecked({ checked: false });
      await expect(page.locator('[id="Contact\\.Level__c-0PSDn000001M6CFOA0-read"]')).toBeChecked({ checked: false });
      await expect(page.locator('[id="Contact\\.Level__c-0PSDn000001M6CFOA0-edit"]')).toBeChecked({ checked: false });

      await page.getByTestId('row-action-popover').locator('label').filter({ hasText: 'Read' }).check();
      await expect(page.getByTestId('row-action-popover').locator('label').filter({ hasText: 'Edit' })).toBeChecked({ checked: false });

      await page.getByRole('button', { name: 'Apply to Row' }).click();
      await expect(page.locator('[id="Contact\\.Level__c-0PSDn000003RK82OAG-read"]')).toBeChecked();
      await expect(page.locator('[id="Contact\\.Level__c-0PSDn000003RK82OAG-edit"]')).toBeChecked({ checked: false });
      await expect(page.locator('[id="Contact\\.Level__c-0PSDn000001M6CFOA0-read"]')).toBeChecked();
      await expect(page.locator('[id="Contact\\.Level__c-0PSDn000001M6CFOA0-edit"]')).toBeChecked({ checked: false });
      await page.getByRole('button', { name: 'Close dialog' }).click();
    });

    await test.step('save', async () => {
      await page.getByRole('button', { name: 'Save' }).click();
      await page.getByRole('button', { name: 'Save Changes' }).click();
      // TODO: validate saved changes
    });
  });

  // TODO: reset changes

  // TODO: tab visibility

  // TODO: object permissions
});
