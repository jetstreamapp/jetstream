import { test, expect } from '@playwright/test';
// import { formatNumber } from '../../libs/shared/ui-utils/src';
import { formatNumber } from '@jetstream/shared/ui-utils';

test('test', async ({ page }) => {
  await page.goto('/');
  // await page.goto('http://localhost:4200/app');
  // await page.goto('http://localhost:4200/app/query');

  // TODO: this should happen automatically - maybe set storage state?
  await page.getByPlaceholder('Select an Org').click();
  await page.getByRole('option', { name: 'austin@atginfo-personal.com' }).click();

  await page.getByRole('menuitem', { name: 'Query Records' }).click();
  await page.waitForURL('**/query');

  await page.getByPlaceholder('Filter Objects').fill('account');
  await page.getByTestId('sobject-list').getByRole('listitem').filter({ hasText: 'AccountAccount' }).getByTitle('Account').first().click();

  const fieldList = page.getByTestId('sobject-fields');
  await fieldList.getByText('Account Name').click();
  await fieldList.getByText('Account Currency').click();
  await fieldList.getByText('Account Description').click();

  // TODO: Apply some filters

  // TODO: Expect this query to exist
  // getByText('SELECT Id, Name, CurrencyIsoCode, DescriptionFROM Account')

  await page.getByTestId('execute-query-button').click();

  // TODO: confirm page was changed
  await page.waitForURL('**/query/results');

  let row1 = await page.getByRole('grid').getByRole('gridcell', { name: 'Select row' }).locator('span').first();
  let row2 = await page.getByRole('grid').getByRole('gridcell', { name: 'Select row' }).last().locator('span');

  await row1.click();

  // for (const row of await page.getByRole('grid').getByRole('gridcell', { name: 'Select row' }).all()) {
  //   await row.locator('span').first().click();
  // }

  let rows = await page.getByRole('grid').getByRole('gridcell', { name: 'Select row' }).all();
  expect(rows.length).toBeGreaterThan(0);
  await page.getByText(`Showing ${formatNumber(rows.length)} of ${formatNumber(rows.length)} records`);

  // TODO: test some stuff out

  // getByRole('row', { name: 'Select row View Full Record Edit Record Clone Record Turn Record Into Apex 0016g00002BysHhAAJ Acct 20 USD My Description@2' }).getByLabel('Select row')
  // getByRole('row', { name: 'Select row View Full Record Edit Record Clone Record Turn Record Into Apex 0016g00002BysHhAAJ Acct 20 USD My Description@2' }).getByLabel('Select row')
  // await page.getByRole('grid').getByRole('columnheader', { name: 'Select all' }).locator('span').first().click();
  // rows = await page.getByRole('grid').getByRole('gridcell', { name: 'Select row' }).all();

  // page.getByRole('columnheader', { name: 'Select all' }).locator('span').first()

  // await page.getByRole('row', { name: 'Select row View Full Record Edit Record Clone Record Turn Record Into Apex 0016g00002BysHhAAJ Acct 20 USD My Description@' }).getByRole('button', { name: 'Turn Record Into Apex' }).click();
  // await page.getByRole('dialog', { name: 'Turn Record Into Apex' }).getByRole('button', { name: 'Copy to Clipboard' }).click();
  // await page.getByRole('dialog', { name: 'Turn Record Into Apex' }).getByRole('contentinfo').getByRole('button', { name: 'Close' }).click();
  // await page.getByRole('row', { name: 'Select row View Full Record Edit Record Clone Record Turn Record Into Apex 0016g00002BysHhAAJ Acct 20 USD My Description@' }).getByRole('button', { name: 'Clone Record' }).click();
  // await page.getByRole('button', { name: 'Cancel' }).click();
  // await page.getByRole('row', { name: 'Select row View Full Record Edit Record Clone Record Turn Record Into Apex 0016g00002BysHhAAJ Acct 20 USD My Description@' }).getByRole('button', { name: 'Edit Record' }).click();
  // await page.getByLabel('Account Description (Description)').click();
  // await page.getByLabel('Account Description (Description)').fill('My Description@2');
  // await page.getByLabel('Account Description (Description)').press('Tab');
  // await page.getByRole('button', { name: 'Save' }).click();
  // await page.goto('http://localhost:4200/app/query/results');
  // await page.getByRole('gridcell', { name: 'My Description@2' }).click();
  // await page.getByRole('gridcell', { name: 'My Description@2' }).click({
  //   button: 'right'
  // });
  // await page.getByRole('menuitem', { name: 'Copy row to clipboard with header' }).click();

  // await page.getByRole('row', { name: 'Select row View Full Record Edit Record Clone Record Turn Record Into Apex 0016g00002BysHhAAJ Acct 20 USD My Description@2' }).getByRole('button', { name: 'View Full Record' }).click();
  // await page.getByRole('dialog', { name: 'View Record' }).getByText('My Description@2').click();
  // await page.getByRole('dialog', { name: 'View Record' }).getByRole('contentinfo').getByRole('button', { name: 'Close' }).click();
  // await page.getByRole('button', { name: 'Close' }).click();
});

// locator('div:nth-child(17) > .docs-codeblock-example > .slds-form-element > .slds-form-element__control > .slds-checkbox > .slds-checkbox__label > .slds-checkbox_faux')
