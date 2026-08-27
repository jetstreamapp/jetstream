import react from '@vitejs/plugin-react';
import dns from 'dns';
import { resolve } from 'path';
import { defineConfig } from 'vite';

dns.setDefaultResultOrder('verbatim');

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/jetstream-desktop-client',
  envPrefix: 'NX',
  server: {
    port: 4201,
    host: 'localhost',
    fs: {
      allow: ['../../'],
    },
    proxy: {},
  },
  base: '',
  build: {
    outDir: '../../dist/apps/jetstream-desktop-client',
    reportCompressedSize: true,
    commonjsOptions: { transformMixedEsModules: true },
    assetsDir: './',
    emptyOutDir: true,
    rolldownOptions: {
      input: {
        // FIXME: for some reason this hangs if there are two entries here - works if either one is specified, but not both
        // if both reference the same typescript file, then it works - tried a new nx sample project and that worked fine
        main: resolve(import.meta.dirname, 'index.html'),
        // preferences: resolve(import.meta.dirname, 'preferences', 'index.html'),
      },
    },
  },
  plugins: [
    react({
      jsxImportSource: '@emotion/react',
    }),
  ],
  resolve: { tsconfigPaths: true },
  define: {
    'import.meta.vitest': undefined,
    'globalThis.__IS_BROWSER_EXTENSION__': false,
    'globalThis.__IS_DESKTOP__': true,
  },

  test: {
    name: 'jetstream-desktop-client',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    passWithNoTests: true,
    coverage: {
      reportsDirectory: '../../coverage/apps/jetstream-desktop-client',
      provider: 'v8' as const,
    },
  },
}));
