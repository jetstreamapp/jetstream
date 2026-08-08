/// <reference types='vitest' />
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../../node_modules/.vite/libs/features/record-type-manager',
  resolve: { tsconfigPaths: true },
  test: {
    name: 'features-record-type-manager',
    watch: false,
    globals: true,
    environment: 'jsdom',
    setupFiles: ['../../test-utils/src/test-setup-dom.ts'],
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    passWithNoTests: true,
    coverage: {
      reportsDirectory: '../../../coverage/libs/features/record-type-manager',
      provider: 'v8' as const,
    },
  },
}));
