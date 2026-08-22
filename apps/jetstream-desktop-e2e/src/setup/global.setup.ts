/* eslint-disable playwright/no-conditional-in-test */
import { ENV, prisma } from '@jetstream/api-config';
import { AuthenticationPage } from '@jetstream/test/e2e-utils';
import { expect, test as setup } from '@playwright/test';
import { join } from 'path';

// The desktop app's own auth endpoints (POST /desktop-app/auth/session, /verify) live on the API
// server, not the desktop-client renderer — so this logs into the API server directly, the same
// way `jetstream-e2e`'s setup does, purely to obtain a cookie session that
// `desktop-auth-seed.utils.ts` can use to call those endpoints per-test.
const baseApiURL = process.env.NX_PUBLIC_SERVER_URL || process.env.JETSTREAM_SERVER_URL || 'http://localhost:3333';

const authFile = join('playwright/.auth/desktop-user.json');

setup('log in as example user', async ({ page }) => {
  console.log('DESKTOP E2E GLOBAL SETUP - STARTED');

  const user = ENV.EXAMPLE_USER;

  // initSession (POST /desktop-app/auth/session) checks checkUserEntitlement(userId, 'desktop')
  // and redirects to /auth/login/?error=MissingEntitlement when it's missing — Playwright's request
  // API follows that redirect by default, so an unentitled account fails downstream with an HTML
  // login page where JSON was expected, not a clean error. Mirrors
  // subscription.db.ts's grantAnalysisToolsEntitlementForUser, which test.routes.ts already uses
  // the same way to unlock a different flag-gated feature for this same bypass account.
  await prisma.entitlement.upsert({
    where: { userId: user.id },
    create: { userId: user.id, desktop: true },
    update: { desktop: true },
  });

  const authenticationPage = new AuthenticationPage(page);

  await page.goto(baseApiURL);

  await authenticationPage.acceptCookieBanner();
  await authenticationPage.loginOrGoToAppIfLoggedIn(user.email, ENV.EXAMPLE_USER_PASSWORD as string);

  // Handle TOS acceptance gate if the example user hasn't accepted the current version yet.
  // Kept here rather than inside the page object: loginOrGoToAppIfLoggedIn doesn't cover the gate,
  // and jetstream-e2e's setup probes for it the same way.
  const onTosPage = await page
    .waitForURL(`${baseApiURL}/auth/accept-terms**`, { timeout: 3000 })
    .then(() => true)
    .catch(() => false);
  if (onTosPage) {
    await authenticationPage.acceptTosGatePage();
  }

  page.url().includes('/app') || (await page.waitForURL(`${baseApiURL}/app`));

  await expect(page.getByRole('button', { name: 'Avatar' })).toBeVisible();

  console.log('DESKTOP E2E GLOBAL SETUP - FINISHED\n');
  console.log(`Saving storage state: ${authFile}\n`);

  await page.context().storageState({ path: authFile });
  await page.close();
  // Setup is the only place this suite touches the database — leave no open pool behind holding
  // the worker process open after the project finishes.
  await prisma.$disconnect();
});
