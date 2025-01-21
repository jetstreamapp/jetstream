import { prisma } from '@jetstream/api-config';
import { expect, test } from '../../fixtures/fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/app');
});

test.describe.configure({ mode: 'parallel' });

// Reset storage state for this file to avoid being authenticated
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Security Checks', () => {
  test('Attempt to access data different user', async ({ apiRequestUtils, newUser }) => {
    const { email } = newUser;

    const { salesforceOrg, jetstreamOrg } = await test.step('Sign up and verify email', async () => {
      const userId = 'BAAAAAAA-1000-1000-1000-BAAAAAAAAAAA';
      const email = `test-example-${new Date().getTime()}@getjetstream.app`;
      const jetstreamUserId = `test|${userId}`;

      const otherUser = await prisma.user.create({
        data: {
          id: userId,
          userId: jetstreamUserId,
          email: `test-example-${new Date().getTime()}@getjetstream.app`,
          emailVerified: true,
          name: 'Test User',
          lastLoggedIn: new Date(),
          preferences: { create: { skipFrontdoorLogin: false } },
          authFactors: { create: { type: '2fa-email', enabled: false } },
          salesforceOrgs: {
            create: {
              jetstreamUserId,
              jetstreamUrl: 'https://localhost:3333',
              jetstreamOrganization: {
                create: {
                  name: 'Test Org',
                  description: 'Test Description',
                  userId,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              },
              label: 'Test Org',
              uniqueId: 'Test-Test',
              accessToken:
                'EqbKGE6V3v58bUfweWrzaQ==!nd6ZL+eTulpXc1Z1SJSpFA881pt0bcH4vYpTpWr+WLGJJWKO+pnXCLdls1LO0qZkpKk1irJ0VDDIXj6rN6t588KZLrX0zyYuthilvBDfUVO/xGg/MclFs04IHJ+CfrPf3zkGGcLpQziM3hvTqoWgbX65vI4wknLjPabAc+z35fAliiTjdRqLIUNAvevEgDRD+J2lDqH4Vud36g3baBr2OV+bBD3fa9aE/TISxjwUmI7DqFBfgwXHvarLgA4FX6oW/bP6336q5YJ1zeIm+5Lq9g==',
              instanceUrl: 'https://jetstream-e2e-dev-ed.develop.my.salesforce.com',
              loginUrl: 'https://jetstream-e2e-dev-ed.develop.my.salesforce.com',
              userId: '005Dn000003DuJgIAK',
              email,
              organizationId: 'test',
              username: email,
              displayName: email,
              orgName: 'test',
              orgCountry: 'US',
              orgOrganizationType: 'Developer Edition',
              orgInstanceName: 'NA224',
              orgIsSandbox: false,
              orgLanguageLocaleKey: 'en-US',
              filterText: 'test',
            },
          },
        },
      });

      const salesforceOrg = await prisma.salesforceOrg.findFirst({ where: { jetstreamUserId2: userId } });
      const jetstreamOrg = await prisma.jetstreamOrganization.findFirst({ where: { userId } });

      return { salesforceOrg, jetstreamOrg };
    });

    await test.step('Try to update or delete org from different user', async () => {
      const orgsResponse = await apiRequestUtils.makeRequestRaw('GET', `/api/orgs`);
      expect(orgsResponse.ok()).toEqual(true);

      const updateSalesforceOrgResponse = await apiRequestUtils.makeRequestRaw('PATCH', `/api/orgs/${salesforceOrg.uniqueId}`, {
        jetstreamOrganizationId: salesforceOrg.jetstreamOrganizationId,
        uniqueId: salesforceOrg.uniqueId,
        label: 'I should not be able to change anything!',
        filterText: salesforceOrg.filterText,
        instanceUrl: salesforceOrg.instanceUrl,
        loginUrl: salesforceOrg.loginUrl,
        userId: salesforceOrg.userId,
        email: salesforceOrg.email,
        organizationId: salesforceOrg.organizationId,
        username: salesforceOrg.username,
        displayName: salesforceOrg.displayName,
        thumbnail: salesforceOrg.thumbnail,
        apiVersion: salesforceOrg.apiVersion,
        orgName: salesforceOrg.orgName,
        orgCountry: salesforceOrg.orgCountry,
        orgOrganizationType: salesforceOrg.orgOrganizationType,
        orgInstanceName: salesforceOrg.orgInstanceName,
        orgIsSandbox: salesforceOrg.orgIsSandbox,
        orgLanguageLocaleKey: salesforceOrg.orgLanguageLocaleKey,
        orgNamespacePrefix: salesforceOrg.orgNamespacePrefix,
        orgTrialExpirationDate: salesforceOrg.orgTrialExpirationDate,
        color: salesforceOrg.color,
        connectionError: salesforceOrg.connectionError,
        createdAt: salesforceOrg.createdAt,
        updatedAt: salesforceOrg.updatedAt,
      });
      expect(updateSalesforceOrgResponse.ok()).toBeFalsy();
      expect(updateSalesforceOrgResponse.status()).toBe(404);

      const deleteSalesforceOrgResponse = await apiRequestUtils.makeRequestRaw('DELETE', `/api/orgs/${salesforceOrg.uniqueId}`);
      expect(deleteSalesforceOrgResponse.ok()).toBeFalsy();
      expect(deleteSalesforceOrgResponse.status()).toBe(404);
    });

    await test.step('Try to use an org from a different user for a query API request', async () => {
      const useOrgFromDifferentUserResponse = await apiRequestUtils.makeRequestRaw(
        'POST',
        `/api/query?isTooling=false&includeDeletedRecords=false`,
        { query: 'SELECT Id FROM Account' },
        {
          'X-SFDC-ID': salesforceOrg.uniqueId,
        }
      );
      expect(useOrgFromDifferentUserResponse.ok()).toBeFalsy();
      expect(useOrgFromDifferentUserResponse.status()).toBe(404);
    });

    await test.step('Try to update and delete a Jetstream organization from a different user', async () => {
      const updateJetstreamResponse = await apiRequestUtils.makeRequestRaw('PUT', `/api/orgs/${jetstreamOrg.id}`, {
        id: jetstreamOrg.id,
        orgs: [],
        name: 'I should not be able to change anything!',
        description: jetstreamOrg.description,
        createdAt: jetstreamOrg.createdAt,
        updatedAt: jetstreamOrg.updatedAt,
      });
      expect(updateJetstreamResponse.ok()).toBeFalsy();
      expect(updateJetstreamResponse.status()).toBe(404);

      const deleteJetstreamResponse = await apiRequestUtils.makeRequestRaw('DELETE', `/api/orgs/${jetstreamOrg.id}`);
      expect(deleteJetstreamResponse.ok()).toBeFalsy();
      expect(deleteJetstreamResponse.status()).toBe(404);
    });
  });
});
