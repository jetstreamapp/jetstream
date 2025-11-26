import 'dotenv/config';
import path from 'node:path';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: path.join(__dirname, 'prisma/schema.prisma'),
  migrations: {
    path: path.join(__dirname, 'prisma/migrations'),
    seed: 'node prisma/seed-salesforce-api.mjs',
  },
  typedSql: {
    path: path.join(__dirname, 'prisma/sql'),
  },
  datasource: {
    url: env('JETSTREAM_POSTGRES_DBURI'),
  },
});
