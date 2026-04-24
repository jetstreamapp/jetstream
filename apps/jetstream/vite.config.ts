/// <reference types="vitest/config" />
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import react from '@vitejs/plugin-react';
import dns from 'dns';
import { readFileSync } from 'fs';
import { join } from 'path';
import { defineConfig } from 'vite';
import { baseHrefPlugin } from './vite.plugins';

dns.setDefaultResultOrder('verbatim');

// Opt-in sourcemap upload to Better Stack / Sentry. Set to 'true' on Render so the
// prod build that actually ships is the one generating & uploading maps — keeps maps
// and bundles perfectly in sync and avoids CI/Render env drift.
let uploadSourcemaps = process.env.UPLOAD_SOURCEMAPS === 'true';
const SENTRY_ORG = process.env.SENTRY_ORG;
const SENTRY_PROJECT = process.env.SENTRY_PROJECT_FRONTEND;
const SENTRY_URL = process.env.SENTRY_URL_FRONTEND;
const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;

if (uploadSourcemaps && !(SENTRY_ORG && SENTRY_PROJECT && SENTRY_URL && SENTRY_AUTH_TOKEN)) {
  console.warn(
    'UPLOAD_SOURCEMAPS is true but SENTRY_ORG, SENTRY_PROJECT_FRONTEND, SENTRY_URL_FRONTEND, or SENTRY_AUTH_TOKEN is missing. Sourcemaps will not be uploaded.',
  );
  uploadSourcemaps = false;
}

// Release name must match the version the running client reports with errors.
// `yarn build` runs `generate:version` before `build:core` so dist/VERSION is readable here.
const releaseName = uploadSourcemaps
  ? (() => {
      try {
        return readFileSync(join(__dirname, '../../dist/VERSION'), 'utf-8').trim();
      } catch {
        return undefined;
      }
    })()
  : undefined;

if (uploadSourcemaps && !releaseName) {
  console.warn('UPLOAD_SOURCEMAPS is true but dist/VERSION is missing or unreadable. Sourcemaps will not be uploaded.');
  uploadSourcemaps = false;
}

export default defineConfig(() => ({
  plugins: [
    react({
      jsxImportSource: '@emotion/react',
      babel: {
        plugins: ['@emotion/babel-plugin'],
      },
    }),
    nxViteTsPaths(),
    baseHrefPlugin(),
    // Sentry plugin must be LAST per docs. Reads SENTRY_AUTH_TOKEN / SENTRY_ORG /
    // SENTRY_PROJECT / SENTRY_URL from env automatically.
    ...(uploadSourcemaps
      ? [
          sentryVitePlugin({
            org: SENTRY_ORG,
            project: SENTRY_PROJECT,
            url: SENTRY_URL,
            authToken: SENTRY_AUTH_TOKEN,
            release: { name: releaseName },
            sourcemaps: { filesToDeleteAfterUpload: ['./dist/apps/jetstream/**/*.map'] },
            telemetry: false,
          }),
        ]
      : []),
  ],

  worker: {
    plugins: () => [nxViteTsPaths()],
  },
  root: __dirname,
  cacheDir: '../../node_modules/.vite/jetstream',
  envPrefix: 'NX',

  server: {
    port: 4200,
    host: 'localhost',
    fs: {
      allow: ['..'],
    },
  },
  base: './',
  build: {
    outDir: '../../dist/apps/jetstream',
    reportCompressedSize: true,
    commonjsOptions: { transformMixedEsModules: true },
    // Put all assets at the root of the app instead of under /assets
    assetsDir: './',
    sourcemap: uploadSourcemaps ? ('hidden' as const) : false,
    emptyOutDir: true,
    rollupOptions: {},
  },
  test: {
    name: 'jetstream',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    passWithNoTests: true,
    coverage: {
      reportsDirectory: '../../coverage/apps/jetstream',
      provider: 'v8' as const,
    },
  },
}));
