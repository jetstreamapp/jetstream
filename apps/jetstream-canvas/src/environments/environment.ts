// This is the ONLY environment file for canvas - `fileReplacements` are NOT applied by the @nx/vite
// build (that is an Angular/Webpack-builder concept), so anything that has to be correct per build
// is derived from `import.meta.env`, which Vite resolves per mode.
//
// `serverUrl` deliberately keeps the value production has always shipped: canvas serves every API
// call from its own in-page router (`src/controllers/canvas.routes.ts`), so nothing dials this
// origin, and changing it now would change what already ships. That is also why we do not adopt the
// `replaceFiles` plugin the web extension uses to do a real per-mode swap.

export const environment = {
  production: import.meta.env.PROD,
  serverUrl: 'http://localhost:3333',
  // TEMPORARILY DISABLED - error tracking is turned off for this app until crash report redaction
  // can guarantee no customer data is included. A null dsn makes `initErrorTracker` a no-op.
  // sentryDsn: import.meta.env.NX_PUBLIC_SENTRY_DSN_CANVAS,
  sentryDsn: null,
  amplitudeToken: null,
  isWebExtension: false,
};
