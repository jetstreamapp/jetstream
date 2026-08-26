/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/jetstream-canvas',
  base: '/canvas/',
  server: {
    port: 4202,
    host: 'localhost',
    fs: {
      allow: ['../../'],
    },
  },
  preview: {
    port: 4202,
    host: 'localhost',
  },
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  build: {
    outDir: '../../dist/apps/jetstream-canvas',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rolldownOptions: {
      output: {
        // configure-zod has to be its own chunk. Merged into the entry chunk it would run after every
        // chunk the entry imports — including the one that builds schemas, which is too late.
        // See libs/shared/utils/src/lib/configure-zod.ts
        advancedChunks: { groups: [{ name: 'configure-zod', test: /configure-zod/, priority: 100 }] },
      },
    },
  },
  define: {
    'import.meta.vitest': undefined,
    'import.meta.env.NX_PUBLIC_AMPLITUDE_KEY': null,
    // Canvas vite has no `envPrefix`, so inline the DSN explicitly (mirrors the amplitude handling above).
    'import.meta.env.NX_PUBLIC_SENTRY_DSN_CANVAS': JSON.stringify(process.env.NX_PUBLIC_SENTRY_DSN_CANVAS ?? ''),
    'globalThis.__IS_CANVAS_APP__': true,
  },
  test: {
    name: 'jetstream-canvas',
    watch: false,
    globals: true,
    environment: 'jsdom',
    passWithNoTests: true,
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    includeSource: ['src/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/jetstream-canvas',
      provider: 'v8' as const,
    },
  },
}));
