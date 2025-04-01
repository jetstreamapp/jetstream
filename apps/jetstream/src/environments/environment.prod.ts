import { UI_ENV } from '@jetstream/ui/env';

export const environment = {
  name: 'Jetstream',
  production: true,
  sentryDsn: UI_ENV.sentryDsn,
  amplitudeToken: UI_ENV.amplitudeToken,
  STRIPE_PUBLIC_KEY: UI_ENV.STRIPE_PUBLIC_KEY,
  BILLING_ENABLED: UI_ENV.BILLING_ENABLED,
  STRIPE_PRO_ANNUAL_PRICE_ID: UI_ENV.STRIPE_PRO_ANNUAL_PRICE_ID,
  STRIPE_PRO_MONTHLY_PRICE_ID: UI_ENV.STRIPE_PRO_MONTHLY_PRICE_ID,
  isWebExtension: false,
};
