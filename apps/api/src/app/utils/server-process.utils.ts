import '@jetstream/api-config'; // this gets imported first to ensure as some items require early initialization
import { ENV, getExceptionLog, logger, pgPool, prisma } from '@jetstream/api-config';
import { hashPassword, pruneExpiredRecords } from '@jetstream/auth/server';
import '@jetstream/auth/types';
import { AsyncIntervalTimer } from '@jetstream/shared/node-utils';
import cluster from 'node:cluster';

export async function primaryClusterInitSideEffects() {
  if (!cluster.isPrimary) {
    return;
  }

  console.log(`
     ██╗███████╗████████╗███████╗████████╗██████╗ ███████╗ █████╗ ███╗   ███╗
     ██║██╔════╝╚══██╔══╝██╔════╝╚══██╔══╝██╔══██╗██╔════╝██╔══██╗████╗ ████║
     ██║█████╗     ██║   ███████╗   ██║   ██████╔╝█████╗  ███████║██╔████╔██║
██   ██║██╔══╝     ██║   ╚════██║   ██║   ██╔══██╗██╔══╝  ██╔══██║██║╚██╔╝██║
╚█████╔╝███████╗   ██║   ███████║   ██║   ██║  ██║███████╗██║  ██║██║ ╚═╝ ██║
 ╚════╝ ╚══════╝   ╚═╝   ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝

NODE_ENV=${ENV.NODE_ENV}
ENVIRONMENT=${ENV.ENVIRONMENT}
VERSION=${ENV.VERSION ?? '<unspecified>'}
LOG_LEVEL=${ENV.LOG_LEVEL}
JETSTREAM_SERVER_URL=${ENV.JETSTREAM_SERVER_URL}
JETSTREAM_CLIENT_URL=${ENV.JETSTREAM_CLIENT_URL}
`);

  // Crash if we can't connect to the database
  try {
    await prisma.$connect();
    await pgPool.query('SELECT 1');
    logger.info('Primary process: Database connection successful');
  } catch (error) {
    logger.error(getExceptionLog(error), 'Primary process: Database connection failed - application will not start');
    process.exit(1);
  }

  await initExampleUserIfRequired();

  // Prune expired records every hour, wait for 30 seconds after startup to allow for other services to start
  setTimeout(() => {
    new AsyncIntervalTimer(pruneExpiredRecords, { name: 'pruneExpiredRecords', intervalMs: /** 1 hour */ 60 * 60 * 1000, runOnInit: true });
  }, 1000 * 30); // Delay 30 seconds to allow for other services to start
}

async function initExampleUserIfRequired() {
  try {
    if (ENV.EXAMPLE_USER && ENV.EXAMPLE_USER_PASSWORD && (ENV.ENVIRONMENT !== 'production' || ENV.CI)) {
      const passwordHash = await hashPassword(ENV.EXAMPLE_USER_PASSWORD);
      const user = ENV.EXAMPLE_USER;
      logger.info('Upserting example user. id: %s', user.id);
      await prisma.user.upsert({
        create: {
          id: user.id,
          userId: user.userId,
          email: user.email,
          emailVerified: user.emailVerified,
          name: user.name,
          password: passwordHash,
          passwordUpdatedAt: new Date(),
          lastLoggedIn: new Date(),
          preferences: { create: { skipFrontdoorLogin: false } },
          authFactors: { create: { type: '2fa-email', enabled: false } },
          entitlements: { create: { chromeExtension: false, recordSync: false, googleDrive: false, desktop: false } },
        },
        update: {
          entitlements: {
            upsert: {
              create: { chromeExtension: false, recordSync: false, googleDrive: false, desktop: false },
              update: { chromeExtension: false, recordSync: false, googleDrive: false, desktop: false },
            },
          },
        },
        where: { id: user.id },
      });
    }
  } catch (ex) {
    logger.error(getExceptionLog(ex), '[EXAMPLE_USER][ERROR] Fatal error, could not upsert example user');
    process.exit(1);
  }
}
