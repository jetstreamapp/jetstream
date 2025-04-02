// This file can be replaced during build by using the `fileReplacements` array.
// When building for production, this file is replaced with `environment.prod.ts`.

export const environment = {
  production: false,
  serverUrl: 'http://localhost:3333',
  sentryDsn: process.env.NX_PUBLIC_SENTRY_DSN,
  amplitudeToken: process.env.NX_PUBLIC_AMPLITUDE_KEY,
  isWebExtension: true,
};
