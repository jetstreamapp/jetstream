const baseConfig = require('../../eslint.config.js');

module.exports = [
  ...baseConfig,
  {
    ignores: ['.docusaurus', 'build', 'node_modules'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    // Override or add rules here
    rules: {},
    languageOptions: {
      parserOptions: {
        project: ['apps/docs/tsconfig.*?.json'],
      },
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    // Override or add rules here
    rules: {},
  },
  {
    files: ['**/*.js', '**/*.jsx'],
    // Override or add rules here
    rules: {},
  },
];
