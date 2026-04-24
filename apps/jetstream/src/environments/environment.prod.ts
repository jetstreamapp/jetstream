export const environment = {
  name: 'Jetstream',
  production: true,
  serverUrl: import.meta.env.NX_PUBLIC_SERVER_URL || window.location.origin,
  sentryDsn: import.meta.env.NX_PUBLIC_SENTRY_DSN,
  amplitudeToken: import.meta.env.NX_PUBLIC_AMPLITUDE_KEY,
  STRIPE_PUBLIC_KEY: import.meta.env.NX_PUBLIC_STRIPE_PUBLIC_KEY,
  BILLING_ENABLED: import.meta.env.NX_PUBLIC_BILLING_ENABLED === 'true',
  isWebExtension: false,
};
