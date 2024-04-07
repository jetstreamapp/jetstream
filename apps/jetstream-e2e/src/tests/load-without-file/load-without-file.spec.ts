import { test } from '../../fixtures/fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/app');
});

test.describe.configure({ mode: 'parallel' });

test.describe('LOAD WITHOUT FILE', () => {
  test('Form should allow configuration of single object', async ({ page, loadWithoutFilePage }) => {
    await loadWithoutFilePage.goto();
    await loadWithoutFilePage.selectObject('Account');
    await loadWithoutFilePage.selectField('Account Type');

    await loadWithoutFilePage.configureStaticPicklistField('Installation Partner');
    await page.getByTitle('"Type" will be set to "Installation Partner" on all records');

    await loadWithoutFilePage.configureStaticPicklistField('Prospect');
    await page.getByTitle('"Type" will be set to "Prospect" on all records');

    await loadWithoutFilePage.configureCriteria('Only if blank');
    await page.getByTitle(`"Type" will be set to "Prospect" on records where "Type" is blank`);

    await loadWithoutFilePage.configureCriteria('Only if not blank');
    await page.getByTitle(`"Type" will be set to "Prospect" on records where "Type" is not blank`);

    await loadWithoutFilePage.configureCriteria('Custom criteria', 'type = null');
    await page.getByTitle(`"Type" will be set to "Prospect"on records that meet your custom criteria: "type = null"`);
  });
  /**
   * TODO: Add more tests
   */
});
