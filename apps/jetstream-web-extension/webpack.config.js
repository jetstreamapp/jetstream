const { composePlugins, withNx } = require('@nx/webpack');
const { withReact } = require('@nx/react');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const webpack = require('webpack');

// Nx plugins for webpack.
module.exports = composePlugins(
  withNx(),
  withReact({
    // Uncomment this line if you don't want to use SVGR
    // See: https://react-svgr.com/
    // svgr: false
  }),
  (config) => {
    config.entry = {
      popup: './src/app/pages/popup/Popup.tsx',
      options: './src/app/pages/options/Options.tsx',
      query: './src/app/pages/query/Query.tsx',
      serviceWorker: './src/app/serviceWorker.ts',
      contentScript: './src/app/contentScript.tsx',
    };
    config.output = {
      filename: '[name].js',
      path: config.output.path,
      clean: true,
      // publicPath: ASSET_PATH,
    };
    config.resolve = {
      ...config.resolve,
      fallback: {
        ...config.resolve.fallback,
        // No longer using JSForce to avoid this
        crypto: require.resolve('crypto-browserify'),
        process: require.resolve('process/browser'),
        querystring: require.resolve('querystring-es3'),
        stream: require.resolve('stream-browserify'),
        timers: require.resolve('timers-browserify'),
        util: require.resolve('util/'),
      },
    };
    // config.optimization = {
    //   minimize: false,
    // };
    // if runtime chunk is enabled, then the service worker will not work
    config.optimization = {
      ...config.optimization,
      runtimeChunk: false,
      splitChunks: undefined,
    };
    config.plugins = config.plugins || [];
    config.plugins.push(
      new webpack.DefinePlugin({ 'process.browser': true }),
      new webpack.ProvidePlugin({
        // you must `npm install buffer` to use this.
        Buffer: ['buffer', 'Buffer'],
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: 'manifest.json',
            to: config.output.path,
            force: true,
            // TODO: add versioning
            // transform: function (content, path) {
            //   // generates the manifest file using the package.json informations
            //   return Buffer.from(
            //     JSON.stringify({
            //       description: process.env.npm_package_description,
            //       version: process.env.npm_package_version,
            //       ...JSON.parse(content.toString()),
            //     })
            //   );
            // },
          },
        ],
      }),
      // Render the HTML pages for all pages
      ...['popup', 'options', 'query'].map((moduleName) => {
        const filename = `${moduleName.toLowerCase()}.html`;
        return new HtmlWebpackPlugin({
          template: path.join(__dirname, 'src', 'app', 'pages', moduleName, filename),
          filename,
          chunks: [moduleName.toLowerCase()],
          cache: false,
        });
      })
    );
    return config;
  }
);
