import { Pool } from 'pg';
import 'reflect-metadata';
import { createConnection } from 'typeorm';
import { SalesforceOrg } from '../db/entites/SalesforceOrg';
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

createConnection({
  type: 'postgres',
  url: process.env.JESTREAM_POSTGRES_DBURI,
  entities: [SalesforceOrg],
  synchronize: true,
  logging: ['error', 'schema'],
  maxQueryExecutionTime: 1000,
})
  .then((connection) => {
    // here you can start to work with your entities
    logger.info('[DB][CONNECT] Connection to database established.');
  })
  .catch((err) => {
    logger.error('[DB][ERROR] Unable to connect to database. %o', err);
  });
