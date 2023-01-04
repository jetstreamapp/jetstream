import { PlaywrightTestConfig } from '@playwright/test';
import * as dotenv from 'dotenv';

// Ensure tests run via VSCode debugger are run from the root of the repo
if (process.cwd().endsWith('/apps/jetstream-e2e')) {
  process.chdir('../../');
}

dotenv.config();

const baseURL = (process.env.CI ? 'http://localhost:3333' : 'http://localhost:4200') + '/app/';

export const baseConfig: PlaywrightTestConfig = {
  webServer: process.env.CI
    ? {
        command: 'yarn start:e2e',
        port: 3333,
      }
    : undefined,
  retries: 3,
  maxFailures: 2,
  timeout: 120000,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { outputFolder: 'playwright-report', open: process.env.CI ? 'never' : 'on-failure' }]],
  use: {
    baseURL,
    permissions: ['notifications'],
    trace: 'on-first-retry',
    video: 'on-first-retry',
  },
};
