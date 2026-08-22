import { ApiRequestUtils, QueryPage } from '@jetstream/test/e2e-utils';
import { expect, test } from '../../fixtures/fixtures';

test.use({ withSalesforceOrg: true });

test.describe('Desktop Salesforce round-trip', () => {
  // Requires SFDC_CI_CONSUMER_KEY / SFDC_CI_PRIVATE_KEY_BASE64 / E2E_LOGIN_URL / E2E_LOGIN_USERNAME
  // (see desktop-org-seed.utils.ts) — the same shared CI Salesforce sandbox org jetstream-e2e uses.
  test('runs a real SOQL query end-to-end through window.electronAPI.request()', async ({ mainWindow }) => {
    const username = process.env.E2E_LOGIN_USERNAME;
    if (!username) {
      throw new Error('E2E_LOGIN_USERNAME is required to select the seeded org in the picker');
    }

    // QueryPage requires an ApiRequestUtils, but only its `waitForQueryResults` helper (unused here)
    // makes server calls — the desktop app routes Salesforce traffic through the IPC bridge, never
    // the web API.
    const queryPage = new QueryPage(mainWindow, new ApiRequestUtils(mainWindow, username));

    await mainWindow.getByPlaceholder('Select an Org').click();
    await mainWindow.getByRole('option', { name: username }).click();

    // Organization always has exactly one row and needs no special permissions — a safe,
    // data-independent query for a smoke test against a shared CI org.
    await queryPage.setManualQuery('SELECT Id, Name FROM Organization', 'EXECUTE');

    await expect(mainWindow.getByRole('gridcell').first()).toBeVisible();
  });
});
