export default {
  displayName: 'splitjs',

  transform: {
    '^.+\\.[tj]sx?$': 'babel-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/libs/splitjs',
  preset: '../../jest.preset.js',
};
