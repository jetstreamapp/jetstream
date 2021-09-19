const { join } = require('path');

module.exports = {
  plugins: {
    'postcss-import': {},
    tailwindcss: {
      config: './apps/landing/tailwind.config.js',
    },
    autoprefixer: {},
    'postcss-preset-env': { stage: 2 },
  },
};
