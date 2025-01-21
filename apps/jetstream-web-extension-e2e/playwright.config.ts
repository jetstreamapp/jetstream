import { nxE2EPreset } from '@nx/playwright/preset';
import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

const ONE_SECOND = 1000;
const THIRTY_SECONDS = 30 * ONE_SECOND;

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = process.env.NX_PUBLIC_SERVER_URL || 'http://localhost:3333';

// Ensure tests run via VSCode debugger are run from the root of the repo
if (process.cwd().endsWith('/apps/jetstream-e2e')) {
  process.chdir('../../');
}

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),

  use: {
    actionTimeout: THIRTY_SECONDS,
    navigationTimeout: THIRTY_SECONDS,
    baseURL,
    permissions: ['notifications'],
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'yarn nx serve jetstream-web-extension',
  //   url: 'http://localhost:4200',
  //   reuseExistingServer: !process.env.CI,
  //   cwd: workspaceRoot,
  // },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Setup is giving all sorts of issues - login state is not being saved consistently
        // storageState: 'playwright/.auth/web-ext-user.json',
      },
      testMatch: /.*\.spec\.ts/,
      // dependencies: ['setup'],
    },
  ],
});
