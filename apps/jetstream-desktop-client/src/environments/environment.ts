// This file can be replaced during build by using the `fileReplacements` array.
// When building for production, this file is replaced with `environment.prod.ts`.

export const environment = {
  name: 'JetstreamDev',
  production: false,
  // FIXME: we do want these in
  rollbarClientAccessToken: undefined,
  amplitudeToken: undefined,
  STRIPE_PUBLIC_KEY: '',
  BILLING_ENABLED: false,
  isWebExtension: false,
};
