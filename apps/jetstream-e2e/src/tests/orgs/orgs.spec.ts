import { prisma } from '@jetstream/api-config';
import { expect, test } from '../../fixtures/fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/app');
});

test.describe.configure({ mode: 'serial' });

test.describe('Salesforce Orgs + Jetstream Orgs', () => {
  test.beforeAll(async ({ environment }) => {
    await prisma.jetstreamOrganization.deleteMany();
    await prisma.salesforceOrg.deleteMany({
      where: {
        username: {
          in: [environment.TEST_ORG_2, environment.TEST_ORG_2],
        },
      },
    });
  });

  test('Salesforce Org Lifecycle', async ({ page, environment, orgGroupPage }) => {
    await test.step('Add a production org', async () => {
      await orgGroupPage.addSalesforceOrg(environment.TEST_ORG_2, environment.E2E_LOGIN_PASSWORD, {
        type: 'production',
      });
      await expect(orgGroupPage.orgDropdown).toHaveValue(environment.TEST_ORG_2);
    });

    await test.step('Ensure frontdoor login works', async () => {
      await page.getByPlaceholder('Select an Org').click();
      await page.getByTestId('header').getByTestId('org-info-popover-button').click();
      await page.getByRole('link', { name: 'Setup Menu' }).click();
      const salesforcePage = await page.waitForEvent('popup');
      await salesforcePage.getByRole('tab', { name: 'Object Manager' }).click();
      await salesforcePage.close();
    });

    await test.step('Add an org with a custom domain', async () => {
      await orgGroupPage.addSalesforceOrg(environment.TEST_ORG_3, environment.E2E_LOGIN_PASSWORD, {
        type: 'custom',
        domain: new URL(environment.E2E_LOGIN_URL).hostname.replace('.my.salesforce.com', ''),
      });
      await expect(orgGroupPage.orgDropdown).toHaveValue(environment.TEST_ORG_3);
    });

    let orgGroupName = 'Test Org';
    let orgGroupDescription = 'Test Description';
    await orgGroupPage.goToOrgGroupPage();
    await expect(page.locator('[data-testid^="org-group-card-"]')).toHaveCount(1);
    let numberOfOrgGroups = await page.locator('[data-testid^="org-group-card-"]').count();

    await test.step('Create an Org Group and add orgs to it', async () => {
      await orgGroupPage.goToOrgGroupPage();
      await orgGroupPage.addOrgGroup(orgGroupName, orgGroupDescription);

      expect(await page.locator('[data-testid^="org-group-card-"]').count()).toBe(numberOfOrgGroups + 1);
      numberOfOrgGroups = await page.locator('[data-testid^="org-group-card-"]').count();

      await orgGroupPage.dragOrgToGroup(orgGroupName, environment.TEST_ORG_2);
      await orgGroupPage.dragOrgToGroup(orgGroupName, environment.TEST_ORG_3);

      await expect(page.getByRole('button', { name: 'Choose Group' })).toBeVisible();
    });

    await test.step('Ensure org dropdown shows correct orgs', async () => {
      await orgGroupPage.makeActiveOrgGroup(orgGroupName);
      await expect(page.getByTestId('header').getByText(orgGroupName)).toBeVisible();

      await orgGroupPage.orgDropdownContainer.click();
      const orgGroup = orgGroupPage.orgDropdownContainer.getByRole('listbox').getByRole('group').getByRole('option');
      await expect(orgGroup).toHaveCount(2);
      await expect(orgGroup).toHaveText([environment.TEST_ORG_2, environment.TEST_ORG_3]);
    });

    await test.step('Edit Org Group', async () => {
      const newOrgGroupName = 'Updated Test Org';
      const newOrgGroupDescription = 'Updated Description';
      await orgGroupPage.editOrgGroup(orgGroupName, newOrgGroupName, newOrgGroupDescription);
      orgGroupName = newOrgGroupName;
      orgGroupDescription = newOrgGroupDescription;
      // Ensure that we did not add a new org group card, but instead updated the existing one
      expect(await page.locator('[data-testid^="org-group-card-"]').count()).toBe(numberOfOrgGroups);
    });

    // TODO: add test to delete orgGroup and all included orgs
    await test.step('Delete OrgGroup', async () => {
      await orgGroupPage.deleteOrgGroup(orgGroupName);

      await expect(page.getByText('Unassigned (3)')).toBeVisible();
    });
  });
});
