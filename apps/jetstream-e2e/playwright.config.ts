import { nxE2EPreset } from '@nx/playwright/preset';
import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

const ONE_SECOND = 1000;
const THIRTY_SECONDS = 30 * ONE_SECOND;

// FIXME: ideally we could allow 333 or 4200, but the authentication pages are separate from the app. so we would need to sometimes go to 3333 and others to 4200
// const baseURL = process.env.CI ? 'http://localhost:3333/' : 'http://localhost:4200/';
const baseURL = 'http://localhost:3333/';

// Ensure tests run via VSCode debugger are run from the root of the repo
if (process.cwd().endsWith('/apps/jetstream-e2e')) {
  process.chdir('../../');
}

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  // globalSetup: require.resolve('./src/setup/global-setup.ts'),
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
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'teardown',
      testMatch: /.*\.teardown\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'chrome',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      testMatch: /.*\.spec\.ts/,
      dependencies: ['setup'],
      // teardown: 'teardown',
    },
  ],
});
