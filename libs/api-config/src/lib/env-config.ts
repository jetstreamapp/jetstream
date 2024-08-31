/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ensureBoolean } from '@jetstream/shared/utils';
import { UserProfileServer } from '@jetstream/types';
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
 * without having to authenticate with a real account.
 */
const EXAMPLE_USER: UserProfileServer = {
  id: 'EXAMPLE_USER',
  firstName: 'Jetstream',
  lastName: 'Mock',
  fullName: 'Jetstream Mock',
  username: 'test@getjetstream.app',
  primaryEmailAddress: 'test@getjetstream.app',
  emailAddresses: ['test@getjetstream.app'],
  hasVerifiedEmailAddress: true,
  publicMetadata: null,
  unsafeMetadata: null,
  privateMetadata: null,
  lastSignInAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

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
    LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).nullish().default('debug'),
    IS_CI: booleanSchema,
    // LOCAL OVERRIDE
    EXAMPLE_USER_OVERRIDE: booleanSchema,
    EXAMPLE_USER: z.record(z.any()).nullish(),
    IS_LOCAL_DOCKER: booleanSchema,
    // SYSTEM
    NODE_ENV: z.string().nullish().default('production'),
    ENVIRONMENT: z.string().nullish().default('production'),
    PORT: numberSchema.default(3333),
    GIT_VERSION: z.string().nullish(),
    ROLLBAR_SERVER_TOKEN: z.string().nullish(),
    // JETSTREAM
    JETSTREAM_SERVER_DOMAIN: z.string(),
    JETSTREAM_SESSION_SECRET: z.string(),
    JETSTREAM_SERVER_URL: z.string().url(),
    JETSTREAM_POSTGRES_DBURI: z.string(),
    JETSTREAM_CLIENT_URL: z.string().url(),
    JETSTREAM_WORKER_URL: z.string().url().nullish(),
    PRISMA_DEBUG: booleanSchema,
    COMETD_DEBUG: z.enum(['error', 'warn', 'info', 'debug']).nullish(),
    // AUTH
    // TODO: optional for dev mode?
    CLERK_SECRET_KEY: z.string(),
    CLERK_PUBLISHABLE_KEY: z.string(),
    CLERK_JWT_KEY: z.string(),
    CLERK_WEBHOOK_SECRET: z.string(),
    // MAILGUN
    MAILGUN_API_KEY: z.string().nullish(),
    MAILGUN_PUBLIC_KEY: z.string().nullish(),
    MAILGUN_WEBHOOK_KEY: z.string().nullish(),
    // SFDC
    SFDC_API_VERSION: z.string().default('61.0'),
    SFDC_CONSUMER_SECRET: z.string(),
    SFDC_CONSUMER_KEY: z.string(),
    SFDC_CALLBACK_URL: z.string().url(),
    // GOOGLE
    GOOGLE_APP_ID: z.string().nullish(),
    GOOGLE_API_KEY: z.string().nullish(),
    GOOGLE_CLIENT_ID: z.string().nullish(),
    // GITHUB
    GITHUB_TOKEN: z.string().nullish(),
    // HONEYCOMB
    HONEYCOMB_ENABLED: booleanSchema,
    HONEYCOMB_API_KEY: z.string().nullish(),
    AUTH_AUDIENCE: z.string().nullish(),
  })
  .parse({
    ...process.env,
    EXAMPLE_USER: process.env.EXAMPLE_USER_OVERRIDE ? EXAMPLE_USER : null,
    SFDC_API_VERSION: process.env.NX_SFDC_API_VERSION || process.env.SFDC_API_VERSION,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN || process.env.GH_TOKEN,
    AUTH_AUDIENCE: process.env.NX_PUBLIC_AUTH_AUDIENCE,
    CLERK_PUBLISHABLE_KEY: process.env.NX_PUBLIC_CLERK_PUBLISHABLE_KEY,
  });
