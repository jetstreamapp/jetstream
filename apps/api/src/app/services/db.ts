import { Pool } from 'pg';

export const pgPool = new Pool({
  // Insert pool options here
  connectionString: process.env.JESTREAM_POSTGRES_DBURI,
  connectionTimeoutMillis: 2000,
  idleTimeoutMillis: 30000,
});

pgPool.on('connect', (client) => {
  console.log('[DB][CONNECT] client connected');
});

pgPool.on('error', (err, client) => {
  console.error('[DB][ERROR] Unexpected error on idle client', err);
  process.exit(-1);
});
