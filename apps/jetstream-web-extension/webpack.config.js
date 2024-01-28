const { composePlugins, withNx } = require('@nx/webpack');
const { withReact } = require('@nx/react');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const CrxLoadScriptWebpackPlugin = require('@cooby/crx-load-script-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const webpack = require('webpack');

// Nx plugins for webpack.
// @ts-expect-error withReact is complaining about the type of the config - but works on some machines just fine
module.exports = composePlugins(withNx(), withReact(), (config) => {
  const isDev = config.mode === 'development';
  config.devtool = isDev ? 'inline-source-map' : 'source-map';

  // @ts-expect-error typescript type is not correctly detected
  config.devServer = {
    // @ts-expect-error typescript type is not correctly detected
    ...config.devServer,
    hot: true,
    /**
     * We need devServer write files to disk,
     * But don't want it reload whole page because of the output file changes.
     */
    static: { watch: false },
    // static: true,
    /**
     * Set WebSocket url to dev-server, instead of the default `${publicPath}/ws`
     */
    client: {
      webSocketURL: 'ws://localhost:4201/ws',
    },
    /**
     * The host of the page of your script extension runs on.
     * You'll see `[webpack-dev-server] Invalid Host/Origin header` if this is not set.
     * preceding period is a wildcard for subdomains
     */
    allowedHosts: ['.salesforce.com', '.visual.force.com', '.lightning.force.com', '.cloudforce.com', '.visualforce.com'],
    devMiddleware: {
      // @ts-expect-error typescript type is not correctly detected
      ...config.devServer?.devMiddleware,
      /**
       * Write file to output folder /build, so we can execute it later.
       */
      writeToDisk: true,
    },
  };

  config.entry = {
    app: './src/app/pages/app/app.tsx',
    popup: './src/app/pages/popup/Popup.tsx',
    options: './src/app/pages/options/Options.tsx',
    serviceWorker: './src/app/serviceWorker.ts',
    contentScript: './src/app/contentScript.tsx',
  };
  config.output = {
    filename: '[name].js',
    path: config.output?.path,
    clean: true,
    // publicPath: 'http://localhost:4201/',
    // publicPath: ASSET_PATH,
  };
  config.resolve = {
    ...config.resolve,
    fallback: {
      ...config.resolve?.fallback,
      // No longer using JSForce to avoid this
      // crypto: require.resolve('crypto-browserify'),
      // process: require.resolve('process/browser'),
      // querystring: require.resolve('querystring-es3'),
      // stream: require.resolve('stream-browserify'),
      // timers: require.resolve('timers-browserify'),
      // util: require.resolve('util/'),
      // buffer: require.resolve('buffer'),
    },
  };
  // config.optimization = {
  //   minimize: false,
  // };
  // if runtime chunk is enabled, then the service worker will not work
  config.optimization = {
    ...config.optimization,
    runtimeChunk: false,
    sideEffects: true,
    splitChunks: false,
  };
  config.plugins = config.plugins || [];
  config.plugins.push(
    // @ts-expect-error not sure why this is saying invalid type
    new webpack.DefinePlugin({ 'process.browser': true }),
    // new webpack.ProvidePlugin({
    //   // you must `npm install buffer` to use this.
    //   Buffer: ['buffer', 'Buffer'],
    // }),
    // TODO: do I need to remove existing plugins?
    ...(isDev
      ? [
          new CrxLoadScriptWebpackPlugin(),
          new ReactRefreshWebpackPlugin({
            overlay: false,
          }),
        ]
      : []),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'manifest.json',
          to: config.output.path,
          force: true,
          transform: function (content, path) {
            if (!isDev) {
              return content;
            }

            /**
             * @type {chrome.runtime.ManifestV3}
             */
            const manifest = JSON.parse(content.toString());

            manifest.permissions?.push('scripting');
            manifest.web_accessible_resources?.[0].resources?.push('*.hot-update.json');

            // TODO: add versioning

            return Buffer.from(JSON.stringify(manifest, null, 2));

            // generates the manifest file using the package.json informations
            // return Buffer.from(
            //   JSON.stringify({
            //     description: process.env.npm_package_description,
            //     version: process.env.npm_package_version,
            //     ...JSON.parse(content.toString()),
            //   })
            // );
          },
        },
      ],
    }),
    // Render the HTML pages for all pages
    ...['app', 'popup', 'options'].map((moduleName) => {
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
});
