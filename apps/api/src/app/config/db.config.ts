import { SalesforceApi } from '../db/entites/SalesforceApi';
import { Pool } from 'pg';
import 'reflect-metadata';
import { createConnection } from 'typeorm';
import { SalesforceOrg } from '../db/entites/SalesforceOrg';
import { ENV } from './env-config';
import { logger } from './logger.config';

export const pgPool = new Pool({
  connectionString: ENV.JESTREAM_POSTGRES_DBURI,
  connectionTimeoutMillis: 2000,
  idleTimeoutMillis: 30000,
});

pgPool.on('connect', (client) => {
  logger.info('[DB][POOL] Connected');
  client.on('error', (err) => {
    logger.error('[DB][CLIENT][ERROR] Unexpected error on client. %o', err);
  });
});

pgPool.on('remove', (client) => {
  logger.info('[DB][POOL] Connection removed');
});

pgPool.on('error', (err, client) => {
  logger.error('[DB][POOL][ERROR] Unexpected error on idle client. %o', err);
  process.exit(-1);
});

createConnection({
  type: 'postgres',
  url: ENV.JESTREAM_POSTGRES_DBURI,
  entities: [SalesforceOrg, SalesforceApi],
  synchronize: true,
  logging: ['error', 'warn', 'schema'],
  maxQueryExecutionTime: 1000,
})
  .then((connection) => {
    // here you can start to work with your entities
    logger.info('[DB][CONNECT] Connection to database established.');
  })
  .catch((err) => {
    logger.error('[DB][ERROR] Unable to connect to database. %o', err);
  });
