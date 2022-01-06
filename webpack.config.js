const { DefinePlugin } = require('webpack');
const getWebpackConfig = require('@nrwl/react/plugins/webpack');
const { GitRevisionPlugin } = require('git-revision-webpack-plugin');
const gitRevisionPlugin = new GitRevisionPlugin();
// const WorkerPlugin = require('worker-plugin');

module.exports = (config) => {
  // config.plugins.unshift(new WorkerPlugin());

  config = getWebpackConfig(config);

  // https://stackoverflow.com/questions/64294706/webpack5-automatic-publicpath-is-not-supported-in-this-browser
  config.output.publicPath = '';

  // https://webpack.js.org/loaders/worker-loader/
  // config.module.rules.unshift({ test: /\.worker\.ts$/, loader: 'worker-loader' });

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
