/// <reference types="vitest" />
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import react from '@vitejs/plugin-react';
import dns from 'dns';
import { defineConfig } from 'vite';
import { baseHrefPlugin, replaceFiles } from './vite.plugins';

// import replaceFiles from '@nx/vite/plugins/rollup-replace-files.plugin';

dns.setDefaultResultOrder('verbatim');

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/jetstream',
  envPrefix: 'NX',

  server: {
    port: 4200,
    host: 'localhost',
    fs: {
      allow: ['..'],
    },
  },
  base: './',
  build: {
    outDir: '../../dist/apps/jetstream',
    reportCompressedSize: true,
    commonjsOptions: { transformMixedEsModules: true },
    // Put all assets at the root of the app instead of under /assets
    assetsDir: './',
    sourcemap: true,
    emptyOutDir: true,
    rollupOptions: {},
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
  ],

  worker: {
    plugins: () => [nxViteTsPaths()],
  },
});
