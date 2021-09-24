const { DefinePlugin } = require('webpack');
const { GitRevisionPlugin } = require('git-revision-webpack-plugin');
const gitRevisionPlugin = new GitRevisionPlugin();

module.exports = (config) => {
  config = config || {};
  config.plugins = config.plugins || [];
  config.plugins.unshift(gitRevisionPlugin);
  config.plugins.unshift(
    new DefinePlugin({
      'process.env.GIT_VERSION': JSON.stringify(gitRevisionPlugin.version()),
      'process.env.GIT_SHA': JSON.stringify(gitRevisionPlugin.commithash()),
      'process.env.GIT_BRANCH': JSON.stringify(gitRevisionPlugin.branch()),
    })
  );

  return config;
};
