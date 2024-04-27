import { nxE2EPreset } from '@nx/playwright/preset';
import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

const ONE_SECOND = 1000;
const THIRTY_SECONDS = 30 * ONE_SECOND;

const baseURL = process.env.CI ? 'http://localhost:3333/' : 'http://localhost:4200/';

// Ensure tests run via VSCode debugger are run from the root of the repo
if (process.cwd().endsWith('/apps/jetstream-e2e')) {
  process.chdir('../../');
}

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  globalSetup: require.resolve('./src/setup/global-setup.ts'),
  retries: 3,
  expect: {
    timeout: THIRTY_SECONDS,
  },
  maxFailures: 2,
  timeout: 120000,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { outputFolder: 'playwright-report', open: process.env.CI ? 'never' : 'on-failure' }]],
  use: {
    actionTimeout: THIRTY_SECONDS,
    navigationTimeout: THIRTY_SECONDS,
    baseURL,
    permissions: ['notifications'],
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],
});
