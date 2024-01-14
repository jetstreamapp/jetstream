import { Pool } from 'pg';
import { ENV } from '../config/env-config';
import { logger } from './logger.config';

export const pool = new Pool({
  connectionString: ENV.DATABASE_URL,
  application_name: 'jetstream-worker',
});

pool.on('error', (err, client) => {
  logger.error('[DB][CONNECTION ERROR] Unexpected error on idle client %o', err);
  process.exit(-1);
});
