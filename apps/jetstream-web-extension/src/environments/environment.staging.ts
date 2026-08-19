export const environment = {
  production: true,
  serverUrl: 'https://staging.jetstream-app.com',
  // TEMPORARILY DISABLED - error tracking is turned off for this app until crash report redaction
  // can guarantee no customer data is included. A null dsn makes `initErrorTracker` a no-op.
  // sentryDsn: import.meta.env.NX_PUBLIC_SENTRY_DSN_EXTENSION,
  sentryDsn: null,
  amplitudeToken: import.meta.env.NX_PUBLIC_AMPLITUDE_KEY,
  isWebExtension: true,
};
