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

    await test.step('Add an org with a custom domain', async () => {
      await organizationsPage.addSalesforceOrg(environment.TEST_ORG_3, environment.E2E_LOGIN_PASSWORD, {
        type: 'custom',
        domain: new URL(environment.E2E_LOGIN_URL).hostname.replace('.my.salesforce.com', ''),
      });
      await expect(organizationsPage.orgDropdown).toHaveValue(environment.TEST_ORG_3);
    });

    const organizationName = 'Test Org';
    const organizationDescription = 'Test Description';

    await test.step('Create a Jetstream Organization and add orgs to it', async () => {
      await organizationsPage.goToJetstreamOrganizationsPage();
      await organizationsPage.addJetstreamOrganization(organizationName, organizationDescription);

      await organizationsPage.dragOrgToOrganization(organizationName, environment.TEST_ORG_2);
      await organizationsPage.dragOrgToOrganization(organizationName, environment.TEST_ORG_3);

      await expect(page.getByRole('button', { name: 'Choose Organization' })).toBeVisible();
    });

    await test.step('Ensure org dropdown shows correct orgs', async () => {
      await organizationsPage.makeActiveJetstreamOrganization(organizationName);
      await expect(page.getByTestId('header').getByText(organizationName)).toBeVisible();

      await organizationsPage.orgDropdownContainer.click();
      const orgGroup = organizationsPage.orgDropdownContainer.getByRole('listbox').getByRole('group').getByRole('option');
      await expect(orgGroup).toHaveCount(2);
      await expect(orgGroup).toHaveText([environment.TEST_ORG_2, environment.TEST_ORG_3]);
    });

    await test.step('Delete Organization', async () => {
      await organizationsPage.deleteJetstreamOrganization(organizationName);

      await expect(page.getByText('Salesforce Orgs Not Assigned to Organization (3)')).toBeVisible();
    });
  });
});
