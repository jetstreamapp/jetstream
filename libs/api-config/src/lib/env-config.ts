import { ensureBoolean, ensureStringValue } from '@jetstream/shared/utils';
import { UserProfileServer } from '@jetstream/types';
import * as dotenv from 'dotenv';
dotenv.config();

/**
 * This object allows for someone to run Jetstream in a local environment
 * without having to authenticate with a real account.
 */
const TEST_USER: UserProfileServer = {
  _json: {
    sub: 'TEST_USER',
    nickname: 'Jetstream',
    name: 'Jetstream Test',
    picture: null,
    updated_at: '2022-06-18T16:27:37.491Z',
    email: 'test@example.com',
    email_verified: true,
    'http://getjetstream.app/app_metadata': {
      featureFlags: { flagVersion: 'V1.4', flags: ['all'], isDefault: false },
    },
  },
  _raw: null,
  id: 'TEST_USER',
  displayName: 'Jetstream Test',
  emails: [],
  name: 'Jetstream Test',
  nickname: 'Jetstream',
  picture: null,
  provider: 'auth0',
  user_id: 'TEST_USER',
};

export const ENV = {
  // LOCAL OVERRIDE
  TEST_USER_OVERRIDE: ensureBoolean(process.env.TEST_USER_OVERRIDE),
  TEST_USER: process.env.TEST_USER_OVERRIDE ? TEST_USER : null,
  // SYSTEM
  NODE_ENV: process.env.NODE_ENV,
  ENVIRONMENT: process.env.ENVIRONMENT || 'production',
  PORT: process.env.port || 3333,
  GIT_VERSION: process.env.GIT_VERSION,
  ROLLBAR_SERVER_TOKEN: process.env.ROLLBAR_SERVER_TOKEN,
  // JETSTREAM
  JETSTREAM_SERVER_DOMAIN: process.env.JETSTREAM_SERVER_DOMAIN,
  JESTREAM_SESSION_SECRET: process.env.JESTREAM_SESSION_SECRET,
  JETSTREAM_SERVER_URL: process.env.JETSTREAM_SERVER_URL,
  JESTREAM_POSTGRES_DBURI: process.env.JESTREAM_POSTGRES_DBURI,
  JETSTREAM_CLIENT_URL: process.env.JETSTREAM_CLIENT_URL,
  JETSTREAM_WORKER_URL: process.env.JETSTREAM_WORKER_URL,
  PRISMA_DEBUG: ensureBoolean(process.env.PRISMA_DEBUG),
  COMETD_DEBUG: ensureStringValue(process.env.COMETD_DEBUG, ['error', 'warn', 'info', 'debug']) as 'error' | 'warn' | 'info' | 'debug',
  // AUTH
  AUTH0_DOMAIN: process.env.AUTH0_DOMAIN,
  /** use for M2M tokens - in DEV this is the same, but different in production */
  AUTH0_M2M_DOMAIN: process.env.AUTH0_M2M_DOMAIN,
  AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
  AUTH0_MGMT_CLIENT_ID: process.env.AUTH0_MGMT_CLIENT_ID,
  AUTH0_MGMT_CLIENT_SECRET: process.env.AUTH0_MGMT_CLIENT_SECRET,
  AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET,
  // MAILGUN
  MAILGUN_API_KEY: process.env.MAILGUN_API_KEY,
  MAILGUN_PUBLIC_KEY: process.env.MAILGUN_PUBLIC_KEY,
  MAILGUN_WEBHOOK_KEY: process.env.MAILGUN_WEBHOOK_KEY,
  // SFDC
  SFDC_FALLBACK_API_VERSION: process.env.NX_SFDC_API_VERSION || process.env.SFDC_FALLBACK_API_VERSION,
  SFDC_CONSUMER_SECRET: process.env.SFDC_CONSUMER_SECRET,
  SFDC_CONSUMER_KEY: process.env.SFDC_CONSUMER_KEY,
  SFDC_CALLBACK_URL: process.env.SFDC_CALLBACK_URL,
  // GOOGLE
  GOOGLE_APP_ID: process.env.GOOGLE_APP_ID,
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  // GITHUB
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  // HONEYCOMB
  HONEYCOMB_ENABLED: ensureBoolean(process.env.HONEYCOMB_ENABLED),
  HONEYCOMB_API_KEY: process.env.HONEYCOMB_API_KEY,
  AUTH_AUDIENCE: process.env.NX_AUTH_AUDIENCE,
};
