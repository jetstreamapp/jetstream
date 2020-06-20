import { Pool } from 'pg';
import { logger } from './logger.config';

export const pgPool = new Pool({
  // Insert pool options here
  connectionString: process.env.JESTREAM_POSTGRES_DBURI,
  connectionTimeoutMillis: 2000,
  idleTimeoutMillis: 30000,
});

pgPool.on('error', (err, client) => {
  logger.error('[DB][ERROR] Unexpected error on idle client. %o', err);
  process.exit(-1);
});
