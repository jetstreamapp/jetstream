import { prisma } from './config/db.config';
import { logger } from './config/logger.config';
import { syncBlockedEmailDomains } from './utils/blocked-email-domain-sync.utils';

syncBlockedEmailDomains(prisma)
  .then((result) => {
    logger.info(
      result,
      result.testMode
        ? 'Blocked email domain sync completed (TEST MODE - counts are what would have been written)'
        : 'Blocked email domain sync completed',
    );
    process.exit(0);
  })
  .catch((err) => {
    logger.error(err);
    process.exit(1);
  });
