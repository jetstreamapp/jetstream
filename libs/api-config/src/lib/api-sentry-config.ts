import * as Sentry from '@sentry/node';
import { ENV } from './env-config';

Sentry.init({
  dsn: ENV.SENTRY_DSN,
  release: ENV.VERSION,
  environment: ENV.ENVIRONMENT,
});

export const sentryServer = Sentry;
