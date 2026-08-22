import { nxE2EPreset } from '@nx/playwright/preset';
import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

const ONE_SECOND = 1000;
const THIRTY_SECONDS = 30 * ONE_SECOND;

// The API server the desktop app's auth endpoints (and the setup project's login) talk to.
// Not the Electron app itself — there is no URL to navigate to for that, it's launched as a
// separate process per-test by the `electronApp` fixture in `src/fixtures/fixtures.ts`.
const baseURL = process.env.NX_PUBLIC_SERVER_URL || process.env.JETSTREAM_SERVER_URL || 'http://localhost:3333';

// Ensure tests run via VSCode debugger are run from the root of the repo — the desktop app's
// preload script is resolved relative to process.cwd(), so the Electron-launching fixture also
// needs this to have already run.
if (process.cwd().endsWith('/apps/jetstream-desktop-e2e')) {
  process.chdir('../../');
}

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  retries: process.env.CI ? 2 : 0,
  expect: {
    timeout: THIRTY_SECONDS,
  },
  timeout: 120000,
  // Electron launches are heavier than browser contexts, and this suite runs as a single CI job
  // (no sharding, unlike jetstream-e2e) — start conservative until there's data on safe parallelism.
  workers: 1,
  // No sharding here, so no merge step is needed — always produce the HTML report directly.
  // The `json` summary is what `pnpm ci:failures` reads: a few hundred KB against the HTML
  // report's tens of MB, so CI keeps it far longer. Written outside `playwright-report` because
  // the HTML reporter clears that folder before writing.
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: process.env.CI ? 'never' : 'on-failure' }],
    ['json', { outputFile: 'playwright-summary.json' }],
  ],
  use: {
    actionTimeout: THIRTY_SECONDS,
    navigationTimeout: THIRTY_SECONDS,
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      // No browser is launched for these tests — everything runs against the real Electron app.
      // `storageState` is still needed: the fixtures build an APIRequestContext from it to call the
      // desktop auth endpoints when seeding an authenticated `--user-data-dir`.
      name: 'electron',
      use: {
        storageState: 'playwright/.auth/desktop-user.json',
      },
      testMatch: /.*\.spec\.ts/,
      dependencies: ['setup'],
    },
  ],
});
