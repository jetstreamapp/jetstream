const getConfig = require('@nrwl/react/plugins/bundle-babel');
const getWebpackConfig = require('@nrwl/react/plugins/webpack');
const WorkerPlugin = require('worker-plugin');
const GitRevisionPlugin = require('git-revision-webpack-plugin');
const { DefinePlugin } = require('webpack');
const gitRevisionPlugin = new GitRevisionPlugin();

module.exports = (config) => {
  // config.plugins.unshift(new WorkerPlugin());

  config = getWebpackConfig(config);

  // https://webpack.js.org/loaders/worker-loader/
  config.module.rules.unshift({ test: /\.worker\.ts$/, loader: 'worker-loader' });

  config.node = config.node || {};
  config.node = { ...config.node, process: false, Buffer: false };

  config.plugins = config.plugins || [];
  config.plugins.unshift(gitRevisionPlugin);
  config.plugins.unshift(
    new DefinePlugin({
      'process.env.GIT_VERSION': JSON.stringify(gitRevisionPlugin.version()),
      'process.env.GIT_SHA': JSON.stringify(gitRevisionPlugin.commithash()),
      'process.env.GIT_BRANCH': JSON.stringify(gitRevisionPlugin.branch()),
    })
  );

  config.externals = config.externals || {};
  config.externals = {
    ...config.externals,
    'monaco-editor': 'monaco-editor',
  };

  return config;
};
