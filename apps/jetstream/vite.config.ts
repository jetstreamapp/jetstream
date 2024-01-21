/// <reference types="vitest" />
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import react from '@vitejs/plugin-react';
import dns from 'dns';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { baseHrefPlugin, replaceFiles } from './vite.plugins';

dns.setDefaultResultOrder('verbatim');

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/jetstream',
  envPrefix: 'NX',
  publicDir: 'src/assets',

  server: {
    port: 4200,
    host: 'localhost',
  },

  build: {
    outDir: '../../dist/apps/jetstream',
    reportCompressedSize: true,
    commonjsOptions: { transformMixedEsModules: true },
    // Put all assets at the root of the app instead of under /assets
    assetsDir: './',
    sourcemap: true,
    rollupOptions: {
      output: {
        sourcemap: true,
      },
    },
  },

  plugins: [
    replaceFiles([
      // { replace: 'apps/jetstream/src/environments/environment.ts', with: 'apps/jetstream/src/environments/environment.prod.ts' },
      // { replace: 'libs/ui/.storybook/storybook-styles.scss', with: 'apps/jetstream/src/main.scss' },
    ]),
    react({
      jsxImportSource: '@emotion/react',
      babel: {
        plugins: ['@emotion/babel-plugin'],
      },
    }),
    nxViteTsPaths(),
    baseHrefPlugin(),
    VitePWA({
      registerType: 'prompt',

      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',

      injectRegister: 'auto',
      devOptions: {
        enabled: false, // never got this to work
      },
      workbox: {
        mode: 'development',
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'Jetstream',
        short_name: 'Jetstream',
        description:
          'Jetstream is a set of tools that supercharge your administration of Salesforce.com. Jetstream is built for administrators, developers, quality assurance, or power users that want to speed up your management of Salesforce. Jetstream comes with an advanced query builder for viewing records, a powerful data loader for making changes to your record data, and many more features!',
        theme_color: '#111827',
        icons: [
          {
            src: 'images/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'images/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'images/jetstream-icon.svg',
            sizes: '192*192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'images/jetstream-icon-bare.svg',
            sizes: '192*192',
            type: 'image/png',
            purpose: 'monochrome',
          },
        ],
      },
    }),
  ],

  worker: {
    plugins: () => [nxViteTsPaths()],
  },
});
