/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ensureBoolean, ensureStringValue } from '@jetstream/shared/utils';
import { UserProfileServer, UserProfileUi } from '@jetstream/types';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs-extra';
import { join } from 'path';
dotenv.config();

let VERSION = 'unknown';
try {
  VERSION = readFileSync(join(__dirname, '../../VERSION'), 'utf-8').trim();
  console.warn(`APP VERSION ${VERSION}`);
} catch (ex) {
  console.warn('COULD NOT READ VERSION FILE', ex.message);
}

/**
 * This object allows for someone to run Jetstream in a local environment
 * without having to authenticate with a real account.
 */
const EXAMPLE_USER: UserProfileServer = {
  _json: {
    sub: 'EXAMPLE_USER',
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
  id: 'EXAMPLE_USER',
  displayName: 'Jetstream Test',
  emails: [],
  name: 'Jetstream Test',
  nickname: 'Jetstream',
  picture: null,
  provider: 'auth0',
  user_id: 'EXAMPLE_USER',
};

const EXAMPLE_USER_PROFILE: UserProfileUi = {
  ...EXAMPLE_USER._json,
  id: 'EXAMPLE_USER',
  userId: 'EXAMPLE_USER',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  preferences: { skipFrontdoorLogin: false },
};

export const ENV = {
  LOG_LEVEL: (process.env.LOG_LEVEL || 'debug') as 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent',
  IS_CI: ensureBoolean(process.env.CI),
  // LOCAL OVERRIDE
  EXAMPLE_USER_OVERRIDE: ensureBoolean(process.env.EXAMPLE_USER_OVERRIDE),
  EXAMPLE_USER: process.env.EXAMPLE_USER_OVERRIDE ? EXAMPLE_USER : null,
  EXAMPLE_USER_PROFILE: process.env.EXAMPLE_USER_OVERRIDE ? EXAMPLE_USER_PROFILE : null,
  IS_LOCAL_DOCKER: process.env.IS_LOCAL_DOCKER || false,
  // SYSTEM
  NODE_ENV: process.env.NODE_ENV,
  ENVIRONMENT: process.env.ENVIRONMENT || 'production',
  PORT: process.env.port || 3333,
  GIT_VERSION: VERSION,
  ROLLBAR_SERVER_TOKEN: process.env.ROLLBAR_SERVER_TOKEN,
  // JETSTREAM
  JETSTREAM_SERVER_DOMAIN: process.env.JETSTREAM_SERVER_DOMAIN,
  // FIXME: there was a typo in env variables, using both temporarily as a safe fallback
  JETSTREAM_SESSION_SECRET: process.env.JETSTREAM_SESSION_SECRET || '',
  JETSTREAM_SERVER_URL: process.env.JETSTREAM_SERVER_URL,
  // FIXME: there was a typo in env variables, using both temporarily as a safe fallback
  JETSTREAM_POSTGRES_DBURI: process.env.JETSTREAM_POSTGRES_DBURI,
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
  SFDC_API_VERSION: process.env.NX_SFDC_API_VERSION || process.env.SFDC_API_VERSION || '58.0',
  SFDC_CONSUMER_SECRET: process.env.SFDC_CONSUMER_SECRET!,
  SFDC_CONSUMER_KEY: process.env.SFDC_CONSUMER_KEY!,
  SFDC_CALLBACK_URL: process.env.SFDC_CALLBACK_URL!,
  // GOOGLE
  GOOGLE_APP_ID: process.env.GOOGLE_APP_ID,
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  // GITHUB
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || process.env.GH_TOKEN,
  // HONEYCOMB
  HONEYCOMB_ENABLED: ensureBoolean(process.env.HONEYCOMB_ENABLED),
  HONEYCOMB_API_KEY: process.env.HONEYCOMB_API_KEY,
  AUTH_AUDIENCE: process.env.NX_PUBLIC_AUTH_AUDIENCE,
};
