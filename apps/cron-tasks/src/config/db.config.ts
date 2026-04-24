import { Prisma, PrismaClient } from '@jetstream/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { ENV } from './env-config';
import { logger } from './logger.config';

const log: Array<Prisma.LogLevel | Prisma.LogDefinition> = ['info'];

if (ENV.PRISMA_DEBUG) {
  log.push('query');
}

const adapter = new PrismaPg({
  connectionString: process.env.JETSTREAM_POSTGRES_DBURI,
});

export const prisma = new PrismaClient({
  log,
  adapter,
});

export const pgPool = new Pool({
  connectionString: ENV.JETSTREAM_POSTGRES_DBURI,
  connectionTimeoutMillis: 2000,
  idleTimeoutMillis: 30000,
});

pgPool.on('connect', (client) => {
  // logger.info('[DB][POOL] Connected');
  client.on('error', (err) => {
    logger.error({ err }, '[DB][CLIENT][ERROR] Unexpected error on client');
  });
});

pgPool.on('error', (err) => {
  logger.error({ err }, '[DB][POOL][ERROR] Unexpected error on idle client');
  process.exit(-1);
});

/**
 * Pool for the standalone Cloudflare analytics archive database (separate from the
 * primary Jetstream Postgres). Lazily configured — readers should fail loudly if
 * the connection string is missing rather than letting other cron tasks break.
 */
export const cloudflareAnalyticsPool = ENV.CLOUDFLARE_ANALYTICS_DBURI
  ? new Pool({
      connectionString: ENV.CLOUDFLARE_ANALYTICS_DBURI,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
      max: 4,
    })
  : null;

cloudflareAnalyticsPool?.on('error', (err) => {
  logger.error({ err }, '[DB][CLOUDFLARE_ANALYTICS_POOL][ERROR] Unexpected error on idle client');
});

export function getCloudflareAnalyticsPool(): Pool {
  if (!cloudflareAnalyticsPool) {
    throw new Error('CLOUDFLARE_ANALYTICS_DBURI is not configured');
  }
  return cloudflareAnalyticsPool;
}
