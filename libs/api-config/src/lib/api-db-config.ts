import { Prisma, PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { getExceptionLog, logger } from './api-logger';
import { ENV } from './env-config';

process.on('uncaughtException', function (err) {
  console.log(err);
});

const log: Array<Prisma.LogLevel | Prisma.LogDefinition> = ['info'];

if (ENV.PRISMA_DEBUG) {
  log.push('query');
}

export const prisma = new PrismaClient({
  log,
});

export const pgPool = new Pool({
  connectionString: ENV.JETSTREAM_POSTGRES_DBURI,
  connectionTimeoutMillis: 2000,
  idleTimeoutMillis: 30000,
});

pgPool.on('connect', (client) => {
  // logger.info('[DB][POOL] Connected');
  client.on('error', (err) => {
    logger.error(getExceptionLog(err), '[DB][CLIENT][ERROR] Unexpected error on client.');
  });
});

pgPool.on('error', (err, client) => {
  logger.error(getExceptionLog(err), '[DB][POOL][ERROR] Unexpected error on idle client.');
  process.exit(-1);
});
