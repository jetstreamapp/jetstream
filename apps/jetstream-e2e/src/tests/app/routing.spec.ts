import { expect, test } from '../../fixtures/fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/app');
});

test.describe.configure({ mode: 'parallel' });

const testCases = [
  { cardTitle: 'QUERY', menu: 'Query Records', items: [{ link: 'Query Records', path: '/query' }] },
  {
    cardTitle: 'LOAD',
    menu: 'Load Records',
    items: [
      { link: 'Load Records', path: '/load' },
      { link: 'Load Records to Multiple Objects', path: '/load-multiple-objects' },
      { link: 'Update Records Without a File', path: '/update-records' },
    ],
  },
  { cardTitle: 'AUTOMATION', menu: 'Automation Control', items: [{ link: 'Automation Control', path: '/automation-control' }] },
  { cardTitle: 'PERMISSIONS', menu: 'Manage Permissions', items: [{ link: 'Manage Permissions', path: '/permissions-manager' }] },
  {
    cardTitle: 'DEPLOY',
    menu: 'Deploy Metadata',
    items: [
      { link: 'Deploy and Compare Metadata', path: '/deploy-metadata' },
      { link: 'Create Object and Fields', path: '/create-fields' },
      { link: 'Formula Evaluator', path: '/formula-evaluator' },
    ],
  },
  {
    cardTitle: 'DEVELOPER TOOLS',
    menu: 'Developer Tools',
    items: [
      { link: 'Anonymous Apex', path: '/apex' },
      { link: 'View Debug Logs', path: '/debug-logs' },
      { link: 'Export Object Metadata', path: '/object-export' },
      { link: 'Salesforce API', path: '/salesforce-api' },
      { link: 'Platform Events', path: '/platform-event-monitor' },
    ],
  },
];

test.describe('Home Page', () => {
  test(`Should use card to go to page from card`, async ({ page }) => {
    for (const { cardTitle, items } of testCases) {
      for (const item of items) {
        await page.goto('/app');
        const card = await page
          .getByTestId('content')
          .locator('div')
          .filter({ has: page.getByRole('heading', { name: cardTitle }) })
          .nth(2);

        await expect(card.getByRole('link', { name: item.link })).toBeTruthy();

        await card.getByRole('link', { name: item.link, exact: true }).click();
        await page.waitForURL(`**${item.path}`);
      }
    }
  });
});

test.describe('Navbar navigation', () => {
  test(`Should use card to go to page from nav bar`, async ({ page }) => {
    for (const { items, menu } of testCases) {
      for (const item of items) {
        await page.goto('/app');

        if (items.length === 1) {
          await page.getByTestId('header').getByRole('menuitem', { name: menu }).click();
        } else {
          await page.getByTestId('header').getByRole('button', { name: menu }).click();
        }

        if (items.length > 1) {
          await expect(page.getByRole('menuitemcheckbox', { name: item.link }).first()).toBeTruthy();
          await page.getByRole('menuitemcheckbox', { name: item.link }).first().click();
        }

        await page.waitForURL(`**${item.path}`);
      }
    }
  });
});
