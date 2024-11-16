import { getExceptionLog } from '@jetstream/api-config';
import { ensureBoolean } from '@jetstream/shared/utils';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs-extra';
import { join } from 'path';
dotenv.config();

let VERSION;
try {
  VERSION = readFileSync(join(__dirname, '../../VERSION'), 'utf-8').trim();
  console.warn(`APP VERSION ${VERSION}`);
} catch (ex) {
  console.warn('COULD NOT READ VERSION FILE', getExceptionLog(ex));
}

export const ENV = {
  // SYSTEM
  NODE_ENV: process.env.NODE_ENV,
  ENVIRONMENT: process.env.ENVIRONMENT || 'production',
  GIT_VERSION: VERSION,
  ROLLBAR_SERVER_TOKEN: process.env.ROLLBAR_SERVER_TOKEN,
  // FIXME: there was a typo in env variables, using both temporarily as a safe fallback
  JETSTREAM_POSTGRES_DBURI: process.env.JETSTREAM_POSTGRES_DBURI || process.env.JESTREAM_POSTGRES_DBURI,
  PRISMA_DEBUG: ensureBoolean(process.env.PRISMA_DEBUG),

  // MAILGUN
  MAILGUN_API_KEY: process.env.MAILGUN_API_KEY,
  MAILGUN_PUBLIC_KEY: process.env.MAILGUN_PUBLIC_KEY,
  MAILGUN_WEBHOOK_KEY: process.env.MAILGUN_WEBHOOK_KEY,

  AMPLITUDE_API_KEY: process.env.AMPLITUDE_API_KEY,
  AMPLITUDE_SECRET_KEY: process.env.AMPLITUDE_SECRET_KEY,
};
