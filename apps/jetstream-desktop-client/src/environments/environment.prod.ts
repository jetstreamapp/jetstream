export const environment = {
  name: 'Jetstream',
  production: true,
  sentryDsn: import.meta.env.NX_PUBLIC_SENTRY_DSN,
  amplitudeToken: null,
  STRIPE_PUBLIC_KEY: null,
  BILLING_ENABLED: false,
  isWebExtension: false,
};
