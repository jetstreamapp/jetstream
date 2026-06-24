/* eslint-disable @nx/enforce-module-boundaries */
const baseConfig = require('../../eslint.config.js');

module.exports = [
  ...baseConfig,
  {
    ignores: ['src/assets/**/*'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      'no-empty-pattern': 'off',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['**/__tests__/**', '**/*.spec.ts'],
    // Override or add rules here
    rules: {
      // Request-scoped logging flows through `getLogger()` (AsyncLocalStorage) from
      // '@jetstream/api-config'. Reading `req.log` / `res.log` directly bypasses the request
      // context (and still typechecks because @types/pino-http augments the base Express types),
      // so it is banned here to prevent regressions.
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='req'][property.name='log']",
          message: "Use getLogger() from '@jetstream/api-config' instead of req.log.",
        },
        {
          selector: "MemberExpression[object.name='res'][property.name='log']",
          message: "Use getLogger() from '@jetstream/api-config' instead of res.log.",
        },
      ],
    },
  },
  {
    files: ['**/*.js', '**/*.jsx'],
    // Override or add rules here
    rules: {},
  },
];
