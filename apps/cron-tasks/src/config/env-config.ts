import * as dotenv from 'dotenv';
import { readFileSync } from 'fs-extra';
import { join } from 'path';
dotenv.config();

let VERSION;
try {
  VERSION = readFileSync(join(__dirname, '../../VERSION'), 'utf-8').trim();
  console.info(`APP VERSION ${VERSION}`);
} catch {
  // could not read environment version
}

export const ENV = {
  // SYSTEM
  NODE_ENV: process.env.NODE_ENV,
  ENVIRONMENT: process.env.ENVIRONMENT || 'production',
  GIT_VERSION: VERSION,
  ROLLBAR_SERVER_TOKEN: process.env.ROLLBAR_SERVER_TOKEN,
  JETSTREAM_POSTGRES_DBURI: process.env.JETSTREAM_POSTGRES_DBURI,
  PRISMA_DEBUG: process.env.PRISMA_DEBUG && process.env.PRISMA_DEBUG.toLocaleLowerCase().startsWith('t'),

  // MAILGUN
  MAILGUN_API_KEY: process.env.MAILGUN_API_KEY,
  MAILGUN_PUBLIC_KEY: process.env.MAILGUN_PUBLIC_KEY,
  MAILGUN_WEBHOOK_KEY: process.env.MAILGUN_WEBHOOK_KEY,

  AMPLITUDE_API_KEY: process.env.AMPLITUDE_API_KEY,
  AMPLITUDE_SECRET_KEY: process.env.AMPLITUDE_SECRET_KEY,

  MAX_MIND_ACCOUNT_ID: process.env.MAX_MIND_ACCOUNT_ID,
  MAX_MIND_LICENSE_KEY: process.env.MAX_MIND_LICENSE_KEY,

  GEO_IP_API_HOSTNAME: process.env.GEO_IP_API_HOSTNAME,
  GEO_IP_API_USERNAME: process.env.GEO_IP_API_USERNAME,
  GEO_IP_API_PASSWORD: process.env.GEO_IP_API_PASSWORD,
};
