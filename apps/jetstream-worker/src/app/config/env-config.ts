import { ensureBoolean, ensureStringValue } from '@jetstream/shared/utils';
import * as dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  // SYSTEM
  NODE_ENV: process.env.NODE_ENV,
  ENVIRONMENT: process.env.ENVIRONMENT || 'production',
  PORT: process.env.port || 3344,
  GIT_VERSION: process.env.GIT_VERSION,
  ROLLBAR_SERVER_TOKEN: process.env.ROLLBAR_SERVER_TOKEN,
  // JETSTREAM
  JETSTREAM_SERVER_DOMAIN: process.env.JETSTREAM_SERVER_DOMAIN,
  JETSTREAM_SERVER_URL: process.env.JETSTREAM_SERVER_URL,
  JESTREAM_POSTGRES_DBURI: process.env.JESTREAM_POSTGRES_DBURI,
  PRISMA_DEBUG: ensureBoolean(process.env.PRISMA_DEBUG),
  // MAILCHIMP
  MAILCHIMP_USER: process.env.MAILCHIMP_USER,
  MAILCHIMP_API_KEY: process.env.MAILCHIMP_API_KEY,
  MAILCHIMP_AUDIENCE_ID: process.env.MAILCHIMP_AUDIENCE_ID,
  // MAILGUN
  MAILGUN_API_KEY: process.env.MAILGUN_API_KEY,
  MAILGUN_PUBLIC_KEY: process.env.MAILGUN_PUBLIC_KEY,
  MAILGUN_WEBHOOK_KEY: process.env.MAILGUN_WEBHOOK_KEY,
};
