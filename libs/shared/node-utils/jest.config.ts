/* eslint-disable */
export default {
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],

  globals: {},
  displayName: 'shared-node-utils',
  preset: '../../../jest.preset.js',
};
