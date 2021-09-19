const { join } = require('path');

module.exports = {
  plugins: {
    'postcss-import': {},
    tailwindcss: {
      config: join(__dirname, 'tailwind.config.js'),
    },
    autoprefixer: {},
    'postcss-preset-env': { stage: 2 },
  },
};
