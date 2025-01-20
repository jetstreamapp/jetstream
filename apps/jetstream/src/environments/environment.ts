// This file can be replaced during build by using the `fileReplacements` array.
// When building for production, this file is replaced with `environment.prod.ts`.

export const environment = {
  name: 'JetstreamDev',
  production: false,
  rollbarClientAccessToken: import.meta.env.NX_PUBLIC_ROLLBAR_KEY,
  amplitudeToken: import.meta.env.NX_PUBLIC_AMPLITUDE_KEY,
  STRIPE_PUBLIC_KEY: import.meta.env.NX_PUBLIC_STRIPE_PUBLIC_KEY,
  BILLING_ENABLED: import.meta.env.NX_PUBLIC_BILLING_ENABLED === 'true',
  STRIPE_PRO_ANNUAL_PRICE_ID: import.meta.env.NX_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID,
  STRIPE_PRO_MONTHLY_PRICE_ID: import.meta.env.NX_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID,
  isWebExtension: false,
};
