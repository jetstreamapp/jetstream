import type { StorybookConfig } from '@storybook/react-webpack5';

const config: StorybookConfig = {
  framework: '@storybook/react-webpack5',
  stories: [
    '../src/lib/**/*.stories.mdx',
    '../src/lib/**/*.stories.@(js|jsx|ts|tsx)',
    '../../shared/**/src/lib/**/*.stories.@(js|jsx|ts|tsx)',
  ],
  addons: ['@storybook/addon-essentials', '@nx/react/plugins/storybook'],
  features: {
    // storyStoreV7: false, // 👈 Opt out of on-demand story loading
  },
  docs: {
    autodocs: true,
  },
};

export default config;
