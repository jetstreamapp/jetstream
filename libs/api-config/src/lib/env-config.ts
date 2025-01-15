/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { UserProfileSession, UserProfileUiWithIdentities } from '@jetstream/auth/types';
import type { Maybe } from '@jetstream/types';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs-extra';
import { isNumber } from 'lodash';
import { join } from 'path';
import { z } from 'zod';

dotenv.config();

let VERSION = 'unknown';
try {
  VERSION = readFileSync(join(__dirname, '../../VERSION'), 'utf-8').trim();
} catch (ex) {
  // ignore errors
}

function ensureBoolean(value: Maybe<string | boolean>): boolean {
  if (typeof value === 'boolean') {
    return value;
  } else if (typeof value === 'string') {
    return value.toLowerCase().startsWith('t');
  }
  return false;
}

/**
 * This object allows for someone to run Jetstream in a local environment
 * an bypass authentication - this is useful for running locally.
 *
 * This user cannot be used outside of localhost regardless of the environment variables.
 */
const EXAMPLE_USER: UserProfileSession = {
  id: 'AAAAAAAA-0000-0000-0000-AAAAAAAAAAAA',
  name: 'Test User',
  email: 'test@example.com',
  emailVerified: true,
  userId: 'test|AAAAAAAA-0000-0000-0000-AAAAAAAAAAAA',
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
    id: 'AAAAAAAA-0000-0000-0000-AAAAAAAAAAAA',
    userId: 'test|TEST_USER_ID',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

const booleanSchema = z.union([z.string(), z.boolean()]).optional().transform(ensureBoolean);
const numberSchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((val) => {
    if (isNumber(val) || !val) {
      return val ?? null;
    }
    return /[0-9]+/.test(val) ? parseInt(val) : null;
  });

const envSchema = z.object({
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
    .optional()
    .transform((value) => value ?? 'debug'),
  CI: booleanSchema,
  // LOCAL OVERRIDE
  // EXAMPLE_USER: z.record(z.any()).optional(),
  EXAMPLE_USER: z
    .object({
      id: z.string(),
      userId: z.string(),
      name: z.string(),
      email: z.string(),
      emailVerified: z.boolean(),
      authFactors: z
        .object({
          type: z.string(),
          enabled: z.boolean(),
        })
        .array(),
    })
    .nullish(),
  EXAMPLE_USER_PASSWORD: z.string().nullish(),
  EXAMPLE_USER_FULL_PROFILE: z.record(z.any()).nullish(),
  IS_LOCAL_DOCKER: booleanSchema,
  // SYSTEM
  NODE_ENV: z
    .enum(['development', 'test', 'staging', 'production'])
    .optional()
    .transform((value) => value ?? 'production'),
  ENVIRONMENT: z
    .enum(['development', 'test', 'staging', 'production'])
    .optional()
    .transform((value) => value ?? 'production'),
  PORT: numberSchema.default(3333),
  // Set based on environment and server url protocol
  USE_SECURE_COOKIES: booleanSchema,
  CAPTCHA_SECRET_KEY: z.string().optional(),
  CAPTCHA_PROPERTY: z.literal('captchaToken').optional().default('captchaToken'),
  IP_API_KEY: z.string().optional().describe('API Key used to get location information from IP address'),
  IP_API_SERVICE: z.enum(['IP-API', 'LOCAL']).optional().describe('API Key used to get location information from IP address'),
  VERSION: z.string().optional(),
  ROLLBAR_SERVER_TOKEN: z.string().optional(),

  // Legacy Auth0 - Used to allow JIT password migration
  AUTH0_CLIENT_ID: z.string().nullish(),
  AUTH0_CLIENT_SECRET: z.string().nullish(),
  AUTH0_DOMAIN: z.string().nullish(),

  // JETSTREAM
  JETSTREAM_AUTH_2FA_EMAIL_DEFAULT_VALUE: z.union([z.string(), z.boolean()]).optional().default(true).transform(ensureBoolean),
  JETSTREAM_AUTH_SECRET: z.string().describe('Used to sign authentication cookies.'),
  // Must be 32 characters
  JETSTREAM_AUTH_OTP_SECRET: z.string(),
  JETSTREAM_SESSION_SECRET: z.string(),
  JETSTREAM_SESSION_SECRET_PREV: z
    .string()
    .optional()
    .transform((val) => val || null),
  JETSTREAM_POSTGRES_DBURI: z.string(),
  JETSTREAM_SERVER_DOMAIN: z.string(),
  JETSTREAM_SERVER_URL: z.string().url(),
  JETSTREAM_CLIENT_URL: z.string(),
  PRISMA_DEBUG: booleanSchema,
  COMETD_DEBUG: z.enum(['error', 'warn', 'info', 'debug']).optional(),
  // AUTH - OAuth2 credentials for logging in via OAuth2
  AUTH_SFDC_CLIENT_ID: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) {
        console.warn('AUTH_SFDC_CLIENT_ID is not set - Logging in with Salesforce will not be available');
      }
      return val || '';
    }),
  AUTH_SFDC_CLIENT_SECRET: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) {
        console.warn('AUTH_SFDC_CLIENT_SECRET is not set - Logging in with Salesforce will not be available');
      }
      return val || '';
    }),
  AUTH_GOOGLE_CLIENT_ID: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) {
        console.warn('AUTH_GOOGLE_CLIENT_ID is not set - Logging in with Google will not be available');
      }
      return val || '';
    }),
  AUTH_GOOGLE_CLIENT_SECRET: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) {
        console.warn('AUTH_GOOGLE_CLIENT_SECRET is not set - Logging in with Google will not be available');
      }
      return val || '';
    }),
  /**
   * EMAIL
   * If not set, email will not be sent
   */
  JETSTREAM_EMAIL_DOMAIN: z.string().optional().default('mail@getjetstream.app'),
  JETSTREAM_EMAIL_FROM_NAME: z.string().optional().default('Jetstream Support <support@getjetstream.app>'),
  JETSTREAM_EMAIL_REPLY_TO: z.string().optional().default('support@getjetstream.app'),
  MAILGUN_API_KEY: z.string().optional(),
  MAILGUN_WEBHOOK_KEY: z.string().optional(),
  /**
   * Salesforce Org Connections
   * Connected App OAuth2 for connecting orgs
   */
  SFDC_API_VERSION: z.string().regex(/^[0-9]{2,4}\.[0-9]$/),
  SFDC_CONSUMER_SECRET: z.string().min(1),
  SFDC_CONSUMER_KEY: z.string().min(1),
  SFDC_CALLBACK_URL: z.string().url(),
  /**
   * Google OAuth2
   * Allows google drive configuration
   */
  GOOGLE_APP_ID: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  /**
   * HONEYCOMB
   * This is used for logging node application metrics
   */
  HONEYCOMB_ENABLED: booleanSchema,
  HONEYCOMB_API_KEY: z.string().optional(),
  /**
   * GEO-IP API (private service basic auth)
   */
  GEO_IP_API_USERNAME: z.string().optional(),
  GEO_IP_API_PASSWORD: z.string().optional(),
  GEO_IP_API_HOSTNAME: z.string().optional(),
  /**
   * STRIPE
   */
  STRIPE_API_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_ANNUAL_PRICE_ID: z.string().optional(),
  STRIPE_MONTHLY_PRICE_ID: z.string().optional(),
});

