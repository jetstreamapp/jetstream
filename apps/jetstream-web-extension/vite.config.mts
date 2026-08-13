/// <reference types='vitest' />
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import {
  environmentReplacementPlugin,
  extensionScriptsBuildPlugin,
  getServerUrlForMode,
  manifestTransformPlugin,
  placeholderHtmlPlugin,
} from './vite.plugins.mts';

export default defineConfig(({ command, mode }) => {
  // Force staging to be "production" mode.
  // Scoped to real builds because this mutates the shared process: the root vitest config loads
  // every project's config into one process, and Vitest's mode is 'test', so an unguarded set here
  // flips NODE_ENV to production for all 62 projects. React then resolves its production build,
  // where `act` does not exist, and every React test in the repo fails with "React.act is not a
  // function". The bundle's own value comes from the `define` below, not from this.
  if (command === 'build' && mode !== 'development') {
    process.env.NODE_ENV = 'production';
  }

  return {
    root: import.meta.dirname,
    cacheDir: '../../node_modules/.vite/apps/jetstream-web-extension',
    envPrefix: 'NX',
    base: '',

    plugins: [
      environmentReplacementPlugin(mode),
      react({
        jsxImportSource: '@emotion/react',
      }),
      manifestTransformPlugin(mode),
      placeholderHtmlPlugin(),
      extensionScriptsBuildPlugin(mode),
    ],
    resolve: { tsconfigPaths: true },

    define: {
      'globalThis.__IS_BROWSER_EXTENSION__': 'true',
      'import.meta.env.NX_PUBLIC_AMPLITUDE_KEY': JSON.stringify(process.env.NX_PUBLIC_AMPLITUDE_KEY || ''),
      'import.meta.env.NX_PUBLIC_SERVER_URL': JSON.stringify(getServerUrlForMode(mode)),
      // Build-only, for the same shared-process reason as the NODE_ENV mutation above: defines are
      // textual rewrites, and under the root vitest config this one would replace the
      // `process.env.NODE_ENV` check inside react-dom/test-utils with "production" for every
      // project, so `React.act` would be missing and all React tests would fail.
      ...(command === 'build' ? { 'process.env.NODE_ENV': JSON.stringify(mode === 'development' ? 'development' : 'production') } : {}),
    },
    esbuild: {
      charset: 'ascii',
    },
    build: {
      outDir: '../../dist/apps/jetstream-web-extension',
      emptyOutDir: true,
      sourcemap: mode === 'development' ? 'inline' : false,
      minify: mode === 'development' ? false : 'esbuild',
      rolldownOptions: {
        input: {
          app: resolve(import.meta.dirname, 'app.html'),
          popup: resolve(import.meta.dirname, 'popup.html'),
          'additional-settings': resolve(import.meta.dirname, 'additional-settings.html'),
        },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: '[name]-[hash].js',
          assetFileNames: '[name].[ext]',
          // configure-zod has to be its own chunk. Merged into an entry chunk it would run after every
          // chunk that entry imports — including the one that builds schemas, which is too late.
          // See libs/shared/utils/src/lib/configure-zod.ts
          advancedChunks: { groups: [{ name: 'configure-zod', test: /configure-zod/, priority: 100 }] },
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
  };
});
