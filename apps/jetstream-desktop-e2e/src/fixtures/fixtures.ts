/* eslint-disable react-hooks/rules-of-hooks */
import { ElectronApplication, Page, test as base } from '@playwright/test';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { seedAppData, seedDesktopAuthSession } from '../utils/desktop-auth-seed.utils';
import { seedSalesforceOrg } from '../utils/desktop-org-seed.utils';
import { launchDesktopElectronApp } from '../utils/electron-launch.utils';
import { ElectronApiClient } from '../utils/ElectronApiClient';
import { ElectronMainProcess } from '../utils/ElectronMainProcess';

const DEFAULT_SERVER_URL = 'http://localhost:3333';

type DesktopOptions = {
  /**
   * Seed a real Jetstream session before launch so the app boots past the Login screen.
   * Set per file/describe with `test.use({ authenticated: true })`.
   */
  authenticated: boolean;
  /**
   * Additionally seed one real Salesforce org (implies `authenticated`). Requires the
   * `SFDC_CI_*`/`E2E_LOGIN_*` env vars — see `desktop-org-seed.utils.ts`.
   */
  withSalesforceOrg: boolean;
};

type DesktopFixtures = {
  /**
   * Isolated `--user-data-dir` for this test, already seeded per the options above. Exposed so
   * tests can assert on what the app actually wrote to disk (see `tests/security/token-at-rest.spec.ts`).
   */
  userDataDir: string;
  electronApp: ElectronApplication;
  mainWindow: Page;
  electronApiClient: ElectronApiClient;
  electronMain: ElectronMainProcess;
};

export const test = base.extend<DesktopOptions & DesktopFixtures>({
  authenticated: [false, { option: true }],
  withSalesforceOrg: [false, { option: true }],

  userDataDir: async ({ playwright, baseURL, storageState, authenticated, withSalesforceOrg }, use) => {
    // realpath because on macOS os.tmpdir() sits under the /var -> /private/var symlink while
    // Electron reports the resolved path — without this, comparing the two is a false mismatch.
    const dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'jetstream-desktop-e2e-')));

    try {
      if (authenticated || withSalesforceOrg) {
        const serverUrl = baseURL ?? DEFAULT_SERVER_URL;
        // A dedicated APIRequestContext rather than `page.request`: the auth-seeding calls are the
        // only HTTP this suite makes, so borrowing them from a `page` would launch a whole Chromium
        // browser purely to carry cookies. `storageState` (written by global.setup.ts) is what
        // authenticates it — note the built-in `request` fixture would NOT work here, it is
        // constructed with no options and so carries no storage state.
        const apiRequest = await playwright.request.newContext({ baseURL: serverUrl, storageState });
        try {
          const session = await seedDesktopAuthSession(apiRequest, serverUrl);
          await seedAppData(dir, session);
          if (withSalesforceOrg) {
            await seedSalesforceOrg(dir, session.userId, session.encryptionKey);
          }
        } finally {
          await apiRequest.dispose();
        }
      }

      await use(dir);
    } finally {
      // Also covers a throw from the seeding block above, which skips `use()` entirely — without
      // this the directory would leak once per attempt, so three times under `retries: 2`.
      await fs.rm(dir, { recursive: true, force: true });
    }
  },

  electronApp: async ({ userDataDir }, use, testInfo) => {
    const app = await launchDesktopElectronApp(userDataDir);
    // Config-level `trace`/`video` only apply to contexts Playwright creates itself, which the
    // Electron app's context is not — without starting it explicitly there is no trace to open
    // when an Electron test fails.
    await app.context().tracing.start({ screenshots: true, snapshots: true, sources: true, title: testInfo.title });

    await use(app);

    // Tracing must stop before the app closes. Guarded because a test that failed by crashing the
    // app would otherwise throw here and mask the real failure.
    try {
      if (testInfo.status === testInfo.expectedStatus) {
        await app.context().tracing.stop();
      } else {
        const tracePath = testInfo.outputPath('electron-trace.zip');
        await app.context().tracing.stop({ path: tracePath });
        await testInfo.attach('electron-trace', { path: tracePath, contentType: 'application/zip' });
      }
    } catch (ex) {
      console.warn('Unable to capture Electron trace (the app may have already exited):', ex);
    }

    await app.close();
  },

  mainWindow: async ({ electronApp }, use) => {
    const window = await electronApp.firstWindow();
    // `firstWindow()` resolves the moment a window object exists, and `browser.ts` calls `loadURL()`
    // on the very next statement after constructing it — so the page can still be on the initial
    // empty document here. Tests that go straight to `page.evaluate()` rather than an auto-waiting
    // locator would otherwise race that navigation, failing either with "window.electronAPI is not
    // available on this page" or a destroyed execution context.
    await window.waitForURL((url) => url.protocol !== 'about:', { waitUntil: 'domcontentloaded' });
    await use(window);
  },
  electronApiClient: async ({ mainWindow }, use) => {
    await use(new ElectronApiClient(mainWindow));
  },
  electronMain: async ({ electronApp }, use) => {
    await use(new ElectronMainProcess(electronApp));
  },
});

export { expect } from '@playwright/test';
