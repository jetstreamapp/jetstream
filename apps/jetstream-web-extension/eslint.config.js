const baseConfig = require('../../eslint.config.js');

module.exports = [
  ...baseConfig,
  {
    ignores: ['src/assets/**/*'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    // Override or add rules here
    rules: {},
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['**/*.js', '**/*.jsx'],
    // Override or add rules here
    rules: {},
  },
  {
    files: ['**/*.controller.ts'],
    // Override or add rules here
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
];
