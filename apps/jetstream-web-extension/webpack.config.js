const { composePlugins, withNx } = require('@nx/webpack');
const { withReact } = require('@nx/react');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const webpack = require('webpack');

// @ts-expect-error withReact is complaining about the type of the config - but works on some machines just fine
module.exports = composePlugins(withNx(), withReact(), (config) => {
  const isDev = config.mode === 'development';
  config.devtool = isDev ? 'inline-source-map' : 'source-map';

  config.entry = {
    app: './src/pages/app/App.tsx',
    popup: './src/pages/popup/Popup.tsx',
    options: './src/pages/options/Options.tsx',
    serviceWorker: './src/serviceWorker.ts',
    contentScript: './src/contentScript.tsx',
  };
  config.output = {
    filename: '[name].js',
    path: config.output?.path,
    clean: true,
  };
  config.resolve = {
    ...config.resolve,
  };
  // if runtime chunk is enabled, then the service worker will not work
  config.optimization = {
    ...config.optimization,
    runtimeChunk: false,
    splitChunks: false,
  };
  config.plugins = config.plugins || [];
  config.plugins.push(
    // @ts-expect-error this is valid, not sure why it is complaining
    new webpack.EnvironmentPlugin({
      NX_PUBLIC_AUTH_AUDIENCE: 'http://getjetstream.app/app_metadata',
      NX_PUBLIC_AMPLITUDE_KEY: '',
      NX_PUBLIC_ROLLBAR_KEY: '',
    }),
    new webpack.DefinePlugin({
      __IS_CHROME_EXTENSION__: true,
    }),
    createHtmlPagePlugin('app'),
    createHtmlPagePlugin('popup'),
    createHtmlPagePlugin('options'),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'src/manifest.json',
          to: config.output.path,
          force: true,
        },
      ],
    })
  );
  return config;
});

function createHtmlPagePlugin(moduleName) {
  const filename = `${moduleName.toLowerCase()}.html`;
  return new HtmlWebpackPlugin({
    template: path.join(__dirname, 'src', 'pages', moduleName, filename),
    filename,
    chunks: [moduleName.toLowerCase()],
    cache: false,
  });
}
