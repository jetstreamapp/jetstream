/* eslint-disable */
export default {
  displayName: 'monaco-configuration',

  globals: {},
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/libs/monaco-configuration',
  preset: '../../jest.preset.js',
};
