import { Prisma, PrismaClient } from '@prisma/client';
import { logger } from 'apps/api/src/app/config/logger.config';
import { Pool } from 'pg';
import { ENV } from './env-config';

const log: Array<Prisma.LogLevel | Prisma.LogDefinition> = ['info'];

if (ENV.ENVIRONMENT === 'development' || ENV.ENVIRONMENT === 'test') {
  log.push('query');
}

export const prisma = new PrismaClient({
  log,
  rejectOnNotFound: false,
});

export const pgPool = new Pool({
  connectionString: ENV.JESTREAM_POSTGRES_DBURI,
  connectionTimeoutMillis: 2000,
  idleTimeoutMillis: 30000,
});

pgPool.on('connect', (client) => {
  // logger.info('[DB][POOL] Connected');
  client.on('error', (err) => {
    logger.error('[DB][CLIENT][ERROR] Unexpected error on client. %o', err);
  });
});

pgPool.on('error', (err, client) => {
  logger.error('[DB][POOL][ERROR] Unexpected error on idle client. %o', err);
  process.exit(-1);
});
