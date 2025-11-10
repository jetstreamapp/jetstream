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

  test('Salesforce Org Lifecycle', async ({ page, environment, organizationsPage }) => {
    await test.step('Add a production org', async () => {
      await organizationsPage.addSalesforceOrg(environment.TEST_ORG_2, environment.E2E_LOGIN_PASSWORD, {
        type: 'production',
      });
      await expect(organizationsPage.orgDropdown).toHaveValue(environment.TEST_ORG_2);
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
      await organizationsPage.addSalesforceOrg(environment.TEST_ORG_3, environment.E2E_LOGIN_PASSWORD, {
        type: 'custom',
        domain: new URL(environment.E2E_LOGIN_URL).hostname.replace('.my.salesforce.com', ''),
      });
      await expect(organizationsPage.orgDropdown).toHaveValue(environment.TEST_ORG_3);
    });

    let organizationName = 'Test Org';
    let organizationDescription = 'Test Description';
    let numberOfOrgGroups = await page.locator('[data-testid^="org-group-card-"]').count();

    await test.step('Create a Jetstream Organization and add orgs to it', async () => {
      await organizationsPage.goToJetstreamOrganizationsPage();
      await organizationsPage.addJetstreamOrganization(organizationName, organizationDescription);

      expect(await page.locator('[data-testid^="org-group-card-"]').count()).toBe(numberOfOrgGroups + 1);
      numberOfOrgGroups = await page.locator('[data-testid^="org-group-card-"]').count();

      await organizationsPage.dragOrgToOrganization(organizationName, environment.TEST_ORG_2);
      await organizationsPage.dragOrgToOrganization(organizationName, environment.TEST_ORG_3);

      await expect(page.getByRole('button', { name: 'Choose Group' })).toBeVisible();
    });

    await test.step('Ensure org dropdown shows correct orgs', async () => {
      await organizationsPage.makeActiveJetstreamOrganization(organizationName);
      await expect(page.getByTestId('header').getByText(organizationName)).toBeVisible();

      await organizationsPage.orgDropdownContainer.click();
      const orgGroup = organizationsPage.orgDropdownContainer.getByRole('listbox').getByRole('group').getByRole('option');
      await expect(orgGroup).toHaveCount(2);
      await expect(orgGroup).toHaveText([environment.TEST_ORG_2, environment.TEST_ORG_3]);
    });

    await test.step('Edit Organization', async () => {
      const newOrganizationName = 'Updated Test Org';
      const newOrganizationDescription = 'Updated Description';
      await organizationsPage.editJetstreamOrganization(newOrganizationName, newOrganizationDescription, organizationName);
      organizationName = newOrganizationName;
      organizationDescription = newOrganizationDescription;
      // Ensure that we did not add a new org group card, but instead updated the existing one
      expect(await page.locator('[data-testid^="org-group-card-"]').count()).toBe(numberOfOrgGroups);
    });

    // TODO: add test to delete organization and all included orgs
    await test.step('Delete Organization', async () => {
      await organizationsPage.deleteJetstreamOrganization(organizationName);

      await expect(page.getByText('Unassigned (3)')).toBeVisible();
    });
  });
});
