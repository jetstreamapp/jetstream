import type { Maybe } from '@jetstream/types';
import chalk from 'chalk';
import { app } from 'electron';
import { z } from 'zod';

const logLevelSchema = z.enum(['debug', 'info', 'warn', 'error']);

const args = process.argv.slice(1); // Slice off Electron path in dev, or binary path in prod
for (const arg of args) {
  if (arg.startsWith('--log-level=')) {
    const results = logLevelSchema.safeParse(arg.split('=')[1]);
    if (results.success) {
      process.env.LOG_LEVEL = results.data;
    }
  }
}

const ENV_INTERNAL_DEV = {
  ENVIRONMENT: 'development',
  CLIENT_URL: 'http://localhost:4200',
  SERVER_URL: 'http://localhost:3333',
  SFDC_API_VERSION: '62.0',
  DESKTOP_SFDC_CALLBACK_URL: 'jetstream://addOrg/oauth/sfdc/callback',
  DESKTOP_SFDC_CLIENT_ID: '3MVG94YrNIs0WS4d2PK0lDfKIz_loKEkofpaTrvi7_3g_tLRZSQ9_XNQpSmtNVMs7hnO77x3RqRGaxy86vnK_',
};

const ENV_INTERNAL_PROD = {
  ENVIRONMENT: 'production',
  CLIENT_URL: 'app://jetstream/client/index.html',
  SERVER_URL: 'https://getjetstream.app',
  SFDC_API_VERSION: ENV_INTERNAL_DEV.SFDC_API_VERSION,
  DESKTOP_SFDC_CALLBACK_URL: ENV_INTERNAL_DEV.DESKTOP_SFDC_CALLBACK_URL,
  DESKTOP_SFDC_CLIENT_ID: ENV_INTERNAL_DEV.DESKTOP_SFDC_CLIENT_ID,
};

const environment = app.isPackaged ? ENV_INTERNAL_PROD : ENV_INTERNAL_DEV;

function ensureBoolean(value: Maybe<string | boolean>): boolean {
  if (typeof value === 'boolean') {
    return value;
  } else if (typeof value === 'string') {
    return value.toLowerCase().startsWith('t');
  }
  return false;
}

const booleanSchema = z.union([z.string(), z.boolean()]).optional().transform(ensureBoolean);

const envSchema = z.object({
  LOG_LEVEL: logLevelSchema.optional().transform((value) => {
    if (value) {
      return value;
    }
    return environment.ENVIRONMENT === 'development' ? 'debug' : 'info';
  }),
  CI: booleanSchema,
  ENVIRONMENT: z
    .enum(['development', 'production'])
    .optional()
    .transform((value) => value ?? 'production'),
  CLIENT_URL: z.string(),
  SERVER_URL: z.string().url(),
  // TODO: allow updating this in the app
  SFDC_API_VERSION: z.string().regex(/^[0-9]{2,4}\.[0-9]$/),
  DESKTOP_SFDC_CLIENT_ID: z.string().min(1),
  DESKTOP_SFDC_CALLBACK_URL: z.string().url(),
});

const parseResults = envSchema.safeParse({
  ...environment,
  LOG_LEVEL: process.env.LOG_LEVEL,
});

if (!parseResults.success) {
  console.error(`❌ ${chalk.red('Error parsing environment variables:')}
${chalk.yellow(JSON.stringify(parseResults.error.flatten().fieldErrors, null, 2))}
`);
  process.exit(1);
}

export type Env = z.infer<typeof envSchema>;
export const ENV: Env = parseResults.data;
export const SERVER_URL = new URL(ENV.SERVER_URL);
