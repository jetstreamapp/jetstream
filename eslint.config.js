const nx = require('@nx/eslint-plugin');

module.exports = [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/assets/**/*',
      '**/dist',
      '**/generated/**/*',
      '**/monaco/vs/**/*',
      '**/public/**/*',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      'no-empty-pattern': 'off',
      'object-shorthand': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@nx/enforce-module-boundaries': [
        'error',
        {
          allow: [],
          depConstraints: [
            {
              sourceTag: 'scope:server',
              onlyDependOnLibsWithTags: ['scope:server', 'scope:type-only', 'scope:shared', 'scope:any'],
            },
            {
              sourceTag: 'scope:browser',
              onlyDependOnLibsWithTags: ['scope:browser', 'scope:type-only', 'scope:shared', 'scope:any'],
            },
            {
              sourceTag: 'scope:e2e',
              onlyDependOnLibsWithTags: ['scope:server', 'scope:browser', 'scope:type-only', 'scope:shared', 'scope:e2e', 'scope:any'],
            },
            {
              sourceTag: 'scope:worker',
              onlyDependOnLibsWithTags: ['scope:allow-worker-import', 'scope:type-only', 'scope:shared', 'scope:any'],
            },
            {
              sourceTag: 'scope:allow-worker-import',
              onlyDependOnLibsWithTags: ['scope:allow-worker-import', 'scope:type-only', 'scope:any'],
            },
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-member-accessibility': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-parameter-properties': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true, // Allows unused props when using rest spread
        },
      ],
    },
  },
  // Be much more lenient in tests
  {
    files: [
      '**/*-e2e/**/*.{ts,tsx}',
      '**/e2e-utils/**/*.{ts,tsx}',
      '**/__tests__/**/*.{ts,tsx}',
      '**/{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
];
