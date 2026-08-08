/// <reference types='vitest' />
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../../node_modules/.vite/libs/shared/ui-data-history',
  resolve: { tsconfigPaths: true },
  test: {
    name: 'ui-data-history',
    watch: false,
    globals: true,
    environment: 'jsdom',
    // Order matters — see the comment in test-setup-indexeddb.ts
    setupFiles: ['../../test-utils/src/test-setup-indexeddb.ts', 'src/test-setup.ts'],
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    passWithNoTests: true,
    coverage: {
      reportsDirectory: '../../../coverage/libs/shared/ui-data-history',
      provider: 'v8' as const,
    },
  },
}));
