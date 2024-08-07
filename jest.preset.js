const nxPreset = require('@nx/jest/preset').default;

/** @type {import('jest').Config} */
const config = {
  ...nxPreset,
  testMatch: ['**/__tests__/**/+(*.)+(spec).+(ts)?(x)'],
  modulePathIgnorePatterns: ['apps/jetstream-e2e/'],
  transform: {
    '^.+\\.(ts|js|html)$': 'ts-jest',
  },
  resolver: '@nx/jest/plugins/resolver',
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageReporters: ['html'],
  globals: {
    ...nxPreset.globals,
    __IS_CHROME_EXTENSION__: false,
  },
};

module.exports = config;
