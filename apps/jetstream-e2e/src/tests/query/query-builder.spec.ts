import { expect, test } from '../../fixtures/fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/app');
});

test.describe.configure({ mode: 'parallel' });

test.describe('QUERY BUILDER', () => {
  // TODO: add test for drilling in to related query filters
  // eslint-disable-next-line playwright/expect-expect
  test('should work with filters', async ({ queryPage }) => {
    await queryPage.goto();
    await queryPage.selectObject('Account');

    await queryPage.selectFields(['Account Name', 'Account Description', 'Owner ID']);

    await queryPage.validateQueryByLine(['SELECT Id, Name, Description, OwnerId', 'FROM Account']);

    await queryPage.selectRelatedFields(1, 'User', ['User ID', 'Full Name', 'Account ID', 'Active', 'Address']);
    await queryPage.validateQueryByLine([
      'SELECT Id, Name, CreatedBy.Id, CreatedBy.Name, CreatedBy.AccountId, CreatedBy.Address,',
      'CreatedBy.IsActive, Description, OwnerId',
      'FROM Account',
    ]);

    await queryPage.addFilter({ conditionNumber: 1 }, 'Account Name', 'eq', { type: 'text', value: 'test' });
    await queryPage.validateQueryByLine([
      'SELECT Id, Name, CreatedBy.Id, CreatedBy.Name, CreatedBy.AccountId, CreatedBy.Address,',
      'CreatedBy.IsActive, Description, OwnerId',
      'FROM Account',
      "WHERE Name = 'test'",
    ]);

    await queryPage.addCondition();

    await queryPage.addFilter({ conditionNumber: 2 }, 'Created Date', 'lt', { type: 'dropdown', value: 'Today' });

    await queryPage.validateQueryByLine([
      'SELECT Id, Name, CreatedBy.Id, CreatedBy.Name, CreatedBy.AccountId, CreatedBy.Address,',
      'CreatedBy.IsActive, Description, OwnerId',
      'FROM Account',
      "WHERE Name = 'test'",
      'AND CreatedDate < TODAY',
    ]);

    await queryPage.addConditionGroup();

    await queryPage.addFilter({ conditionNumber: 1, groupNumber: 3 }, 'Account ID', 'in', { type: 'text', value: '123\n456' });

    await queryPage.validateQueryByLine([
      'SELECT Id, Name, CreatedBy.Id, CreatedBy.Name, CreatedBy.AccountId, CreatedBy.Address,',
      'CreatedBy.IsActive, Description, OwnerId',
      'FROM Account',
      "WHERE Name = 'test'",
      'AND CreatedDate < TODAY',
      'AND (',
      `Id IN ('123', '456')`,
      ')',
    ]);

    await queryPage.addOrderBy('Created Date', 'DESC', 'LAST', 1);

    await queryPage.validateQueryByLine([
      'SELECT Id, Name, CreatedBy.Id, CreatedBy.Name, CreatedBy.AccountId, CreatedBy.Address,',
      'CreatedBy.IsActive, Description, OwnerId',
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
      'CreatedBy.IsActive, Description, OwnerId',
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

  test('should combine repeated conditions into an In condition', async ({ queryPage, page }) => {
    await queryPage.goto();
    await queryPage.selectObject('Account');
    await queryPage.selectFields(['Account Name']);

    await queryPage.setFilterAction('OR');
    await queryPage.addFilter({ conditionNumber: 1 }, 'Account Name', 'eq', { type: 'text', value: 'Acme' });
    await queryPage.addCondition();
    await queryPage.addFilter({ conditionNumber: 2 }, 'Account Name', 'eq', { type: 'text', value: 'Initech' });

    await expect(page.getByText(/appears in 2 conditions/)).toBeVisible();

    await page.getByRole('button', { name: 'Use In operator for Name' }).click();

    // the two conditions collapse into one row using the multi value textarea
    await expect(page.getByText(/appears in 2 conditions/)).toBeHidden();
    await expect(page.getByRole('group', { name: 'Condition 2' })).toBeHidden();
    await expect(page.getByRole('group', { name: 'Condition 1' }).getByLabel('Value')).toHaveValue('Acme\nInitech');

    await expect(page.getByRole('code').locator('div').filter({ hasText: `WHERE Name IN ('Acme', 'Initech')` }).first()).toBeVisible();
  });

  // eslint-disable-next-line playwright/expect-expect
  test('should work with subqueries', async ({ queryPage }) => {
    await queryPage.goto();
    await queryPage.selectObject('Account');

    await queryPage.selectFields(['Account Name']);

    await queryPage.validateQueryByLine(['SELECT Id, Name, Description, OwnerId', 'FROM Account']);

    await queryPage.selectSubquery('Contacts', ['Contact ID', 'Full Name', 'Account ID', 'Email']);

    await queryPage.validateQueryByLine([
      'SELECT Id, Name',
      '(',
      'SELECT Id, Name, AccountId, Email',
      'From Contacts',
      ')',
      'FROM Account',
    ]);
  });

  // eslint-disable-next-line playwright/expect-expect
  test('should work with nested subqueries', async ({ queryPage }) => {
    await queryPage.goto();
    await queryPage.selectObject('Account');

    await queryPage.selectNestedSubquery([
      { relationshipName: 'Contacts', childSObject: 'Contact', fieldLabels: ['Contact ID', 'Full Name'] },
      { relationshipName: 'Cases', childSObject: 'Case', fieldLabels: ['Case ID', 'Subject'] },
    ]);

    await queryPage.validateQueryByLine([
      'SELECT Id, Name, Description, OwnerId',
      '(',
      'SELECT Id, Name',
      '(',
      'SELECT Id, Subject',
      'FROM Cases',
      ')',
      'FROM Contacts',
      ')',
      'FROM Account',
    ]);
  });

  test('should restore nested subqueries', async ({ queryPage }) => {
    const query = `SELECT Id,
    (
      SELECT Id,
      (
        SELECT Id, Subject
        FROM Cases
      )
      FROM Contacts
    )
  FROM Account`;

    await queryPage.setManualQuery(query, 'RESTORE');

    await queryPage.validateQueryByLine([
      'SELECT Id',
      '(',
      'SELECT Id',
      '(',
      'SELECT Id, Subject',
      'FROM Cases',
      ')',
      'FROM Contacts',
      ')',
      'FROM Account',
    ]);

    // The nested subquery must be restored into the builder, not silently dropped
    await queryPage.selectSubqueryObject('Contacts');
    await expect(queryPage.getSelectedField('Contact ID')).toBeChecked();

    await queryPage.drillIntoRelatedObject('Contact');
    await queryPage.page.getByPlaceholder('Filter child objects').fill('Cases');
    await queryPage.page.getByTestId('Cases').click();

    for (const field of ['Case ID', 'Subject']) {
      await expect(queryPage.getSelectedField(field)).toBeChecked();
    }
  });

  test('should jump to a nested subquery from the navigator', async ({ queryPage }) => {
    await queryPage.goto();
    await queryPage.selectObject('Account');

    await queryPage.selectNestedSubquery([
      { relationshipName: 'Contacts', childSObject: 'Contact', fieldLabels: ['Contact ID'] },
      { relationshipName: 'Cases', childSObject: 'Case', fieldLabels: ['Case ID', 'Subject'] },
    ]);

    // Back at the top level the nested subquery is not listed, so the navigator is the only way to reach it
    await queryPage.navigateToSubqueryBreadcrumb('Account');
    await queryPage.navigateToSubqueryFromNavigator('Cases', 'Case');

    for (const field of ['Case ID', 'Subject']) {
      await expect(queryPage.getSelectedField(field)).toBeChecked();
    }
  });

  test('should restore queries', async ({ queryPage }) => {
    const query = `SELECT Id, Name,
    (
      SELECT Id, Name, AccountId, Email
      FROM Contacts
    )
  FROM Account`;

    await queryPage.setManualQuery(query, 'RESTORE');

    // TODO: add other related fields

    await queryPage.validateQueryByLine([
      'SELECT Id, Name',
      '(',
      'SELECT Id, Name, AccountId, Email',
      'From Contacts',
      ')',
      'FROM Account',
    ]);

    await expect(queryPage.sobjectList.getByTestId('Account')).toHaveAttribute('aria-selected', 'true');

    for (const field of ['Account ID', 'Account Name']) {
      await expect(queryPage.getSelectedField(field)).toBeChecked();
    }

    await queryPage.selectSubqueryObject('Contacts');

    for (const field of ['Contact ID', 'Full Name', 'Account ID', 'Email']) {
      await expect(queryPage.getSelectedField(field)).toBeChecked();
    }
  });

  test('should reset query', async ({ queryPage }) => {
    const query = `SELECT Id, Name,
    (
      SELECT Id, Name, AccountId, Email
      FROM Contacts
    )
  FROM Account`;

    await queryPage.setManualQuery(query, 'RESTORE');

    // TODO: add other related fields

    await queryPage.validateQueryByLine([
      'SELECT Id, Name',
      '(',
      'SELECT Id, Name, AccountId, Email',
      'From Contacts',
      ')',
      'FROM Account',
    ]);

    await expect(queryPage.sobjectList.getByTestId('Account')).toHaveAttribute('aria-selected', 'true');

    await queryPage.resetQueryPage();

    await expect(queryPage.sobjectList.getByTestId('Account')).toHaveAttribute('aria-selected', 'false');
  });
});
