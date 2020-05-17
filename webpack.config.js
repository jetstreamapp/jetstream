const nrwlWebpackConfig = require('@nrwl/react/plugins/webpack');
const WorkerPlugin = require('worker-plugin');

module.exports = (config) => {
  config.plugins.unshift(new WorkerPlugin());
  return nrwlWebpackConfig(config);
};
