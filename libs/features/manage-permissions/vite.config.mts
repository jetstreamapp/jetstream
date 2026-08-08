/// <reference types='vitest' />
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../../node_modules/.vite/libs/features/manage-permissions',
  resolve: { tsconfigPaths: true },
  test: {
    name: 'features-manage-permissions',
    watch: false,
    globals: true,
    environment: 'jsdom',
    setupFiles: ['../../test-utils/src/test-setup-dom.ts'],
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    passWithNoTests: true,
    coverage: {
      reportsDirectory: '../../../coverage/libs/features/manage-permissions',
      provider: 'v8' as const,
    },
  },
}));
