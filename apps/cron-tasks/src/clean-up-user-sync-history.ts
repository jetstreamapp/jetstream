import { prisma } from './config/db.config';
import { logger } from './config/logger.config';
import { cleanUpUserSyncHistory } from './utils/clean-up-user-sync-history.utils';

cleanUpUserSyncHistory(prisma).catch((err) => {
  logger.error(err);
  process.exit(1);
});