const parseResults = envSchema.safeParse({
  ...process.env,
  USE_SECURE_COOKIES: ensureBoolean(process.env.ENVIRONMENT === 'production' && process.env.JETSTREAM_SERVER_URL?.startsWith('https')),
  EXAMPLE_USER: ensureBoolean(process.env.EXAMPLE_USER_OVERRIDE) ? EXAMPLE_USER : null,
  EXAMPLE_USER_PASSWORD: ensureBoolean(process.env.EXAMPLE_USER_OVERRIDE) ? process.env.EXAMPLE_USER_PASSWORD : null,
  EXAMPLE_USER_FULL_PROFILE: ensureBoolean(process.env.EXAMPLE_USER_OVERRIDE) ? EXAMPLE_USER_FULL_PROFILE : null,
  SFDC_API_VERSION: process.env.NX_SFDC_API_VERSION || process.env.SFDC_API_VERSION,
  STRIPE_ANNUAL_PRICE_ID: process.env.NX_PUBLIC_STRIPE_ANNUAL_PRICE_ID,
  STRIPE_MONTHLY_PRICE_ID: process.env.NX_PUBLIC_STRIPE_MONTHLY_PRICE_ID,
  VERSION,
});

if (!parseResults.success) {
  console.error(`❌ ${chalk.red('Error parsing environment variables:')}
${chalk.yellow(JSON.stringify(parseResults.error.flatten().fieldErrors, null, 2))}
`);
  process.exit(1);
}

export type Env = z.infer<typeof envSchema>;
export const ENV: Env = parseResults.data;
