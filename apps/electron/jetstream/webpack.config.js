const { DefinePlugin } = require('webpack');
const getWebpackConfig = require('@nrwl/react/plugins/webpack');

function getClientEnvironment() {
  // Grab NODE_ENV and NX_* environment variables and prepare them to be
  // injected into the application via DefinePlugin in webpack configuration.
  const NX_APP = /^NX_/i;

  const raw = Object.keys(process.env)
    .filter((key) => NX_APP.test(key))
    .reduce((env, key) => {
      env[key] = process.env[key];
      return env;
    }, {});

  // Stringify all values so we can feed into webpack DefinePlugin
  return {
    'process.env': Object.keys(raw).reduce((env, key) => {
      env[key] = JSON.stringify(raw[key]);
      return env;
    }, {}),
  };
}

module.exports = (config) => {
  config = getWebpackConfig(config);

  config.plugins = config.plugins || [];
  config.plugins.unshift(new DefinePlugin(getClientEnvironment()));

  return config;
};
