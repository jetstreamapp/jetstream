// This is the ONLY environment file for the desktop client - `fileReplacements` are NOT applied by
// the @nx/vite build (that is an Angular/Webpack-builder concept), so anything that has to be
// correct per build is derived from `import.meta.env`, which Vite resolves per mode.
//
// `name` deliberately keeps the `JetstreamDev` value production has always shipped — it names the
// local database, so correcting it would strand existing user data. That is also why we do not adopt
// the `replaceFiles` plugin the web extension uses to do a real per-mode swap.

export const environment = {
  name: 'JetstreamDev',
  production: import.meta.env.PROD,
  // TEMPORARILY DISABLED - error tracking is turned off for this app until crash report redaction
  // can guarantee no customer data is included. A null dsn makes `initErrorTracker` a no-op.
  // sentryDsn: import.meta.env.NX_PUBLIC_SENTRY_DSN_DESKTOP,
  sentryDsn: null,
  STRIPE_PUBLIC_KEY: '',
  BILLING_ENABLED: false,
  isWebExtension: false,
};
