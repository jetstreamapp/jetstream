/// <reference types='vitest' />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/landing',
  // Only used by the vitest tests in this project - next builds the app itself
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    name: 'landing',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    passWithNoTests: true,
    coverage: {
      reportsDirectory: '../../coverage/apps/landing',
      provider: 'v8' as const,
    },
  },
}));
