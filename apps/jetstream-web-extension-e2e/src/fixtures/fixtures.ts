import * as dotenv from 'dotenv';

import { ApiRequestUtils, AuthenticationPage, WebExtensionPage } from '@jetstream/test/e2e-utils';
import { workspaceRoot } from '@nx/devkit';
import { test as base, chromium, Page, type BrowserContext } from '@playwright/test';
import path from 'path';
import { z } from 'zod';

globalThis.__IS_CHROME_EXTENSION__ = false;

// Ensure tests run via VSCode debugger are run from the root of the repo
if (process.cwd().endsWith('/apps/jetstream-web-extension-e2e')) {
  process.chdir('../../');
}

dotenv.config();

const environmentSchema = z.object({
  E2E_LOGIN_URL: z.string(),
  E2E_LOGIN_USERNAME: z.string(),
  E2E_LOGIN_PASSWORD: z.string(),
});

type Fixtures = {
  environment: z.infer<typeof environmentSchema>;
  context: BrowserContext;
  page: Page;
  extensionId: string;
  apiRequestUtils: ApiRequestUtils;
  authenticationPage: AuthenticationPage;
  webExtensionPage: WebExtensionPage;
};

export const test = base.extend<Fixtures>({
  environment: async ({}, use) => {
    await use(environmentSchema.parse(process.env));
  },
  context: async ({}, use) => {
    const pathToExtension = path.join(workspaceRoot, 'dist/apps/jetstream-web-extension');
    const context = await chromium.launchPersistentContext('', {
      // headless: false,
      channel: 'chromium',
      args: [`--disable-extensions-except=${pathToExtension}`, `--load-extension=${pathToExtension}`],
    });
    await use(context);
    await context.close();
  },
  page: async ({ context }, use) => {
    const page = await context.newPage();
    await use(page);
    await page.close();
  },
  extensionId: async ({ context }, use) => {
    // for manifest v3:
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker');
    }

    const extensionId = background.url().split('/')[2];
    await use(extensionId);
  },
  apiRequestUtils: async ({ page, environment }, use) => {
    await use(new ApiRequestUtils(page, environment.E2E_LOGIN_USERNAME));
  },
  webExtensionPage: async ({ page, extensionId }, use) => {
    await use(new WebExtensionPage(page, extensionId));
  },
  authenticationPage: async ({ page }, use) => {
    await use(new AuthenticationPage(page));
  },
});

export const expect = test.expect;
