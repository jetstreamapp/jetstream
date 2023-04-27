/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import dns from 'dns';
import { PluginOption, defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import viteTsConfigPaths from 'vite-tsconfig-paths';

dns.setDefaultResultOrder('verbatim');
const BASE_HREF = '/app';

/**
 * Adds <base href="/app">` to the head of the index.html
 * The reason why the `base` configuration property doesn't work is because it makes
 * all assets served under `/app` of `/` and this impacts the download zip service worker
 * We only want to the service worker to listen to events related to downloads, but not capture any other events
 * and the only way to do this is make sure all assets are served from the root, but we still want our app path to be `/app`
 *
 * This mimics the same behavior we had with webpack before migrating to vite
 */
const baseHrefPlugin: () => PluginOption = () => {
  return {
    name: 'html-transform',
    transformIndexHtml(html) {
      return html.replace('<head>', `<head>\n    <base href="${BASE_HREF}">`);
    },
  };
};

export default defineConfig({
  cacheDir: '../../node_modules/.vite/jetstream',
  envPrefix: 'NX',
  publicDir: 'src/assets',

  server: {
    port: 4200,
    host: 'localhost',
  },

  build: {
    // Put all assets at the root of the app instead of under /assets
    assetsDir: './',
    rollupOptions: {
      output: {
        sourcemap: true,
      },
    },
  },

  plugins: [
    react({
      jsxImportSource: '@emotion/react',
      babel: {
        plugins: ['@emotion/babel-plugin'],
      },
    }),
    viteTsConfigPaths({
      root: '../../',
    }),
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
    plugins: [
      viteTsConfigPaths({
        root: '../../',
      }),
    ],
  },
});
