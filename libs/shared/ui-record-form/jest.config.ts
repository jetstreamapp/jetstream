/* eslint-disable */
export default {
  displayName: 'shared-ui-record-form',

  transform: {
    '^.+\\.[tj]sx?$': ['babel-jest', { cwd: __dirname, configFile: './babel-jest.config.json' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],

  preset: '../../../jest.preset.js',
};
