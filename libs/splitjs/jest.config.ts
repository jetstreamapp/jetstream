/* eslint-disable */
export default {
  displayName: 'splitjs',

  transform: {
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/react/babel'] }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/libs/splitjs',
  preset: '../../jest.preset.js',
};
