// This file can be replaced during build by using the `fileReplacements` array.
// When building for production, this file is replaced with `environment.prod.ts`.

export const environment = {
  production: false,
  serverUrl: 'http://localhost:3333',
  // TEMPORARILY DISABLED - error tracking is turned off for this app until crash report redaction
  // can guarantee no customer data is included. A null dsn makes `initErrorTracker` a no-op.
  // sentryDsn: import.meta.env.NX_PUBLIC_SENTRY_DSN_EXTENSION,
  sentryDsn: null,
  amplitudeToken: import.meta.env.NX_PUBLIC_AMPLITUDE_KEY,
  isWebExtension: true,
};
