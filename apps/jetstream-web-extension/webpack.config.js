const { composePlugins, withNx } = require('@nx/webpack');
const { withReact } = require('@nx/react');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const webpack = require('webpack');
const { readFileSync } = require('fs');

/**
 * Build webpack resolve.alias from tsconfig paths.
 * This replaces tsconfig-paths-webpack-plugin which requires the deprecated baseUrl option.
 *
 * Uses webpack's '$' exact-match suffix for aliases that are prefixes of other aliases
 * (e.g. '@jetstream/ui$' so it doesn't greedily match '@jetstream/ui/app-state').
 */
function getTsconfigPathAliases() {
  const tsconfig = JSON.parse(readFileSync(path.resolve(__dirname, '../../tsconfig.base.json'), 'utf-8'));
  const paths = tsconfig.compilerOptions?.paths || {};
  const rootDir = path.resolve(__dirname, '../..');
  const aliasKeys = Object.keys(paths);
  const aliases = {};
  for (const [alias, targets] of Object.entries(paths)) {
    if (targets.length > 0) {
      const resolvedPath = path.resolve(rootDir, targets[0]);
      // If this alias is a prefix of another alias, use exact matching
      const isPrefix = aliasKeys.some((other) => other !== alias && other.startsWith(alias + '/'));
      aliases[isPrefix ? `${alias}$` : alias] = resolvedPath;
    }
  }
  return aliases;
}

// @ts-expect-error withReact is complaining about the type of the config - but works on some machines just fine
module.exports = composePlugins(withNx(), withReact(), (config, { configuration }) => {
  const isDev = configuration === 'development';
  config.devtool = isDev ? 'inline-source-map' : false;

  config.entry = {
    app: './src/pages/app/App.tsx',
    popup: './src/pages/popup/Popup.tsx',
    additionalSettings: './src/pages/additional-settings/AdditionalSettings.tsx',
    serviceWorker: './src/extension-scripts/service-worker.ts',
    contentScript: './src/extension-scripts/content-script.tsx',
    contentAuthScript: './src/extension-scripts/content-auth-script.ts',
  };
  config.output = {
    filename: '[name].js',
    path: config.output?.path,
    clean: true,
  };
  config.resolve = {
    ...config.resolve,
    alias: {
      ...config.resolve?.alias,
      ...getTsconfigPathAliases(),
    },
    // Remove tsconfig-paths-webpack-plugin since it requires the deprecated baseUrl option
    plugins: (config.resolve?.plugins || []).filter((plugin) => plugin?.constructor?.name !== 'TsconfigPathsPlugin'),
  };
  // if runtime chunk is enabled, then the service worker will not work
  config.optimization = {
    ...config.optimization,
    // NOTE: Tree shaking was breaking soql-parser-js - found this issue for short-term workaround: https://github.com/webpack/webpack/issues/16262
    // FIXME: research this in more detail
    innerGraph: false,
    minimizer: [
      (compiler) => {
        const TerserPlugin = require('terser-webpack-plugin');
        new TerserPlugin({
          parallel: true,
          minify: TerserPlugin.esbuildMinify,
        }).apply(compiler);
      },
    ],
    runtimeChunk: false,
    splitChunks: {
      chunks(chunk) {
        return chunk.name === 'app' || chunk.name === 'additionalSettings';
      },
    },
  };
  config.plugins = config.plugins || [];
  config.plugins.push(
    // @ts-expect-error this is valid, not sure why it is complaining
    new webpack.EnvironmentPlugin({
      NX_PUBLIC_AMPLITUDE_KEY: '',
      NX_PUBLIC_ROLLBAR_KEY: '',
    }),
    new webpack.DefinePlugin({
      'globalThis.__IS_BROWSER_EXTENSION__': true,
      'import.meta.env.NX_PUBLIC_AMPLITUDE_KEY': 'null',
    }),
    createHtmlPagePlugin('app', 'app'),
    createHtmlPagePlugin('popup', 'popup'),
    createHtmlPagePlugin('additional-settings', 'additionalSettings'),

    createHtmlPlaceholderPagePlugin('home'),
    createHtmlPlaceholderPagePlugin('organizations'),
    createHtmlPlaceholderPagePlugin('query'),
    createHtmlPlaceholderPagePlugin('load'),
    createHtmlPlaceholderPagePlugin('load-multiple-objects'),
    createHtmlPlaceholderPagePlugin('update-records'),
    createHtmlPlaceholderPagePlugin('automation-control'),
    createHtmlPlaceholderPagePlugin('permissions-manager'),
    createHtmlPlaceholderPagePlugin('deploy-metadata'),
    createHtmlPlaceholderPagePlugin('create-fields'),
    createHtmlPlaceholderPagePlugin('formula-evaluator'),
    createHtmlPlaceholderPagePlugin('apex'),
    createHtmlPlaceholderPagePlugin('debug-logs'),
    createHtmlPlaceholderPagePlugin('object-export'),
    createHtmlPlaceholderPagePlugin('salesforce-api'),
    createHtmlPlaceholderPagePlugin('platform-event-monitor'),
    createHtmlPlaceholderPagePlugin('feedback'),
    createHtmlPlaceholderPagePlugin('profile'),
    createHtmlPlaceholderPagePlugin('settings'),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'src/manifest.json',
          to: config.output.path,
          force: true,
          /**
           * Inject environment specific non-production hosts into manifest.json
           */
          transform: (content) => {
            const manifest = JSON.parse(content.toString());
            const contentAuthScript = manifest.content_scripts.find((item) => item.js.includes('contentAuthScript.js'));
            const additionalJetstreamHosts = [];
            switch (configuration) {
              case 'development':
                additionalJetstreamHosts.push('http://localhost/*');
                break;
              case 'staging':
                additionalJetstreamHosts.push('https://staging.jetstream-app.com/web-extension/*');
                break;
            }
            contentAuthScript.matches.push(...additionalJetstreamHosts);
            manifest.host_permissions.push(...additionalJetstreamHosts);
            return JSON.stringify(manifest, null, 2);
          },
        },
        {
          from: 'src/redirect-utils/redirect.js',
          to: config.output.path,
          force: true,
        },
      ],
    }),
  );
  return config;
});

/**
 *
 * @param {string} moduleName Name of the folder and HTML file (without extension)
 * @param {string} chunkName Name of the property in "config.entry"
 * @returns
 */
function createHtmlPagePlugin(moduleName, chunkName) {
  const filename = `${moduleName.toLowerCase()}.html`;
  return new HtmlWebpackPlugin({
    template: path.join(__dirname, 'src', 'pages', moduleName, filename),
    filename,
    chunks: [chunkName],
    cache: false,
  });
}

function createHtmlPlaceholderPagePlugin(moduleName) {
  const filename = `${moduleName.toLowerCase()}.html`;
  return new HtmlWebpackPlugin({
    template: path.join(__dirname, 'src/redirect-utils/placeholder-redirect.html'),
    filename,
    chunks: [moduleName.toLowerCase()],
    cache: false,
  });
}
