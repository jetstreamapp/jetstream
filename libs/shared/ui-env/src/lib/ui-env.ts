export const UI_ENV = {
  sentryDsn: import.meta.env.NX_PUBLIC_SENTRY_DSN as string | undefined,
  amplitudeToken: import.meta.env.NX_PUBLIC_AMPLITUDE_KEY as string | undefined,
  STRIPE_PUBLIC_KEY: import.meta.env.NX_PUBLIC_STRIPE_PUBLIC_KEY,
  BILLING_ENABLED: import.meta.env.NX_PUBLIC_BILLING_ENABLED === 'true',
  STRIPE_PRO_ANNUAL_PRICE_ID: import.meta.env.NX_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID,
  STRIPE_PRO_MONTHLY_PRICE_ID: import.meta.env.NX_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID,
};
