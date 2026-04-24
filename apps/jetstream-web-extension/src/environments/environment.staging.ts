export const environment = {
  production: true,
  serverUrl: 'https://staging.jetstream-app.com',
  sentryDsn: import.meta.env.NX_PUBLIC_SENTRY_DSN,
  amplitudeToken: import.meta.env.NX_PUBLIC_AMPLITUDE_KEY,
  isWebExtension: true,
};
