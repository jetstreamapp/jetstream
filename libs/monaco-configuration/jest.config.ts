/* eslint-disable */
export default {
  displayName: 'monaco-configuration',

  globals: {},
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],

  preset: '../../jest.preset.js',
};
