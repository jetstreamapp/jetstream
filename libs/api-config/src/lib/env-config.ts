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
// Validates a base64-encoded 32-byte key (AES-256). Decodes and checks the byte length so a
// misconfigured key (invalid base64 or wrong decoded size) fails fast at startup rather than at
// runtime inside encryptString/decryptString.
const base64Key32Schema = (envVarName: string) =>
  z.string().refine((value) => Buffer.from(value, 'base64').length === 32, {
    error: `${envVarName} must be a base64-encoded 32-byte key (generate with: openssl rand -base64 32)`,
  });
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
  // Signing secret used as a passphrase (CSRF tokens, auth cookies) - generate with: openssl rand -base64 32
  JETSTREAM_AUTH_SECRET: z
    .string()
    .min(32, { message: 'JETSTREAM_AUTH_SECRET must be at least 32 characters' })
    .describe('Used to sign authentication cookies.'),
  // Base64-encoded 32-byte key - decoded to exactly 32 bytes for AES-256 (see encryptString). Generate with: openssl rand -base64 32
  JETSTREAM_AUTH_OTP_SECRET: base64Key32Schema('JETSTREAM_AUTH_OTP_SECRET'),
  // Signing secret used as a passphrase (hashed with sha256 before use) - generate with: openssl rand -base64 32
  JETSTREAM_AUTH_SSO_SECRET: z.string().min(32, { message: 'JETSTREAM_AUTH_SSO_SECRET must be at least 32 characters' }),
  // HMAC (HS256) signing key for browser-extension/desktop JWTs. Keeps a dev default for local DX
  // (empty/unset falls back to the default, e.g. a hand-copied .env.example); the production guard
  // below rejects this default so it can never silently run in production.
  JETSTREAM_AUTH_WEB_EXT_JWT_SECRET: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z
      .string()
      .min(32, { message: 'JETSTREAM_AUTH_WEB_EXT_JWT_SECRET must be at least 32 characters' })
      .optional()
      .default('DEVELOPMENT_SECRET'),
  ),
  JETSTREAM_SESSION_SECRET: z.string().min(32, { message: 'JETSTREAM_SESSION_SECRET must be at least 32 characters' }),
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
  // Used directly as the AES-256 key in encryptString (generate with: openssl rand -base64 32)
  JWT_ENCRYPTION_KEY: base64Key32Schema('JWT_ENCRYPTION_KEY'),
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
   * S3-compatible object storage for desktop release artifacts (Cloudflare R2).
   * Standard AWS_* names are auto-detected by the AWS SDK/CLI and S3-compatible tooling.
   */
  AWS_ACCESS_KEY_ID: z.string().default(''),
  AWS_SECRET_ACCESS_KEY: z.string().default(''),
  AWS_ENDPOINT_URL: z.string().default(''),
  AWS_REGION: z.string().default('auto'),
  S3_BUCKET_NAME: z.string().default('desktop-updates'),
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

/**
 * Consolidated production guard for signing/encryption secrets.
 *
 * Length/entropy floors are enforced by the zod schema above for all environments. This guard adds the
 * production-only checks that would otherwise break local dev and CI: it rejects known dev-default
 * placeholders so a deployment can never silently run on a public constant (e.g. the
 * JETSTREAM_AUTH_WEB_EXT_JWT_SECRET 'DEVELOPMENT_SECRET' fallback that signs all browser-extension/desktop JWTs).
 *
 * Production is detected the same way as the rest of this file: ENVIRONMENT === 'production'. The exemption is
 * keyed on the env.CI flag (i.e. CI=true): CI runs do not set ENVIRONMENT (so it defaults to 'production') yet
 * legitimately rely on dev defaults, so without this exemption the guard would fail every CI run.
 */
function assertProductionSecretsAreSafe(env: Env) {
  const isProduction = env.ENVIRONMENT === 'production' && !env.CI;
  if (!isProduction) {
    return;
  }

  const KNOWN_PLACEHOLDER_SECRETS = new Set(['DEVELOPMENT_SECRET', 'changeme', 'secret', 'test', '']);

  const secretsToValidate: Array<{ name: string; value: string }> = [
    { name: 'JETSTREAM_AUTH_SECRET', value: env.JETSTREAM_AUTH_SECRET },
    { name: 'JETSTREAM_AUTH_OTP_SECRET', value: env.JETSTREAM_AUTH_OTP_SECRET },
    { name: 'JETSTREAM_AUTH_SSO_SECRET', value: env.JETSTREAM_AUTH_SSO_SECRET },
    { name: 'JETSTREAM_AUTH_WEB_EXT_JWT_SECRET', value: env.JETSTREAM_AUTH_WEB_EXT_JWT_SECRET },
    { name: 'JETSTREAM_SESSION_SECRET', value: env.JETSTREAM_SESSION_SECRET },
    { name: 'JWT_ENCRYPTION_KEY', value: env.JWT_ENCRYPTION_KEY },
    { name: 'SFDC_ENCRYPTION_KEY', value: env.SFDC_ENCRYPTION_KEY },
    { name: 'DESKTOP_ORG_ENCRYPTION_SECRET', value: env.DESKTOP_ORG_ENCRYPTION_SECRET },
  ];

  const insecureSecrets = secretsToValidate.filter(({ value }) => KNOWN_PLACEHOLDER_SECRETS.has(value.trim()));

  if (insecureSecrets.length > 0) {
    process.stderr.write(
      `❌ ${chalk.red('Insecure secrets detected in production:')}\n` +
        insecureSecrets
          .map(({ name }) => `  - ${chalk.yellow(name)} is set to a known development/placeholder value and must be a unique strong secret`)
          .join('\n') +
        `\n`,
    );
    process.exit(1);
  }

  // Reusing the previous session secret as the current one defeats rotation, but it is not unsafe - warn only.
  if (env.JETSTREAM_SESSION_SECRET_PREV && env.JETSTREAM_SESSION_SECRET === env.JETSTREAM_SESSION_SECRET_PREV) {
    writeEnvConfigWarning(
      'JETSTREAM_SESSION_SECRET is identical to JETSTREAM_SESSION_SECRET_PREV - session secret rotation will have no effect',
    );
  }
}

assertProductionSecretsAreSafe(parseResults.data);

export type Env = z.infer<typeof envSchema>;
export const ENV: Env = parseResults.data;
