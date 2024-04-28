/* eslint-disable */
export default {
  displayName: 'connected-connected-ui',

  transform: {
    '^.+\\.[tj]sx?$': ['babel-jest', { cwd: __dirname, configFile: './babel-jest.config.json' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],

  preset: '../../../jest.preset.js',
};
