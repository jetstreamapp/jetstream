/// <reference types="vitest/config" />
import { nxReadySignal } from '@nx/vite/plugins/nx-ready-signal.plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const ADMIN_API_URL = process.env.ADMIN_API_URL ?? 'http://localhost:3335';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/admin',
  base: '/',
  server: {
    port: 4203,
    host: 'localhost',
    strictPort: true,
    proxy: {
      '/api': { target: ADMIN_API_URL, changeOrigin: false },
      '/auth': { target: ADMIN_API_URL, changeOrigin: false },
    },
    fs: {
      allow: ['../../'],
    },
  },
  preview: {
    port: 4203,
    host: 'localhost',
  },
  plugins: [react(), nxReadySignal()],
  resolve: { tsconfigPaths: true },
  build: {
    outDir: '../../dist/apps/admin',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  define: {
    'import.meta.vitest': undefined,
  },
  test: {
    name: 'admin',
    watch: false,
    globals: true,
    environment: 'jsdom',
    passWithNoTests: true,
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/admin',
      provider: 'v8' as const,
    },
  },
}));
