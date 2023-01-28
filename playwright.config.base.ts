import { PlaywrightTestConfig } from '@playwright/test';
import * as dotenv from 'dotenv';

const ONE_SECOND = 1000;
const TEN_SECONDS = 10 * ONE_SECOND;
const THIRTY_SECONDS = 30 * ONE_SECOND;
const ONE_MINUTE = 60 * ONE_SECOND;

// Ensure tests run via VSCode debugger are run from the root of the repo
if (process.cwd().endsWith('/apps/jetstream-e2e')) {
  process.chdir('../../');
}

dotenv.config();

const baseURL = process.env.CI ? 'http://localhost:3333/' : 'http://localhost:4200/';

export const baseConfig: PlaywrightTestConfig = {
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
};
