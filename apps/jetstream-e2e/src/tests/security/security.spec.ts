import { prisma } from '@jetstream/api-config';
import { expect, test } from '../../fixtures/fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/app');
});

test.describe.configure({ mode: 'parallel' });

// Reset storage state for this file to avoid being authenticated
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Security Checks', () => {
  // TODO: maybe look into tampering with cookies?

  test('Attempt to access data different user', async ({ apiRequestUtils, newUser }) => {
    const { email } = newUser;

    const { salesforceOrgs, jetstreamOrgs } = await test.step('Sign up and verify email', async () => {
      // const { email, password, name } = await authenticationPage.signUpAndVerifyEmail();
      const salesforceOrgs = await prisma.salesforceOrg.findMany({
        where: {
          jetstreamUser: {
            email: {
              not: email,
            },
          },
        },
      });

      const jetstreamOrgs = await prisma.jetstreamOrganization.findMany({
        where: {
          user: {
            email: {
              not: email,
            },
          },
        },
      });

      await expect(salesforceOrgs.length).toBeGreaterThanOrEqual(1);
      await expect(jetstreamOrgs.length).toBeGreaterThanOrEqual(1);

      return { salesforceOrgs, jetstreamOrgs };
    });

    await test.step('Try to update or delete org from different user', async () => {
      const orgsResponse = await apiRequestUtils.makeRequestRaw('GET', `/api/orgs`);
      await expect(orgsResponse.ok()).toEqual(true);

      const updateSalesforceOrgResponse = await apiRequestUtils.makeRequestRaw('PATCH', `/api/orgs/${salesforceOrgs[0].uniqueId}`, {
        jetstreamOrganizationId: salesforceOrgs[0].jetstreamOrganizationId,
        uniqueId: salesforceOrgs[0].uniqueId,
        label: 'I should not be able to change anything!',
        filterText: salesforceOrgs[0].filterText,
        instanceUrl: salesforceOrgs[0].instanceUrl,
        loginUrl: salesforceOrgs[0].loginUrl,
        userId: salesforceOrgs[0].userId,
        email: salesforceOrgs[0].email,
        organizationId: salesforceOrgs[0].organizationId,
        username: salesforceOrgs[0].username,
        displayName: salesforceOrgs[0].displayName,
        thumbnail: salesforceOrgs[0].thumbnail,
        apiVersion: salesforceOrgs[0].apiVersion,
        orgName: salesforceOrgs[0].orgName,
        orgCountry: salesforceOrgs[0].orgCountry,
        orgOrganizationType: salesforceOrgs[0].orgOrganizationType,
        orgInstanceName: salesforceOrgs[0].orgInstanceName,
        orgIsSandbox: salesforceOrgs[0].orgIsSandbox,
        orgLanguageLocaleKey: salesforceOrgs[0].orgLanguageLocaleKey,
        orgNamespacePrefix: salesforceOrgs[0].orgNamespacePrefix,
        orgTrialExpirationDate: salesforceOrgs[0].orgTrialExpirationDate,
        color: salesforceOrgs[0].color,
        connectionError: salesforceOrgs[0].connectionError,
        createdAt: salesforceOrgs[0].createdAt,
        updatedAt: salesforceOrgs[0].updatedAt,
      });
      await expect(updateSalesforceOrgResponse.ok()).toBeFalsy();
      await expect(updateSalesforceOrgResponse.status()).toBe(404);

      const deleteSalesforceOrgResponse = await apiRequestUtils.makeRequestRaw('DELETE', `/api/orgs/${salesforceOrgs[0].uniqueId}`);
      await expect(deleteSalesforceOrgResponse.ok()).toBeFalsy();
      await expect(deleteSalesforceOrgResponse.status()).toBe(404);
    });

    await test.step('Try to use an org from a different user for a query API request', async () => {
      const useOrgFromDifferentUserResponse = await apiRequestUtils.makeRequestRaw(
        'POST',
        `/api/query?isTooling=false&includeDeletedRecords=false`,
        { query: 'SELECT Id FROM Account' },
        {
          'X-SFDC-ID': salesforceOrgs[0].uniqueId,
        }
      );
      await expect(useOrgFromDifferentUserResponse.ok()).toBeFalsy();
      await expect(useOrgFromDifferentUserResponse.status()).toBe(404);
    });

    await test.step('Try to update and delete a Jetstream organization from a different user', async () => {
      const updateJetstreamResponse = await apiRequestUtils.makeRequestRaw('PUT', `/api/orgs/${jetstreamOrgs[0].id}`, {
        id: jetstreamOrgs[0].id,
        orgs: [],
        name: 'I should not be able to change anything!',
        description: jetstreamOrgs[0].description,
        createdAt: jetstreamOrgs[0].createdAt,
        updatedAt: jetstreamOrgs[0].updatedAt,
      });
      await expect(updateJetstreamResponse.ok()).toBeFalsy();
      await expect(updateJetstreamResponse.status()).toBe(404);

      const deleteJetstreamResponse = await apiRequestUtils.makeRequestRaw('DELETE', `/api/orgs/${jetstreamOrgs[0].id}`);
      await expect(deleteJetstreamResponse.ok()).toBeFalsy();
      await expect(deleteJetstreamResponse.status()).toBe(404);
    });
  });
});
