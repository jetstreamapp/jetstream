/// <reference types='vitest' />
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/libs/shared/ui-data-history',
  plugins: [nxViteTsPaths()],
  test: {
    name: 'ui-data-history',
    watch: false,
    globals: true,
    environment: 'jsdom',
    // fake-indexeddb must be installed before anything imports dexie — organize-imports is free to
    // reorder imports inside test-setup.ts, so the polyfill is loaded as its own setup file instead.
    setupFiles: ['fake-indexeddb/auto', 'src/test-setup.ts'],
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    passWithNoTests: true,
    coverage: {
      reportsDirectory: '../../../coverage/libs/shared/ui-data-history',
      provider: 'v8' as const,
    },
  },
}));
