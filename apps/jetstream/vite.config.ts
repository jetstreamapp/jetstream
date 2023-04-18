/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import dns from 'dns';
import { defineConfig } from 'vite';
import viteTsConfigPaths from 'vite-tsconfig-paths';

dns.setDefaultResultOrder('verbatim');

export default defineConfig({
  cacheDir: '../../node_modules/.vite/jetstream',
  base: './',

  server: {
    port: 4200,
    host: 'localhost',
  },

  preview: {
    port: 4300,
    host: 'localhost',
  },

  build: {
    rollupOptions: {
      output: {
        // FIXME:
        // assetFileNames: 'assets/[name]-[hash][extname]',
        sourcemap: true,
      },
    },
  },

  plugins: [
    react({
      jsxImportSource: '@emotion/react',
      babel: {
        plugins: ['@emotion/babel-plugin'],
      },
    }),
    viteTsConfigPaths({
      root: '../../',
    }),
  ],

  worker: {
    plugins: [
      viteTsConfigPaths({
        root: '../../',
      }),
    ],
  },
});
