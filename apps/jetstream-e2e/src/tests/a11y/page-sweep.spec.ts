import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { expect, test } from '../../fixtures/fixtures';
import { runA11yScan } from './a11y.utils';

test.describe.configure({ mode: 'parallel' });

/**
 * Axe-core WCAG 2.1 A/AA sweep over every top-level application route.
 * Each scan writes evidence JSON to a11y-results/ and ratchets against a11y-baseline.json
 * (see a11y.utils.ts for the gating rules).
 */

// TEAM_INVITE requires an invitation token and external routes live on getjetstream.app.
const EXCLUDED_ROUTES = new Set(['DESKTOP_APPLICATION', 'BROWSER_EXTENSION', 'TEAM_INVITE']);

const routesToScan = Object.entries(APP_ROUTES).filter(
  ([routeKey, { ROUTE }]) => !EXCLUDED_ROUTES.has(routeKey) && !ROUTE.startsWith('http'),
);

test.describe('a11y page sweep', () => {
  for (const [routeKey, { ROUTE }] of routesToScan) {
    test(`${routeKey} (${ROUTE})`, async ({ page, apiRequestUtils }, testInfo) => {
      // Most tool pages render an org-required empty state without an org, which would make the
      // scan meaningless — select the default org first so real page content is evaluated.
      await apiRequestUtils.selectDefaultOrg();
      await page.goto(`/app${ROUTE}`);

      // Let async page content settle (metadata fetches, lazy chunks) before scanning, but don't
      // fail the scan if long-polling keeps the network busy.
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);
      // The data-testid="header" wrapper is zero-height (hidden to Playwright), so wait on the
      // visible banner landmark instead to confirm the app shell rendered.
      await expect(page.getByRole('banner')).toBeVisible();

      await runA11yScan(page, testInfo, `route-${routeKey}`);
    });
  }
});
