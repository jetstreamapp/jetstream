import { APP_ROUTES } from '@jetstream/shared/ui-router';
import type { Page } from '@playwright/test';
import { expect, test } from '../../fixtures/fixtures';
import { assertBaselineEntry, runA11yScan } from './a11y.utils';

test.describe.configure({ mode: 'parallel' });

/**
 * Axe-core WCAG 2.1 A/AA sweep over every top-level application route.
 * Each scan writes evidence JSON to a11y-results/ and ratchets against a11y-baseline.json
 * (see a11y.utils.ts for the gating rules). Every swept route needs a `route-<KEY>` entry in the
 * baseline — a new route fails until it is baselined explicitly.
 */

// TEAM_INVITE requires an invitation token and external routes live on getjetstream.app.
const EXCLUDED_ROUTES = new Set(['DESKTOP_APPLICATION', 'BROWSER_EXTENSION', 'TEAM_INVITE']);
// The shared E2E user has no team, so the router bounces TEAM_DASHBOARD to /home for it. It is
// swept separately below as a freshly created team admin.
const TEAM_ADMIN_ROUTES = new Set(['TEAM_DASHBOARD']);

const routesToScan = Object.entries(APP_ROUTES).filter(
  ([routeKey, { ROUTE }]) => !EXCLUDED_ROUTES.has(routeKey) && !TEAM_ADMIN_ROUTES.has(routeKey) && !ROUTE.startsWith('http'),
);

/**
 * Navigate to a route and wait for it to render. Ability-gated routes (TEAM_DASHBOARD, SETTINGS,
 * BILLING) fall through to the `*` catch-all and land on /home when the user lacks the ability,
 * so the URL is asserted too — otherwise the scan would silently evaluate the wrong page under
 * this route's key.
 */
async function gotoRoute(page: Page, route: string) {
  await page.goto(`/app${route}`);

  // Let async page content settle (metadata fetches, lazy chunks) before scanning, but don't
  // fail the scan if long-polling keeps the network busy.
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);

  const escapedRoute = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await expect(page).toHaveURL(new RegExp(`/app${escapedRoute}(?:[/?#]|$)`));
  // The data-testid="header" wrapper is zero-height (hidden to Playwright), so wait on the
  // visible banner landmark instead to confirm the app shell rendered.
  await expect(page.getByRole('banner')).toBeVisible();
}

test.describe('a11y page sweep', () => {
  for (const [routeKey, { ROUTE }] of routesToScan) {
    test(`${routeKey} (${ROUTE})`, async ({ page, apiRequestUtils }, testInfo) => {
      const scanKey = `route-${routeKey}`;
      assertBaselineEntry(scanKey);

      // Most tool pages render an org-required empty state without an org, which would make the
      // scan meaningless — select the default org first so real page content is evaluated.
      await apiRequestUtils.selectDefaultOrg();
      await gotoRoute(page, ROUTE);

      await runA11yScan(page, testInfo, scanKey);
    });
  }
});

// TEAM_DASHBOARD only renders for a user with the Team ability. Destructuring the fixture is what
// activates it: it signs a fresh admin user up on this page with a team of their own (and cleans
// both up afterwards). The sign-up flow starts logged OUT (the shared session's landing page has no
// "Sign up" link), hence the empty storage state — the same setup the team specs use. The dashboard
// needs no Salesforce org.
test.describe('a11y page sweep (team admin)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test(`TEAM_DASHBOARD (${APP_ROUTES.TEAM_DASHBOARD.ROUTE})`, async ({ page, teamCreationUtils1User: _teamAdmin }, testInfo) => {
    const scanKey = 'route-TEAM_DASHBOARD';
    assertBaselineEntry(scanKey);

    await gotoRoute(page, APP_ROUTES.TEAM_DASHBOARD.ROUTE);
    await expect(page.getByRole('heading', { name: 'Team Dashboard' })).toBeVisible();

    await runA11yScan(page, testInfo, scanKey);
  });
});
