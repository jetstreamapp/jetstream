const { DefinePlugin } = require('webpack');
const { GitRevisionPlugin } = require('git-revision-webpack-plugin');

module.exports = (config) => {
  config.optimization.runtimeChunk = false;
  config.output.filename = 'download-zip.sw.js';
  // Since we explicitly set the filename, we would have a conflict if more than one file were produced
  delete config.entry.polyfills;
  return config;
};
