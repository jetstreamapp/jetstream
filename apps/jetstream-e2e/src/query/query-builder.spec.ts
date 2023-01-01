import { expect, test } from '../fixtures/fixtures';

test.beforeAll(async ({ page }) => {
  await page.goto('/');
  // TODO: figure this out
  await page.getByPlaceholder('Select an Org').click();
  await page.getByRole('option', { name: 'austin@atginfo-personal.com' }).click();
});

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('Query builder should work with filters', async ({ queryPage }) => {
  await queryPage.goto();
  await queryPage.selectObject('Account');

  await queryPage.selectFields(['Account Name', 'Account Currency', 'Account Description', 'Owner ID']);

  await queryPage.validateQueryByLine(['SELECT Id, Name, CurrencyIsoCode, Description, OwnerId', 'FROM Account']);

  await queryPage.selectRelatedFields(1, 'User', ['User ID', 'Full Name', 'Account ID', 'Active', 'Address']);
  await queryPage.validateQueryByLine([
    'SELECT Id, Name, CreatedBy.Id, CreatedBy.Name, CreatedBy.AccountId, CreatedBy.Address,',
    'CreatedBy.IsActive, CurrencyIsoCode, Description, OwnerId',
    'FROM Account',
  ]);

  await queryPage.addFilter({ conditionNumber: 1 }, 'Account Name', 'eq', { type: 'text', value: 'test' });
  await queryPage.validateQueryByLine([
    'SELECT Id, Name, CreatedBy.Id, CreatedBy.Name, CreatedBy.AccountId, CreatedBy.Address,',
    'CreatedBy.IsActive, CurrencyIsoCode, Description, OwnerId',
    'FROM Account',
    "WHERE Name = 'test'",
  ]);

  await queryPage.addCondition();

  await queryPage.addFilter({ conditionNumber: 2 }, 'Created Date', 'lt', { type: 'dropdown', value: 'Today' });

  await queryPage.validateQueryByLine([
    'SELECT Id, Name, CreatedBy.Id, CreatedBy.Name, CreatedBy.AccountId, CreatedBy.Address,',
    'CreatedBy.IsActive, CurrencyIsoCode, Description, OwnerId',
    'FROM Account',
    "WHERE Name = 'test'",
    'AND CreatedDate < TODAY',
  ]);

  await queryPage.addConditionGroup();

  await queryPage.addFilter({ conditionNumber: 1, groupNumber: 3 }, 'Account ID', 'in', { type: 'text', value: '123\n456' });

  await queryPage.validateQueryByLine([
    'SELECT Id, Name, CreatedBy.Id, CreatedBy.Name, CreatedBy.AccountId, CreatedBy.Address,',
    'CreatedBy.IsActive, CurrencyIsoCode, Description, OwnerId',
    'FROM Account',
    "WHERE Name = 'test'",
    'AND CreatedDate < TODAY',
    'AND (',
    `Id IN ('123', '456')`,
    ')',
  ]);

  await queryPage.addOrderBy('Created Date', 'DESC', 'LAST');

  await queryPage.validateQueryByLine([
    'SELECT Id, Name, CreatedBy.Id, CreatedBy.Name, CreatedBy.AccountId, CreatedBy.Address,',
    'CreatedBy.IsActive, CurrencyIsoCode, Description, OwnerId',
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
    'SELECT Id, Name, CreatedBy.Id, CreatedBy.Name, CreatedBy.AccountId, CreatedBy.Address,',
    'CreatedBy.IsActive, CurrencyIsoCode, Description, OwnerId',
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

test('Query builder should work with subqueries', async ({ queryPage }) => {
  await queryPage.goto();
  await queryPage.selectObject('Account');

  await queryPage.selectFields(['Account Name']);

  await queryPage.validateQueryByLine(['SELECT Id, Name, CurrencyIsoCode, Description, OwnerId', 'FROM Account']);

  await queryPage.selectSubquery('Contacts', ['Contact ID', 'Full Name', 'Account ID', 'Email']);

  await queryPage.validateQueryByLine(['SELECT Id, Name', '(', 'SELECT Id, Name, AccountId, Email', 'From Contacts', ')', 'FROM Account']);
});

test('Query builder should restore queries', async ({ queryPage }) => {
  const query = `SELECT Id, Name,
	(
		SELECT Id, Name, AccountId, Email
		FROM Contacts
	)
FROM Account`;

  await queryPage.setManualQuery(query, 'RESTORE');

  // TODO: add other related fields

  await queryPage.validateQueryByLine(['SELECT Id, Name', '(', 'SELECT Id, Name, AccountId, Email', 'From Contacts', ')', 'FROM Account']);

  await expect(queryPage.sobjectList.getByTestId('Account')).toHaveAttribute('aria-selected', 'true');

  //     await locator.getByText(label, { exact: true }).first().click();

  // await page
  // .getByRole('listitem')
  // .filter({ has: page.getByRole('heading', { name: 'Product 2' })})
  // .getByRole('button', { name: 'Add to cart' })
  // .click()

  // await expect(page
  // .getByRole('listitem')
  // .filter({ has: page.getByText('Product 2') }))
  // .toHaveCount(1);

  for (const field of ['Account ID', 'Account Name']) {
    await expect(queryPage.getSelectedField(field)).toHaveAttribute('aria-selected', 'true');
  }

  // TODO: validate subquery fields

  // validate everything is selected
  // getByRole('option', { name: 'Account Account' })
});
