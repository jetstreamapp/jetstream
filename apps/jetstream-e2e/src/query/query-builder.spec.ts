import { test } from '@playwright/test';
import { QueryPage } from '../pageObjectModels/QueryPage.model';

test.beforeAll(async ({ page }) => {
  await page.goto('/');
  // TODO: figure this out
  await page.getByPlaceholder('Select an Org').click();
  await page.getByRole('option', { name: 'austin@atginfo-personal.com' }).click();
});

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('Query builder should work', async ({ page }) => {
  const queryPage = new QueryPage(page);
  await queryPage.goto();
  await queryPage.selectObject('Account');

  await queryPage.selectFields(['Account ID', 'Account Name', 'Account Currency', 'Account Description', 'Owner ID']);

  await queryPage.validateQueryByLine(['SELECT Name, CurrencyIsoCode, Description, OwnerId', 'FROM Account']);

  await queryPage.selectRelatedFields(1, 'User', ['User ID', 'Full Name', 'Account ID', 'Active', 'Address']);
  await queryPage.validateQueryByLine([
    'SELECT Id, CreatedBy.Id, CreatedBy.Name, CreatedBy.AccountId, CreatedBy.Address,',
    'CreatedBy.IsActive',
    'FROM Account',
  ]);

  await queryPage.addFilter({ conditionNumber: 1 }, 'Account Name', 'eq', { type: 'text', value: 'test' });
  await queryPage.validateQueryByLine([
    'SELECT Id, CreatedBy.Id, CreatedBy.Name, CreatedBy.AccountId, CreatedBy.Address,',
    'CreatedBy.IsActive',
    'FROM Account',
    "WHERE Name = 'test'",
  ]);

  await queryPage.addCondition();

  await queryPage.addFilter({ conditionNumber: 2 }, 'Created Date', 'lt', { type: 'dropdown', value: 'Today' });

  await queryPage.validateQueryByLine([
    'SELECT Id, CreatedBy.Id, CreatedBy.Name, CreatedBy.AccountId, CreatedBy.Address,',
    'CreatedBy.IsActive',
    'FROM Account',
    "WHERE Name = 'test'",
    'AND CreatedDate < TODAY',
  ]);

  await queryPage.addConditionGroup();

  await queryPage.addFilter({ conditionNumber: 1, groupNumber: 3 }, 'Account ID', 'in', { type: 'text', value: '123\n456' });

  await queryPage.validateQueryByLine([
    'SELECT Id, CreatedBy.Id, CreatedBy.Name, CreatedBy.AccountId, CreatedBy.Address,',
    'CreatedBy.IsActive',
    'FROM Account',
    "WHERE Name = 'test'",
    'AND CreatedDate < TODAY',
    'AND (',
    `Id IN ('123', '456')`,
    ')',
  ]);

  await queryPage.addOrderBy('Created Date', 'DESC', 'LAST');

  await queryPage.validateQueryByLine([
    'SELECT Id, CreatedBy.Id, CreatedBy.Name, CreatedBy.AccountId, CreatedBy.Address,',
    'CreatedBy.IsActive',
    'FROM Account',
    "WHERE Name = 'test'",
    'AND CreatedDate < TODAY',
    'AND (',
    `Id IN ('123', '456')`,
    ')',
    '',
    'ORDER BY CreatedDate ASC NULLS LAST',
  ]);

  await queryPage.addLimit(10, 5);

  await queryPage.validateQueryByLine([
    'SELECT Id, CreatedBy.Id, CreatedBy.Name, CreatedBy.AccountId, CreatedBy.Address,',
    'CreatedBy.IsActive',
    'FROM Account',
    "WHERE Name = 'test'",
    'AND CreatedDate < TODAY',
    'AND (',
    `Id IN ('123', '456')`,
    ')',
    '',
    'ORDER BY CreatedDate ASC NULLS LAST',
    'LIMIT 10',
    'OFFSET 5',
  ]);
});
