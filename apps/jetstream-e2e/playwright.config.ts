import { nxE2EPreset } from '@nx/playwright/preset';
import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

const ONE_SECOND = 1000;
const THIRTY_SECONDS = 30 * ONE_SECOND;

// FIXME: ideally we could allow 333 or 4200, but the authentication pages are separate from the app. so we would need to sometimes go to 3333 and others to 4200
// BUT some of the auth flows don't work because cookie domain (e.g. session is active on 4200 but not 3333 for OTP abandonment test)
// const baseURL = process.env.CI ? 'http://localhost:3333/' : 'http://localhost:4200/';
const baseURL = process.env.NX_PUBLIC_SERVER_URL || process.env.JETSTREAM_SERVER_URL || 'http://localhost:3333';

// Guard PLAYWRIGHT_HTML_OPEN to the values the html reporter understands — anything else
// (e.g. a typo) falls back to the default rather than being passed through.
const HTML_OPEN_VALUES = ['never', 'always', 'on-failure'] as const;
const htmlOpen = HTML_OPEN_VALUES.find((value) => value === process.env.PLAYWRIGHT_HTML_OPEN) ?? 'on-failure';

console.log('Using baseURL:', baseURL);

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
  retries: process.env.CI ? 2 : 0,
  expect: {
    timeout: THIRTY_SECONDS,
  },
  // CI runs the suite as 4 shards, so this budget is per shard — 2 each would tolerate 8 failures
  // across the run before anything aborted.
  maxFailures: process.env.CI ? 1 : 0,
  timeout: 120000,
  // One worker per shard. Each shard is its own job with its own database, server and seeded
  // users, but every shard talks to the same Salesforce org, so parallelism stays at the job level
  // where the blast radius is understood.
  workers: process.env.CI ? 1 : undefined,
  // Shards emit blob reports that a follow-up job merges into a single HTML report. Note that
  // Playwright resolves these paths relative to this config file, not the repo root.
  // PLAYWRIGHT_HTML_OPEN=never prevents the report server from blocking non-interactive local
  // runs (scripts/run-e2e.mjs sets it automatically when stdout is not a TTY).
  reporter: process.env.CI
    ? [['blob', { outputDir: 'blob-report' }]]
    : [
        [
          'html',
          {
            outputFolder: 'playwright-report',
            open: htmlOpen,
          },
        ],
      ],
  use: {
    actionTimeout: THIRTY_SECONDS,
    navigationTimeout: THIRTY_SECONDS,
    baseURL,
    extraHTTPHeaders: {
      'CF-Access-Client-Id': process.env.CF_ACCESS_CLIENT_ID || '',
      'CF-Access-Client-Secret': process.env.CF_ACCESS_CLIENT_SECRET || '',
    },
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
    // {
    //   name: 'teardown',
    //   testMatch: /.*\.teardown\.ts/,
    //   use: {
    //     ...devices['Desktop Chrome'],
    //   },
    //   dependencies: ['chrome'],
    // },
    {
      name: 'chrome',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      testMatch: /.*\.spec\.ts/,
      dependencies: ['setup'],
    },
  ],
});
