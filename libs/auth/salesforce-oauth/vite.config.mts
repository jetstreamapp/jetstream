/// <reference types='vitest' />
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../../node_modules/.vite/libs/auth/salesforce-oauth',
  resolve: { tsconfigPaths: true },
  test: {
    name: 'salesforce-oauth',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/libs/auth/salesforce-oauth',
      provider: 'v8' as const,
    },
  },
}));
