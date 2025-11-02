// This file can be replaced during build by using the `fileReplacements` array.
// When building for production, this file is replaced with `environment.prod.ts`.

export const environment = {
  name: 'JetstreamDev',
  production: false,
  googleAnalyticsSiteId: import.meta.env.NX_GOOGLE_ANALYTICS_KEY || '',
  rollbarClientAccessToken: import.meta.env.NX_PUBLIC_ROLLBAR_KEY,
  amplitudeToken: import.meta.env.NX_PUBLIC_AMPLITUDE_KEY,
  STRIPE_PUBLIC_KEY: import.meta.env.NX_PUBLIC_STRIPE_PUBLIC_KEY,
  BILLING_ENABLED: import.meta.env.NX_PUBLIC_BILLING_ENABLED === 'true',
  isWebExtension: false,
};
