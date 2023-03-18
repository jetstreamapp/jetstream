const getWebpackConfig = require('@nrwl/react/plugins/webpack');

module.exports = (config) => {
  config = getWebpackConfig(config);

  // https://stackoverflow.com/questions/64294706/webpack5-automatic-publicpath-is-not-supported-in-this-browser
  config.output.publicPath = '';

  // https://webpack.js.org/loaders/worker-loader/
  // config.module.rules.unshift({ test: /\.worker\.ts$/, loader: 'worker-loader' });

  // required for monaco editor in electron environment
  config.resolve = config.resolve || {};
  config.resolve.fallback = { path: false };

  config.plugins = config.plugins || [];

  return config;
};
