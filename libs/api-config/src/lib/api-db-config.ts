import { UserProfileSession } from '@jetstream/auth/types';
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
}).$extends({
  result: {
    user: {
      hasPasswordSet: {
        needs: { password: true },
        compute: (user) => !!user.password,
      },
    },
  },
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

/**
 * FIXME: we should just allow the example user to be created
 * but then there is nothing special about the user after the creation
 * maybe we can have an automated way to login and generate the session
 *
 * This would mean that we can get rid of any bypasses in the code
 */
if (ENV.ENVIRONMENT !== 'production' && ENV.EXAMPLE_USER) {
  const exampleUser = ENV.EXAMPLE_USER as UserProfileSession;
  prisma.user
    .upsert({
      select: { id: true },
      where: { id: exampleUser.id },
      update: {},
      create: {
        id: exampleUser.id,
        email: exampleUser.email,
        userId: exampleUser.userId,
        name: exampleUser.name,
        emailVerified: true,
        password: null,
        preferences: { create: { skipFrontdoorLogin: false } },
        authFactors: {
          create: {
            type: '2fa-email',
            enabled: false,
          },
        },
      },
    })
    .then(({ id }) => {
      logger.info('Example user created with id: %s', id);
    })
    .catch((err) => {
      logger.error(getExceptionLog(err), 'Failed to create example user.');
      process.exit(1);
    });
}
