import { PlaywrightTestConfig } from '@playwright/test';
import * as dotenv from 'dotenv';

// Ensure tests run via VSCode debugger are run from the root of the repo
if (process.cwd().endsWith('/apps/jetstream-e2e')) {
  process.chdir('../../');
}

dotenv.config();

const baseURL = (process.env.CI ? 'http://localhost:3333' : 'http://localhost:4200') + '/app/';

export const baseConfig: PlaywrightTestConfig = {
  retries: 3,
  expect: {
    timeout: 10 * 1000,
  },
  maxFailures: 2,
  timeout: 120000,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { outputFolder: 'playwright-report', open: process.env.CI ? 'never' : 'on-failure' }]],
  use: {
    actionTimeout: 10 * 1000,
    navigationTimeout: 30 * 1000,
    baseURL,
    permissions: ['notifications'],
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
};
