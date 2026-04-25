import type { UserProfileSession, UserProfileUiWithIdentities } from '@jetstream/auth/types';
import { SoqlQueryFormatOptionsSchema, type Maybe } from '@jetstream/types';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs-extra';
import isNumber from 'lodash/isNumber';
import { join } from 'path';
import { z } from 'zod';
import { resolveLogLevel } from './logging-policy';

dotenv.config();

let VERSION = 'unknown';
try {
  VERSION = readFileSync(join(__dirname, '../../VERSION'), 'utf-8').trim();
} catch {
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

function writeEnvConfigWarning(message: string) {
  process.stderr.write(`${message}\n`);
}

/**
 * This object allows for someone to run Jetstream in a local environment
 * an bypass authentication - this is useful for running locally.
 *
 * This user cannot be used outside of localhost regardless of the environment variables.
 */
const EXAMPLE_USER: UserProfileSession = {
  id: 'aaaaaaaa-0000-0000-0000-aaaaaaaaaaaa',
  name: 'Test User',
  email: 'test@example.com',
  emailVerified: true,
  userId: 'test|aaaaaaaa-0000-0000-0000-aaaaaaaaaaaa',
  authFactors: [],
  tosAcceptedVersion: 'test-tos-version',
};

const EXAMPLE_USER_FULL_PROFILE: UserProfileUiWithIdentities = {
  ...EXAMPLE_USER,
  hasPasswordSet: false,
  authFactors: [],
  identities: [],
  picture: null,
  teamMembership: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  preferences: {
    skipFrontdoorLogin: false,
    recordSyncEnabled: false,
    soqlQueryFormatOptions: SoqlQueryFormatOptionsSchema.parse({}),
    id: 'aaaaaaaa-0000-0000-0000-aaaaaaaaaaaa',
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
    .transform((value) =>
      resolveLogLevel({
        logLevel: value,
        environment: process.env.ENVIRONMENT,
        nodeEnv: process.env.NODE_ENV,
      }),
    ),
  PRETTY_LOGS: booleanSchema,
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
      tosAcceptedVersion: z.string().nullish(),
      authFactors: z
        .object({
          type: z.string(),
          enabled: z.boolean(),
        })
        .array(),
    })
    .nullish(),
  EXAMPLE_USER_PASSWORD: z.string().nullish(),
  EXAMPLE_USER_FULL_PROFILE: z.record(z.string(), z.any()).nullish(),
  IS_LOCAL_DOCKER: booleanSchema,
  ENABLE_TEST_ENDPOINTS: booleanSchema,
  DEFERRED_RESPONSE_ENABLED: booleanSchema,
  // Defaults are applied in the middleware (45000ms / 25000ms) since numberSchema transforms undefined → null
  DEFERRED_RESPONSE_THRESHOLD_MS: numberSchema,
  DEFERRED_RESPONSE_KEEPALIVE_MS: numberSchema,
  // SYSTEM
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .optional()
    .transform((value) => value ?? 'production'),
  ENVIRONMENT: z
    .enum(['development', 'production'])
    .optional()
    .transform((value) => value ?? 'production'),
  // Orthogonal to ENVIRONMENT. Use to branch minor logic in deployments that otherwise behave like prod
  // (e.g. staging ≈ production but with small differences). Default is 'production' so existing deploys are unaffected.
  STAGE: z
    .enum(['development', 'staging', 'production'])
    .optional()
    .transform((value) => value ?? 'production'),
  PORT: numberSchema.default(3333),
  // Set based on environment and server url protocol
  USE_SECURE_COOKIES: booleanSchema,
  CAPTCHA_SECRET_KEY: z.string().optional(),
  CAPTCHA_PROPERTY: z.literal('captchaToken').optional().default('captchaToken'),
  VERSION: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  // Kill switch for Sentry reporting (e.g. during staging pen tests). Client bundle reads NX_PUBLIC_DISABLE_ERROR_REPORTING instead.
  // use NX_PUBLIC_DISABLE_ERROR_REPORTING to also disable error reporting in the client (e.g. for staging pen tests) - if either is true, reporting is disabled
  DISABLE_ERROR_REPORTING: booleanSchema,

  // Legacy Auth0 - Used to allow JIT password migration
  AUTH0_CLIENT_ID: z.string().nullish(),
  AUTH0_CLIENT_SECRET: z.string().nullish(),
  AUTH0_DOMAIN: z.string().nullish(),

  // JETSTREAM
  JETSTREAM_AUTH_2FA_EMAIL_DEFAULT_VALUE: z.union([z.string(), z.boolean()]).optional().default(true).transform(ensureBoolean),
  JETSTREAM_AUTH_SECRET: z.string().describe('Used to sign authentication cookies.'),
  // Must be 32 characters
  JETSTREAM_AUTH_OTP_SECRET: z.string(),
  JETSTREAM_AUTH_SSO_SECRET: z.string(),
  JETSTREAM_AUTH_WEB_EXT_JWT_SECRET: z.string().optional().default('DEVELOPMENT_SECRET'),
  JETSTREAM_SESSION_SECRET: z.string(),
  // SSO Configuration
  JETSTREAM_SAML_SP_ENTITY_ID_PREFIX: z.string(),
  JETSTREAM_SAML_ACS_PATH_PREFIX: z.string().default('/api/auth/sso/saml'),
  JETSTREAM_SESSION_SECRET_PREV: z
    .string()
    .optional()
    .transform((val) => val || null),
  JETSTREAM_POSTGRES_DBURI: z.string(),
  JETSTREAM_SERVER_DOMAIN: z.string(),
  JETSTREAM_SERVER_URL: z.url(),
  JETSTREAM_CLIENT_URL: z.string(),
  PRISMA_DEBUG: booleanSchema,
  COMETD_DEBUG: z.enum(['error', 'warn', 'info', 'debug']).optional(),
  // AUTH - OAuth2 credentials for logging in via OAuth2
  AUTH_SFDC_CLIENT_ID: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) {
        writeEnvConfigWarning('AUTH_SFDC_CLIENT_ID is not set - Logging in with Salesforce will not be available');
      }
      return val || '';
    }),
  AUTH_SFDC_CLIENT_SECRET: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) {
        writeEnvConfigWarning('AUTH_SFDC_CLIENT_SECRET is not set - Logging in with Salesforce will not be available');
      }
      return val || '';
    }),
  AUTH_GOOGLE_CLIENT_ID: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) {
        writeEnvConfigWarning('AUTH_GOOGLE_CLIENT_ID is not set - Logging in with Google will not be available');
      }
      return val || '';
    }),
  AUTH_GOOGLE_CLIENT_SECRET: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) {
        writeEnvConfigWarning('AUTH_GOOGLE_CLIENT_SECRET is not set - Logging in with Google will not be available');
      }
      return val || '';
    }),
  // Should be a base64-encoded 32-byte key (generate with: openssl rand -base64 32)
  JWT_ENCRYPTION_KEY: z.string().min(44, {
    error: 'JWT_ENCRYPTION_KEY must be a base64-encoded 32-byte key',
  }),
  /**
   * EMAIL
   * If not set, email will not be sent
   */
  JETSTREAM_EMAIL_DOMAIN: z.string().optional().default(''),
  JETSTREAM_EMAIL_FROM_NAME: z.string().optional().default(''),
  JETSTREAM_EMAIL_REPLY_TO: z.string().optional().default(''),
  MAILGUN_API_KEY: z.string().optional(),
  MAILGUN_WEBHOOK_SIGNING_KEY: z.string().optional(),
  /**
   * Salesforce Org Connections
   * Connected App OAuth2 for connecting orgs
   */
  SFDC_API_VERSION: z.string().regex(/^[0-9]{2,4}\.[0-9]$/),
  SFDC_CONSUMER_SECRET: z.string().min(1),
  SFDC_CONSUMER_KEY: z.string().min(1),
  SFDC_CALLBACK_URL: z.url(),
  // Should be a base64-encoded 32-byte key (generate with: openssl rand -base64 32)
  SFDC_ENCRYPTION_KEY: z.string().min(44, {
    error: 'SFDC_ENCRYPTION_KEY must be a base64-encoded 32-byte key',
  }),
  // Encryption performance tuning
  SFDC_ENCRYPTION_ITERATIONS: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val) : 100_000)),
  SFDC_ENCRYPTION_CACHE_MAX_ENTRIES: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val) : 10_000)),
  SFDC_ENCRYPTION_CACHE_TTL_MS: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val) : 3_600_000)),
  /**
   * Google OAuth2
   * Allows google drive configuration
   */
  GOOGLE_APP_ID: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  /**
   * GEO-IP API (private service basic auth)
   */
  GEO_IP_API_USERNAME: z.string().optional(),
  GEO_IP_API_PASSWORD: z.string().optional(),
  GEO_IP_API_HOSTNAME: z.string().optional(),

  /**
   * Basic auth for internal services
   */
  BASIC_AUTH_USERNAME: z.string().optional(),
  BASIC_AUTH_PASSWORD: z.string().optional(),

  WEB_EXTENSION_ID_CHROME: z.string().optional().default(''),
  WEB_EXTENSION_ID_MOZILLA: z.string().optional().default(''),
  /**
   * STRIPE
   */
  STRIPE_API_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_BILLING_PORTAL_LINK: z.string().optional(),
  /**
   * Desktop App
   * Secret used to derive per-user encryption keys for portable org data encryption.
   * Treat like a signing secret — rotating this invalidates all existing portable-encrypted org files.
   */
  DESKTOP_ORG_ENCRYPTION_SECRET: z.string().min(32, {
    message: 'DESKTOP_ORG_ENCRYPTION_SECRET must be at least 32 characters (generate with: openssl rand -base64 32)',
  }),

  /**
   * BackBlaze B2
   */
  BACKBLAZE_ACCESS_KEY_ID: z.string().default(''),
  BACKBLAZE_SECRET_ACCESS_KEY: z.string().default(''),
  BACKBLAZE_BUCKET_NAME: z.string().default('desktop-updates'),
  BACKBLAZE_REGION: z.string().default('us-east-005'),
});

