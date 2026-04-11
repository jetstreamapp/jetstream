/// <reference types='vitest' />
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import { extensionScriptsBuildPlugin, manifestTransformPlugin, placeholderHtmlPlugin } from './vite.plugins';

export default defineConfig(({ mode }) => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/jetstream-web-extension',
  envPrefix: 'NX',
  base: '',

  plugins: [
    react({
      jsxImportSource: '@emotion/react',
      babel: {
        plugins: ['@emotion/babel-plugin'],
      },
    }),
    nxViteTsPaths(),
    manifestTransformPlugin(mode),
    placeholderHtmlPlugin(),
    extensionScriptsBuildPlugin(mode),
  ],

  define: {
    'globalThis.__IS_BROWSER_EXTENSION__': 'true',
    'import.meta.env.NX_PUBLIC_AMPLITUDE_KEY': JSON.stringify(process.env.NX_PUBLIC_AMPLITUDE_KEY || ''),
    'process.env.NODE_ENV': JSON.stringify(mode === 'development' ? 'development' : 'production'),
  },

  build: {
    outDir: '../../dist/apps/jetstream-web-extension',
    emptyOutDir: true,
    sourcemap: mode === 'development' ? 'inline' : false,
    minify: mode === 'development' ? false : 'esbuild',
    rollupOptions: {
      input: {
        app: resolve(__dirname, 'app.html'),
        popup: resolve(__dirname, 'popup.html'),
        'additional-settings': resolve(__dirname, 'additional-settings.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name]-[hash].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },

  test: {
    name: 'jetstream-web-extension',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    passWithNoTests: true,
    coverage: {
      reportsDirectory: '../../coverage/apps/jetstream-web-extension',
      provider: 'v8' as const,
    },
  },
}));
