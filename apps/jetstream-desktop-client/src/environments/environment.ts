// This file can be replaced during build by using the `fileReplacements` array.
// When building for production, this file is replaced with `environment.prod.ts`.

export const environment = {
  name: 'JetstreamDev',
  production: false,
  sentryDsn: import.meta.env.NX_PUBLIC_SENTRY_DSN,
  amplitudeToken: undefined,
  STRIPE_PUBLIC_KEY: '',
  BILLING_ENABLED: false,
  isWebExtension: false,
};
