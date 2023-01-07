import type { PlaywrightTestConfig } from '@playwright/test';

import { baseConfig } from '../../playwright.config.base';

const config: PlaywrightTestConfig = {
  ...baseConfig,
  globalSetup: require.resolve('./src/setup/global-setup.ts'),
};

export default config;
