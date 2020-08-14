const getConfig = require('@nrwl/react/plugins/bundle-babel');
const getWebpackConfig = require('@nrwl/react/plugins/webpack');
const WorkerPlugin = require('worker-plugin');

module.exports = (config) => {
  // config.plugins.unshift(new WorkerPlugin());

  config = getWebpackConfig(config);

  // https://webpack.js.org/loaders/worker-loader/
  config.module.rules.unshift({ test: /\.worker\.ts$/, loader: 'worker-loader' });

  config.node = config.node || {};
  config.node = { ...config.node, process: false, Buffer: false };

  return config;
};
