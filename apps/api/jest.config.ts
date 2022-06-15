export default {
  coverageDirectory: '../../coverage/apps/api',
  globals: { 'ts-jest': { tsconfig: '<rootDir>/tsconfig.spec.json' } },
  displayName: 'api',
  testEnvironment: 'node',
  preset: '../../jest.preset.js',
};
