/// <reference types='vitest' />
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import react from '@vitejs/plugin-react-swc';
import dns from 'dns';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

dns.setDefaultResultOrder('verbatim');

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/jetstream-web-extension',
  envPrefix: 'NX',

  server: {
    port: 4201,
    host: 'localhost',
  },

  preview: {
    port: 4301,
    host: 'localhost',
  },

  plugins: [
    react({
      jsxImportSource: '@emotion/react',
    }),
    nxViteTsPaths(),
    nodePolyfills(),
  ],

  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },

  // resolve: {
  //   alias: {
  //     stream: 'stream-browserify',
  //     timers: 'timers-browserify',
  //   },
  // },

  // define: {
  //   process: {},
  // },

  build: {
    sourcemap: 'inline',
    minify: false,
    outDir: '../../dist/apps/jetstream-web-extension',
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'popup.html'),
        settings: resolve(__dirname, 'settings.html'),
        background: resolve(__dirname, 'src/app/background.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
        manualChunks: undefined,
      },
    },
  },

  test: {
    globals: true,
    cache: {
      dir: '../../node_modules/.vitest',
    },
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    includeSource: ['src/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/jetstream-web-extension',
      provider: 'v8',
    },
  },
});