const parseResults = envSchema.safeParse({
  ...process.env,
  USE_SECURE_COOKIES: ensureBoolean(process.env.ENVIRONMENT === 'production' && process.env.JETSTREAM_SERVER_URL?.startsWith('https')),
  EXAMPLE_USER: ensureBoolean(process.env.EXAMPLE_USER_OVERRIDE) ? EXAMPLE_USER : null,
  EXAMPLE_USER_PASSWORD: ensureBoolean(process.env.EXAMPLE_USER_OVERRIDE) ? process.env.EXAMPLE_USER_PASSWORD : null,
  EXAMPLE_USER_FULL_PROFILE: ensureBoolean(process.env.EXAMPLE_USER_OVERRIDE) ? EXAMPLE_USER_FULL_PROFILE : null,
  SFDC_API_VERSION: process.env.NX_SFDC_API_VERSION || process.env.SFDC_API_VERSION,
  STRIPE_BILLING_PORTAL_LINK: process.env.NX_PUBLIC_STRIPE_BILLING_PORTAL_LINK,
  JETSTREAM_CLIENT_URL: process.env.NX_PUBLIC_CLIENT_URL || process.env.JETSTREAM_CLIENT_URL,
  JETSTREAM_SERVER_URL: process.env.NX_PUBLIC_SERVER_URL || process.env.JETSTREAM_SERVER_URL,
  JETSTREAM_SERVER_DOMAIN: process.env.NX_PUBLIC_SERVER_DOMAIN || process.env.JETSTREAM_SERVER_DOMAIN,
  DISABLE_ERROR_REPORTING: process.env.NX_PUBLIC_DISABLE_ERROR_REPORTING || process.env.DISABLE_ERROR_REPORTING,
  VERSION,
});

if (!parseResults.success) {
  process.stderr.write(`❌ ${chalk.red('Error parsing environment variables:')}
${chalk.yellow(JSON.stringify(z.treeifyError(parseResults.error), null, 2))}
`);
  process.exit(1);
}

export type Env = z.infer<typeof envSchema>;
export const ENV: Env = parseResults.data;
