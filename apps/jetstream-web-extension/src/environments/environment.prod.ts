export const environment = {
  production: true,
  serverUrl: 'https://getjetstream.app',
  sentryDsn: import.meta.env.NX_PUBLIC_SENTRY_DSN,
  amplitudeToken: import.meta.env.NX_PUBLIC_AMPLITUDE_KEY,
  isWebExtension: true,
};
