module.exports = {
  core: {
    builder: 'webpack5',
  },
  stories: [
    '../src/lib/**/*.stories.mdx',
    '../src/lib/**/*.stories.@(js|jsx|ts|tsx)',
    '../../shared/**/src/lib/**/*.stories.@(js|jsx|ts|tsx)',
  ],
  addons: ['@storybook/addon-essentials', '@nx/react/plugins/storybook'],
  webpackFinal: async (config, { configType }) => {
    // add your own webpack tweaks if needed

    return config;
  },
  docs: {
    autodocs: true,
  },
};
