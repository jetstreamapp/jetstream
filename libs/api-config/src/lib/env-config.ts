/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { UserProfileSession, UserProfileUiWithIdentities } from '@jetstream/auth/types';
import { ensureBoolean } from '@jetstream/shared/utils';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs-extra';
import { isNumber } from 'lodash';
import { join } from 'path';
import { z } from 'zod';

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
 * an bypass authentication - this is useful for running locally.
 *
 * This user cannot be used outside of localhost regardless of the environment variables.
 */
const EXAMPLE_USER: UserProfileSession = {
  id: '9dcaae05-e76a-41a5-aecb-5c9c79981b7e',
  name: 'Test User',
  email: 'test@example.com',
  emailVerified: true,
  userId: 'test|9dcaae05-e76a-41a5-aecb-5c9c79981b7e',
  authFactors: [],
};

const EXAMPLE_USER_FULL_PROFILE: UserProfileUiWithIdentities = {
  ...EXAMPLE_USER,
  hasPasswordSet: false,
  authFactors: [],
  identities: [],
  picture: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  preferences: {
    skipFrontdoorLogin: false,
    id: '9dcaae05-e76a-41a5-aecb-5c9c79981b7e',
    userId: 'test|TEST_USER_ID',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

/**
 * FIXME: use zod for this schema
 */

const booleanSchema = z.union([z.string(), z.boolean()]).nullish().transform(ensureBoolean);
const numberSchema = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((val) => {
    if (isNumber(val) || !val) {
      return val ?? null;
    }
    return /[0-9]+/.test(val) ? parseInt(val) : null;
  });

export const ENV = z
  .object({
    LOG_LEVEL: z
      .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
      .nullish()
      .transform((value) => value ?? 'debug'),
    IS_CI: booleanSchema,
    // LOCAL OVERRIDE
    EXAMPLE_USER: z.record(z.any()).nullish(),
    EXAMPLE_USER_FULL_PROFILE: z.record(z.any()).nullish(),
    IS_LOCAL_DOCKER: booleanSchema,
    // SYSTEM
    NODE_ENV: z
      .enum(['development', 'test', 'staging', 'production'])
      .nullish()
      .transform((value) => value ?? 'production'),
    ENVIRONMENT: z
      .enum(['development', 'test', 'staging', 'production'])
      .nullish()
      .transform((value) => value ?? 'production'),
    PORT: numberSchema.default(3333),
    GIT_VERSION: z.string().nullish(),
    ROLLBAR_SERVER_TOKEN: z.string().nullish(),
    // JETSTREAM
    JETSTREAM_AUTH_SECRET: z.string().describe('Used to sign authentication cookies.'),
    // Must be 32 characters
    JETSTREAM_AUTH_OTP_SECRET: z.string(),
    JETSTREAM_SERVER_DOMAIN: z.string(),
    JETSTREAM_SESSION_SECRET: z.string(),
    JETSTREAM_SERVER_URL: z.string().url(),
    JETSTREAM_POSTGRES_DBURI: z.string(),
    JETSTREAM_LANDING_URL: z.string(),
    JETSTREAM_CLIENT_URL: z.string(),
    JETSTREAM_WORKER_URL: z.string().url().nullish(),
    PRISMA_DEBUG: booleanSchema,
    COMETD_DEBUG: z.enum(['error', 'warn', 'info', 'debug']).nullish(),
    // AUTH - OAuth2 credentials for logging in via OAuth2
    AUTH_SFDC_CLIENT_ID: z.string().min(1),
    AUTH_SFDC_CLIENT_SECRET: z.string().min(1),
    AUTH_GOOGLE_CLIENT_ID: z.string().min(1),
    AUTH_GOOGLE_CLIENT_SECRET: z.string().min(1),
    /**
     * EMAIL
     * If not set, email will not be sent
     */
    JETSTREAM_EMAIL_DOMAIN: z.string().optional().default('mail@getjetstream.app'),
    JETSTREAM_EMAIL_FROM_NAME: z.string().optional().default('Jetstream Support <support@getjetstream.app>'),
    JETSTREAM_EMAIL_REPLY_TO: z.string().optional().default('support@getjetstream.app'),
    MAILGUN_API_KEY: z.string().nullish(),
    MAILGUN_WEBHOOK_KEY: z.string().nullish(),
    /**
     * Salesforce Org Connections
     * Connected App OAuth2 for connecting orgs
     */
    SFDC_API_VERSION: z.string(),
    SFDC_CONSUMER_SECRET: z.string().min(1),
    SFDC_CONSUMER_KEY: z.string().min(1),
    SFDC_CALLBACK_URL: z.string().url(),
    /**
     * Google OAuth2
     * Allows google drive configuration
     */
    GOOGLE_APP_ID: z.string().nullish(),
    GOOGLE_API_KEY: z.string().nullish(),
    GOOGLE_CLIENT_ID: z.string().nullish(),
    /**
     * HONEYCOMB
     * This is used for logging node application metrics
     */
    HONEYCOMB_ENABLED: booleanSchema,
    HONEYCOMB_API_KEY: z.string().nullish(),
  })
  .parse({
    ...process.env,
    EXAMPLE_USER: ensureBoolean(process.env.EXAMPLE_USER_OVERRIDE) ? EXAMPLE_USER : null,
    EXAMPLE_USER_FULL_PROFILE: ensureBoolean(process.env.EXAMPLE_USER_OVERRIDE) ? EXAMPLE_USER_FULL_PROFILE : null,
    SFDC_API_VERSION: process.env.NX_SFDC_API_VERSION || process.env.SFDC_API_VERSION,
    CLERK_PUBLISHABLE_KEY: process.env.NX_PUBLIC_CLERK_PUBLISHABLE_KEY,
  });
